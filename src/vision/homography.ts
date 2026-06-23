// Projektive Transformation (Homographie) aus 4 Punktkorrespondenzen.
// Wird genutzt, um ein perspektivisch/gedreht fotografiertes Brett zu entzerren:
// Bildpunkt → Brettkoordinate in [0,8]² (Feld = floor).

export type Pt = [number, number]
export type Mat3 = number[] // 9 Werte, row-major

// Löst A·x = b (n×n) per Gauß mit Teilpivotisierung.
function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    ;[M[col], M[piv]] = [M[piv], M[col]]
    const d = M[col][col] || 1e-9
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / d
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-9))
}

// Homographie H mit src→dst (je 4 Punkte). dst = H · src (homogen).
export function computeHomography(src: Pt[], dst: Pt[]): Mat3 {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = solve(A, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

export function applyHomography(H: Mat3, [x, y]: Pt): Pt {
  const w = H[6] * x + H[7] * y + H[8]
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]
}

// Homographie, die Bildpunkte → Brettkoordinaten [0,8]² abbildet.
// corners = 4 Brettecken im Bild, Reihenfolge: TL, TR, BR, BL (aus Sicht des
// Betrachters, „oben" = 8. Reihe bei weißer Orientierung).
export function imageToBoardHomography(corners: Pt[]): Mat3 {
  const dst: Pt[] = [
    [0, 0],
    [8, 0],
    [8, 8],
    [0, 8],
  ]
  return computeHomography(corners, dst)
}
