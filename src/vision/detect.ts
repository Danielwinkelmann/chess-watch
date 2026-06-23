// Figuren-Detektor NAKSTStudio/yolov8m-chess-piece-detection (13 Klassen:
// board + 12 Figuren, 640px). Erkennt zuverlässig beide Farben auf realen Sets;
// Brett-Geometrie kommt aus der Eck-Kalibrierung (Homographie). Klassen exakt
// aus den eingebetteten ONNX-`names`-Metadaten (verifiziert).
export const CLASS_NAMES = [
  'board', // 0
  'white_king', // 1
  'white_queen', // 2
  'white_rook', // 3
  'white_bishop', // 4
  'white_knight', // 5
  'white_pawn', // 6
  'black_king', // 7
  'black_queen', // 8
  'black_rook', // 9
  'black_bishop', // 10
  'black_knight', // 11
  'black_pawn', // 12
] as const

export type ClassName = (typeof CLASS_NAMES)[number]

// Klassenname → FEN-Figurzeichen (Großbuchstabe = Weiß). 'board' = kein Stück.
export const CLASS_TO_FEN: Record<string, string | null> = {
  white_king: 'K',
  white_queen: 'Q',
  white_rook: 'R',
  white_bishop: 'B',
  white_knight: 'N',
  white_pawn: 'P',
  black_king: 'k',
  black_queen: 'q',
  black_rook: 'r',
  black_bishop: 'b',
  black_knight: 'n',
  black_pawn: 'p',
  board: null,
}

export const INPUT_SIZE = 640

export interface Detection {
  // Box in Original-Bildkoordinaten (px).
  x: number
  y: number
  w: number
  h: number
  score: number
  classId: number
  className: string
}

export interface LetterboxInfo {
  scale: number
  padX: number
  padY: number
}

// Frame (ImageBitmap/Canvas) → Float32 NCHW [1,3,640,640] mit Letterbox.
export function preprocess(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
): { data: Float32Array; info: LetterboxInfo } {
  const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH)
  const newW = Math.round(srcW * scale)
  const newH = Math.round(srcH * scale)
  const padX = Math.floor((INPUT_SIZE - newW) / 2)
  const padY = Math.floor((INPUT_SIZE - newH) / 2)

  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#727272' // neutrales Grau-Padding
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(source, padX, padY, newW, newH)
  const { data: rgba } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)

  const area = INPUT_SIZE * INPUT_SIZE
  const out = new Float32Array(3 * area)
  for (let i = 0; i < area; i++) {
    out[i] = rgba[i * 4] / 255 // R
    out[area + i] = rgba[i * 4 + 1] / 255 // G
    out[2 * area + i] = rgba[i * 4 + 2] / 255 // B
  }
  return { data: out, info: { scale, padX, padY } }
}

// Rohausgabe des Netzes [1, 4+nc, N] (ultralytics-Standard) → Detections.
export function decode(
  output: Float32Array,
  dims: readonly number[],
  info: LetterboxInfo,
  confThreshold = 0.25,
): Detection[] {
  // Output ist [1, channels, anchors] (ultralytics-Standard, channels=4+nc) oder
  // transponiert [1, anchors, channels]. channels ist die kleinere Dimension.
  const d1 = dims[1]
  const d2 = dims[2]
  const transposed = d1 > d2 // [1, anchors, channels]
  const channels = transposed ? d2 : d1
  const anchors = transposed ? d1 : d2
  const nc = channels - 4
  const dets: Detection[] = []

  // at(c,a): Wert von Kanal c bei Anker a, layout-unabhängig.
  const at = transposed
    ? (c: number, a: number) => output[a * channels + c]
    : (c: number, a: number) => output[c * anchors + a]

  for (let a = 0; a < anchors; a++) {
    let bestScore = 0
    let bestClass = -1
    for (let c = 0; c < nc; c++) {
      const s = at(4 + c, a)
      if (s > bestScore) {
        bestScore = s
        bestClass = c
      }
    }
    if (bestScore < confThreshold || bestClass < 0) continue

    const cx = at(0, a)
    const cy = at(1, a)
    const w = at(2, a)
    const h = at(3, a)
    // Letterbox rückrechnen → Original-Bildkoordinaten.
    const x = (cx - w / 2 - info.padX) / info.scale
    const y = (cy - h / 2 - info.padY) / info.scale
    dets.push({
      x,
      y,
      w: w / info.scale,
      h: h / info.scale,
      score: bestScore,
      classId: bestClass,
      className: CLASS_NAMES[bestClass] ?? String(bestClass),
    })
  }
  return nms(dets, 0.45)
}

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const union = a.w * a.h + b.w * b.h - inter
  return union > 0 ? inter / union : 0
}

// Klassenweise Non-Maximum-Suppression.
export function nms(dets: Detection[], iouThreshold: number): Detection[] {
  const sorted = [...dets].sort((p, q) => q.score - p.score)
  const keep: Detection[] = []
  for (const d of sorted) {
    if (keep.some((k) => k.classId === d.classId && iou(k, d) > iouThreshold)) continue
    keep.push(d)
  }
  return keep
}
