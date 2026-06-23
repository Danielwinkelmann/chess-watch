import type { Detection } from './detect'
import { CLASS_TO_FEN } from './detect'
import { imageToBoardHomography, applyHomography, type Pt } from './homography'

// Belegung: 8 Reihen (rank 8 → 1) × 8 Spalten (file a → h), FEN-Zeichen oder null.
export type Placement = (string | null)[][]

export interface BoardMapping {
  placement: Placement
  boardBox: Detection
}

// Findet die wahrscheinlichste 'board'-Detection.
export function findBoard(dets: Detection[]): Detection | null {
  const boards = dets.filter((d) => d.className === 'board')
  if (!boards.length) return null
  return boards.sort((a, b) => b.score - a.score)[0]
}

// Ordnet Figuren dem 8×8-Raster zu. V1: gleichmäßiges Raster über die
// board-Box (gut für frontale/leicht schräge Sicht). Perspektiv-Entzerrung
// für steile Winkel ist als spätere Verbesserung vorgesehen.
//
// orientation: 'white' = a1 unten links (Weiß-Sicht), 'black' = gedreht.
export function mapDetectionsToBoard(
  dets: Detection[],
  orientation: 'white' | 'black' = 'white',
): BoardMapping | null {
  const board = findBoard(dets)
  if (!board) return null

  const cellW = board.w / 8
  const cellH = board.h / 8
  const placement: Placement = Array.from({ length: 8 }, () =>
    Array<string | null>(8).fill(null),
  )
  // Pro Zelle den Treffer mit höchstem Score behalten (Kollisionen auflösen).
  const cellScore: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0))

  for (const d of dets) {
    const fen = CLASS_TO_FEN[d.className]
    if (!fen) continue // board oder unbekannt
    // Basispunkt = Unterkante-Mitte der Box (Auflagepunkt der Figur).
    const baseX = d.x + d.w / 2
    const baseY = d.y + d.h
    let col = Math.floor((baseX - board.x) / cellW)
    let row = Math.floor((baseY - board.y) / cellH)
    if (col < 0 || col > 7 || row < 0 || row > 7) continue

    // Bildkoordinaten (row 0 = oben) → Schach-Raster.
    // Weiß-Sicht: oben = rank 8, links = file a.
    let rank = row // 0..7 von oben (rank 8) nach unten (rank 1)
    let file = col // 0..7 von links (a) nach rechts (h)
    if (orientation === 'black') {
      rank = 7 - rank
      file = 7 - file
    }
    if (d.score > cellScore[rank][file]) {
      cellScore[rank][file] = d.score
      placement[rank][file] = fen
    }
  }

  return { placement, boardBox: board }
}

// Perspektiv-korrekte Zuordnung über eine 4-Punkt-Kalibrierung (Homographie).
// corners: vier Brettecken im Bild in Reihenfolge TL, TR, BR, BL.
// Funktioniert bei beliebigem Winkel/Drehung.
export function mapDetectionsWithCorners(
  dets: Detection[],
  corners: Pt[],
  orientation: 'white' | 'black' = 'white',
): Placement {
  const H = imageToBoardHomography(corners)
  const placement: Placement = Array.from({ length: 8 }, () =>
    Array<string | null>(8).fill(null),
  )
  const cellScore: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0))

  for (const d of dets) {
    const fen = CLASS_TO_FEN[d.className]
    if (!fen) continue
    // Auflagepunkt (Unterkante-Mitte) ins Brettkoordinatensystem [0,8]² mappen.
    const [bx, by] = applyHomography(H, [d.x + d.w / 2, d.y + d.h])
    // Toleranz gegen leichte Eck-Ungenauigkeit: knapp außerhalb noch zulassen,
    // dann auf gültiges Feld klemmen.
    if (bx < -0.7 || bx > 8.7 || by < -0.7 || by > 8.7) continue
    let col = Math.min(7, Math.max(0, Math.floor(bx)))
    let row = Math.min(7, Math.max(0, Math.floor(by)))
    if (orientation === 'black') {
      col = 7 - col
      row = 7 - row
    }
    if (d.score > cellScore[row][col]) {
      cellScore[row][col] = d.score
      placement[row][col] = fen
    }
  }
  return placement
}
