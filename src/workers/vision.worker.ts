import * as Comlink from 'comlink'
import * as ort from 'onnxruntime-web'
import { preprocess, decode, INPUT_SIZE, type Detection } from '../vision/detect'

// Figuren-Detektor NAKSTStudio/yolov8m-chess-piece-detection (board + 12 Figuren).
const BASE = import.meta.env.BASE_URL
const MODEL_URL = `${BASE}models/yolo/best.onnx`
// End-to-End-Erkenner (eigenes Finetuning, ChessReD): ganzes Foto → 64×13 → FEN.
const REC_MODEL_URL = `${BASE}models/recognizer/recognizer.onnx`
const REC_META_URL = `${BASE}models/recognizer/recognizer.json`

interface RecMeta {
  input_size: number
  id2fen: Record<string, string>
}

export interface VisionWorkerApi {
  load(): Promise<{ backend: string }>
  isReady(): boolean
  // Erkennt Brett + Figuren in einem RGBA-Frame.
  detect(
    frame: { data: Uint8ClampedArray; width: number; height: number },
  ): Promise<Detection[]>
  // End-to-End-Erkenner laden (separates Modell vom Detektor).
  loadRecognizer(): Promise<{ backend: string }>
  // Ganzes Brettfoto → FEN-Stellungsfeld (ohne Ecken/Raster).
  recognize(
    frame: { data: Uint8ClampedArray; width: number; height: number },
  ): Promise<string>
  // Diagnose: Modell-Metadaten + Ausgabe-Form einer Leerlauf-Inferenz.
  debugInfo(): Promise<{
    inputNames: string[]
    outputNames: string[]
    outputDims: number[]
  }>
}

let session: ort.InferenceSession | null = null
let backend = 'wasm'
let recSession: ort.InferenceSession | null = null
let recMeta: RecMeta | null = null
let recBackend = 'wasm'

// WASM-Laufzeit same-origin + Thread-Zahl (gemeinsam für beide Modelle).
function setupOrtEnv() {
  ort.env.wasm.wasmPaths = `${self.location.origin}${BASE}ort/`
  ort.env.wasm.numThreads = self.crossOriginIsolated
    ? Math.min(4, navigator.hardwareConcurrency || 2)
    : 1
}

// Session mit WebGPU→WASM-Fallback erstellen.
async function createSession(bytes: Uint8Array): Promise<{ session: ort.InferenceSession; ep: string }> {
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu
  const providers = gpu ? ['webgpu', 'wasm'] : ['wasm']
  let lastErr: unknown
  for (const ep of providers) {
    try {
      const s = await ort.InferenceSession.create(bytes, {
        executionProviders: [ep],
        graphOptimizationLevel: 'all',
      })
      return { session: s, ep }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? new Error('Kein verfügbares Backend')
}

const api: VisionWorkerApi = {
  async load() {
    if (session) return { backend }
    setupOrtEnv()
    // Modell-Bytes selbst laden (robuster als ort's interner URL-Fetch).
    const res = await fetch(MODEL_URL)
    if (!res.ok) throw new Error(`Modell-Download fehlgeschlagen: HTTP ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const r = await createSession(bytes)
    session = r.session
    backend = r.ep
    return { backend }
  },

  isReady() {
    return session !== null
  },

  async loadRecognizer() {
    if (recSession) return { backend: recBackend }
    setupOrtEnv()
    const metaRes = await fetch(REC_META_URL)
    if (!metaRes.ok) {
      throw new Error(`Erkennungsmodell fehlt (HTTP ${metaRes.status}) – Training noch nicht eingespielt?`)
    }
    recMeta = (await metaRes.json()) as RecMeta
    const res = await fetch(REC_MODEL_URL)
    if (!res.ok) throw new Error(`Modell-Download fehlgeschlagen: HTTP ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const r = await createSession(bytes)
    recSession = r.session
    recBackend = r.ep
    return { backend: recBackend }
  },

  async recognize(frame) {
    if (!recSession || !recMeta) await api.loadRecognizer()
    const size = recMeta!.input_size
    // RGBA-Frame als Quelle, dann auf size×size strecken (wie Training:
    // Resize((s,s)) ohne Letterbox). Normalisierung ist im ONNX-Graph gebacken
    // → hier nur RGB/255 in NCHW.
    const src = new OffscreenCanvas(frame.width, frame.height)
    const sctx = src.getContext('2d')!
    sctx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0)
    // Zentrierter Quadrat-Crop VOR dem Resize – das Training nutzte quadratische
    // Bilder; ein Hochformat-Foto direkt auf size×size zu strecken verzerrt die
    // Geometrie und kostet spürbar Genauigkeit.
    const side = Math.min(frame.width, frame.height)
    const sx = Math.floor((frame.width - side) / 2)
    const sy = Math.floor((frame.height - side) / 2)
    const dst = new OffscreenCanvas(size, size)
    const dctx = dst.getContext('2d')!
    dctx.drawImage(src, sx, sy, side, side, 0, 0, size, size)
    const { data: rgba } = dctx.getImageData(0, 0, size, size)

    const area = size * size
    const input = new Float32Array(3 * area)
    for (let i = 0; i < area; i++) {
      input[i] = rgba[i * 4] / 255 // R
      input[area + i] = rgba[i * 4 + 1] / 255 // G
      input[2 * area + i] = rgba[i * 4 + 2] / 255 // B
    }
    const tensor = new ort.Tensor('float32', input, [1, 3, size, size])
    const results = await recSession!.run({ [recSession!.inputNames[0]]: tensor })
    const logits = results[recSession!.outputNames[0]].data as Float32Array

    // logits = [64*nClasses], Feld s: logits[s*nClasses .. +nClasses].
    // Feld-Index a8=0,b8=1,…,h8=7,a7=8,…,h1=63 (FEN-Lesereihenfolge).
    const nClasses = Math.round(logits.length / 64)
    const id2fen = recMeta!.id2fen
    let field = ''
    for (let rank = 0; rank < 8; rank++) {
      let empty = 0
      for (let file = 0; file < 8; file++) {
        const s = rank * 8 + file
        let bestV = -Infinity
        let bestC = 0
        for (let c = 0; c < nClasses; c++) {
          const v = logits[s * nClasses + c]
          if (v > bestV) {
            bestV = v
            bestC = c
          }
        }
        const ch = id2fen[String(bestC)] ?? ''
        if (ch === '') {
          empty++
        } else {
          if (empty) {
            field += empty
            empty = 0
          }
          field += ch
        }
      }
      if (empty) field += empty
      if (rank < 7) field += '/'
    }
    return field
  },

  async debugInfo() {
    if (!session) await api.load()
    const s = session!
    const input = new ort.Tensor('float32', new Float32Array(3 * INPUT_SIZE * INPUT_SIZE), [1, 3, INPUT_SIZE, INPUT_SIZE])
    const results = await s.run({ [s.inputNames[0]]: input })
    const out = results[s.outputNames[0]]
    return {
      inputNames: [...s.inputNames],
      outputNames: [...s.outputNames],
      outputDims: [...out.dims],
    }
  },

  async detect(frame) {
    if (!session) throw new Error('YOLO-Modell nicht geladen')
    // RGBA-Frame in eine OffscreenCanvas-Quelle bringen.
    const canvas = new OffscreenCanvas(frame.width, frame.height)
    const ctx = canvas.getContext('2d')!
    // Frische Kopie in nicht-shared Buffer (Frame kann über SharedArrayBuffer kommen).
    const pixels = new Uint8ClampedArray(frame.data)
    ctx.putImageData(new ImageData(pixels, frame.width, frame.height), 0, 0)
    const { data, info } = preprocess(canvas, frame.width, frame.height)

    const input = new ort.Tensor('float32', data, [1, 3, INPUT_SIZE, INPUT_SIZE])
    const inputName = session.inputNames[0]
    const outputName = session.outputNames[0]
    const results = await session.run({ [inputName]: input })
    const out = results[outputName]
    // Niedrigere Schwelle → mehr Figuren bei schwierigen Fotos (reale Sets,
    // Winkel). Pro Feld gewinnt ohnehin der höchste Score (Dedup).
    return decode(out.data as Float32Array, out.dims, info, 0.18)
  },
}

Comlink.expose(api)
