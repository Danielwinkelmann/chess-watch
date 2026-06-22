import type { Detection } from './detect'
import { CLASS_TO_FEN } from './detect'

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
