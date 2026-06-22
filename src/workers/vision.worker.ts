import * as Comlink from 'comlink'
import * as ort from 'onnxruntime-web'
import { preprocess, decode, type Detection } from '../vision/detect'

// Selbst-gehostetes YOLO-Modell (NAKSTStudio, 13 Klassen: board + 12 Figuren).
const MODEL_URL = '/models/yolo/best.onnx'

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
    ort.env.wasm.wasmPaths = `${self.location.origin}/ort/`
    ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2)
    // WebGPU nur, wenn im Worker tatsächlich vorhanden – ein fehlschlagender
    // erster Init vergiftet sonst den globalen ort-Zustand.
    const gpu = (navigator as Navigator & { gpu?: unknown }).gpu
    backend = gpu ? 'webgpu' : 'wasm'

    // Modell-Bytes selbst laden (robuster als ort's interner URL-Fetch).
    const res = await fetch(MODEL_URL)
    if (!res.ok) throw new Error(`Modell-Download fehlgeschlagen: HTTP ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    session = await ort.InferenceSession.create(bytes, {
      executionProviders: [backend],
      graphOptimizationLevel: 'all',
    })
    return { backend }
  },

  isReady() {
    return session !== null
  },

  async debugInfo() {
    if (!session) await api.load()
    const s = session!
    const input = new ort.Tensor('float32', new Float32Array(3 * 640 * 640), [1, 3, 640, 640])
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

    const input = new ort.Tensor('float32', data, [1, 3, 640, 640])
    const inputName = session.inputNames[0]
    const outputName = session.outputNames[0]
    const results = await session.run({ [inputName]: input })
    const out = results[outputName]
    return decode(out.data as Float32Array, out.dims, info)
  },
}

Comlink.expose(api)
