import * as Comlink from 'comlink'
import * as ort from 'onnxruntime-web'
import { preprocess, decode, INPUT_SIZE, type Detection } from '../vision/detect'

// Figuren-Detektor NAKSTStudio/yolov8m-chess-piece-detection (board + 12 Figuren).
const BASE = import.meta.env.BASE_URL
const MODEL_URL = `${BASE}models/yolo/best.onnx`

export interface VisionWorkerApi {
  load(): Promise<{ backend: string }>
  isReady(): boolean
  // Erkennt Brett + Figuren in einem RGBA-Frame.
  detect(
    frame: { data: Uint8ClampedArray; width: number; height: number },
  ): Promise<Detection[]>
  // Diagnose: Modell-Metadaten + Ausgabe-Form einer Leerlauf-Inferenz.
  debugInfo(): Promise<{
    inputNames: string[]
    outputNames: string[]
    outputDims: number[]
  }>
}

let session: ort.InferenceSession | null = null
let backend = 'wasm'

const api: VisionWorkerApi = {
  async load() {
    if (session) return { backend }
    // WASM-Laufzeit same-origin aus /ort (per setup-runtime kopiert).
    ort.env.wasm.wasmPaths = `${self.location.origin}${BASE}ort/`
    // Ohne Cross-Origin-Isolation (z. B. GitHub Pages) kein SharedArrayBuffer → 1 Thread.
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1

    // Modell-Bytes selbst laden (robuster als ort's interner URL-Fetch).
    const res = await fetch(MODEL_URL)
    if (!res.ok) throw new Error(`Modell-Download fehlgeschlagen: HTTP ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())

    // WebGPU bevorzugen, bei Fehler/Abwesenheit auf WASM zurückfallen.
    const gpu = (navigator as Navigator & { gpu?: unknown }).gpu
    const providers = gpu ? ['webgpu', 'wasm'] : ['wasm']
    let lastErr: unknown
    for (const ep of providers) {
      try {
        session = await ort.InferenceSession.create(bytes, {
          executionProviders: [ep],
          graphOptimizationLevel: 'all',
        })
        backend = ep
        return { backend }
      } catch (e) {
        lastErr = e
        session = null
      }
    }
    throw lastErr ?? new Error('Kein verfügbares Backend')
  },

  isReady() {
    return session !== null
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
