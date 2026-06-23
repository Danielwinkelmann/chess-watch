import type { Detection } from './detect'
import type { Pt } from './homography'

type DetectFn = (frame: { data: Uint8ClampedArray; width: number; height: number }) => Promise<Detection[]>

// Schneidet auf die Brettregion (aus den 4 Ecken + Rand) zu und erkennt darauf.
// So werden die Figuren groß genug für den 416px-Detektor (statt im Weitwinkel
// zu verschwinden). Detections werden in Vollbild-Koordinaten zurückgegeben,
// passend zur Homographie über dieselben Ecken.
export async function detectOnBoardCrop(
  detect: DetectFn,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  corners: Pt[],
): Promise<Detection[]> {
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const bw = Math.max(...xs) - Math.min(...xs)
  const bh = Math.max(...ys) - Math.min(...ys)
  // Rand: seitlich/unten 18 %, oben 32 % (hohe Figuren ragen nach oben).
  const x0 = Math.max(0, Math.min(...xs) - bw * 0.18)
  const x1 = Math.min(sw, Math.max(...xs) + bw * 0.18)
  const y0 = Math.max(0, Math.min(...ys) - bh * 0.32)
  const y1 = Math.min(sh, Math.max(...ys) + bh * 0.18)
  const cw = Math.round(x1 - x0)
  const ch = Math.round(y1 - y0)
  if (cw < 16 || ch < 16) return []

  const cvs = document.createElement('canvas')
  cvs.width = cw
  cvs.height = ch
  const ctx = cvs.getContext('2d')!
  ctx.drawImage(source, x0, y0, cw, ch, 0, 0, cw, ch)
  const img = ctx.getImageData(0, 0, cw, ch)
  const dets = await detect({ data: img.data, width: cw, height: ch })
  // Zurück in Vollbild-Koordinaten verschieben.
  return dets.map((d) => ({ ...d, x: d.x + x0, y: d.y + y0 }))
}
