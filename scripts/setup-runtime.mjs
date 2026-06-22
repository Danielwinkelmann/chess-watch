// Kopiert WASM-Laufzeitdateien aus node_modules nach public/ (same-origin nötig
// wegen COOP/COEP). Läuft automatisch als postinstall. Diese Dateien gehören
// nicht ins Git – sie stammen aus den installierten Paketen.
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = join(dirname(new URL(import.meta.url).pathname), '..')
const nm = join(root, 'node_modules')

const copies = [
  // Stockfish (Single-Thread-Lite, kein SharedArrayBuffer nötig)
  ['stockfish/bin/stockfish-18-lite-single.js', 'public/engine/stockfish-18-lite-single.js'],
  ['stockfish/bin/stockfish-18-lite-single.wasm', 'public/engine/stockfish-18-lite-single.wasm'],
  // onnxruntime-web (WebGPU/jsep + WASM-Threads)
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'public/ort/ort-wasm-simd-threaded.wasm'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'public/ort/ort-wasm-simd-threaded.mjs'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm', 'public/ort/ort-wasm-simd-threaded.jsep.wasm'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs', 'public/ort/ort-wasm-simd-threaded.jsep.mjs'],
  // MediaPipe Tasks-Vision (Hand-Landmarker-Laufzeit)
  ['@mediapipe/tasks-vision/wasm/vision_wasm_internal.js', 'public/models/mediapipe/wasm/vision_wasm_internal.js'],
  ['@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm', 'public/models/mediapipe/wasm/vision_wasm_internal.wasm'],
  ['@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js', 'public/models/mediapipe/wasm/vision_wasm_nosimd_internal.js'],
  ['@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm', 'public/models/mediapipe/wasm/vision_wasm_nosimd_internal.wasm'],
]

let copied = 0
for (const [src, dest] of copies) {
  const s = join(nm, src)
  const d = join(root, dest)
  if (!existsSync(s)) {
    console.warn(`übersprungen (fehlt): ${src}`)
    continue
  }
  mkdirSync(dirname(d), { recursive: true })
  copyFileSync(s, d)
  copied++
}
console.log(`Laufzeit-Assets kopiert: ${copied}/${copies.length}`)
