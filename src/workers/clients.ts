import * as Comlink from 'comlink'
import type { VisionWorkerApi } from './vision.worker'

// Lazy erzeugter, Comlink-gewrappter Vision-Worker (ONNX-Inferenz, CPU-intensiv
// → eigener Worker). Die Kommentar-Engine (wllama) läuft dagegen im Main-Thread
// (siehe game/commentaryEngine.ts), weil wllama seine Compute-Worker selbst startet.

let visionProxy: Comlink.Remote<VisionWorkerApi> | null = null
export function getVision(): Comlink.Remote<VisionWorkerApi> {
  if (!visionProxy) {
    const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), {
      type: 'module',
    })
    visionProxy = Comlink.wrap<VisionWorkerApi>(worker)
  }
  return visionProxy
}
