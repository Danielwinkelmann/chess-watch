import type { Placement } from './board'

// 8×8-Belegung → FEN-Stellungsfeld (nur das erste FEN-Feld, ohne Zugrecht etc.).
// placement[0] = rank 8 (oben), placement[7] = rank 1 (unten).
export function placementToFenField(placement: Placement): string {
  return placement
    .map((rank) => {
      let row = ''
      let empty = 0
      for (const cell of rank) {
        if (cell === null) {
          empty++
        } else {
          if (empty) {
            row += empty
            empty = 0
          }
          row += cell
        }
      }
      if (empty) row += empty
      return row
    })
    .join('/')
}

// Vergleicht nur das Stellungsfeld zweier FENs (ignoriert Zugrecht/Rochade/Zähler).
export function samePlacement(fenA: string, fenB: string): boolean {
  return fenA.split(' ')[0] === fenB.split(' ')[0]
}

// Vollständige (Pseudo-)FEN aus einer Belegung bauen. Zugrecht ist aus dem Bild
// nicht ableitbar → Standardwerte; die echte Zugfolge übernimmt chess.js in der
// Zug-Erkennung.
export function placementToFen(placement: Placement, sideToMove: 'w' | 'b' = 'w'): string {
  return `${placementToFenField(placement)} ${sideToMove} - - 0 1`
}
