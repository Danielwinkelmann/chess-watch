import { Chess, type Move } from 'chess.js'

// Findet den legalen Zug, der aus der aktuellen Stellung die erkannte Belegung
// erzeugt. Vergleicht nur das Stellungsfeld (erstes FEN-Feld), da Vision keine
// Zugrechte/Zähler kennt. Gibt null zurück, wenn kein einzelner legaler Zug passt
// (häufig bei verrauschter Erkennung → Frame verwerfen).
export function detectMove(
  current: Chess,
  detectedPlacementField: string,
): Move | null {
  // Schon identisch? Kein neuer Zug.
  if (current.fen().split(' ')[0] === detectedPlacementField) return null

  const candidates: Move[] = []
  for (const move of current.moves({ verbose: true }) as Move[]) {
    const probe = new Chess(current.fen())
    probe.move(move)
    if (probe.fen().split(' ')[0] === detectedPlacementField) {
      candidates.push(move)
    }
  }
  // Genau ein eindeutiger legaler Zug → akzeptieren. Sonst (0 oder mehrdeutig)
  // verwerfen, um Fehlerkennungen nicht zu übernehmen.
  return candidates.length === 1 ? candidates[0] : null
}

// Stabilitäts-Tracker: akzeptiert eine erkannte Belegung erst, wenn sie über
// N aufeinanderfolgende Frames identisch war (dämpft Rauschen).
export class StabilityTracker {
  private last = ''
  private count = 0
  constructor(private readonly needed = 4) {}

  // Liefert das Stellungsfeld zurück, sobald es stabil ist – sonst null.
  push(placementField: string): string | null {
    if (placementField === this.last) {
      this.count++
    } else {
      this.last = placementField
      this.count = 1
    }
    return this.count === this.needed ? placementField : null
  }

  reset() {
    this.last = ''
    this.count = 0
  }
}
