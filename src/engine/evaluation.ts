// Bewertung einer Stellung aus Stockfish-Sicht.
export interface Evaluation {
  // Centipawns aus Sicht von Weiß (positiv = Vorteil Weiß). null bei Matt.
  cp: number | null
  // Matt in N Halbzügen aus Sicht von Weiß (positiv = Weiß mattt). null sonst.
  mate: number | null
  depth: number
  bestMove?: string // UCI, z. B. "e2e4"
  pv?: string[] // Hauptvariante (UCI)
}

// cp (aus Sicht der ziehenden Seite) → cp aus Sicht von Weiß umrechnen.
export function toWhitePov(value: number, sideToMove: 'w' | 'b'): number {
  return sideToMove === 'w' ? value : -value
}

// Bewertung → einheitlicher cp-Wert aus Weiß-Sicht. Matt wird als sehr großer
// Betrag dargestellt (kürzeres Matt = extremer), damit Delta/Klassifikation auch
// bei Matt korrekt sind.
const MATE_CP = 100000
export function evalToWhiteCp(ev: Evaluation): number {
  // mate===0 = Schachmatt steht auf dem Brett → Sieger steckt im cp-Wert.
  if (ev.mate !== null && ev.mate !== 0) {
    return ev.mate > 0 ? MATE_CP - ev.mate : -MATE_CP - ev.mate
  }
  return ev.cp ?? 0
}

// Gewinnwahrscheinlichkeit für Weiß in [0,1] (Lichess-Logistik).
export function winProbability(ev: Evaluation): number {
  // mate===0 = Schachmatt auf dem Brett → Sieger über cp (±groß) bestimmen.
  if (ev.mate !== null && ev.mate !== 0) return ev.mate > 0 ? 1 : 0
  if (ev.cp === null) return 0.5
  return 1 / (1 + Math.exp(-0.00368208 * ev.cp))
}

// Eval-Bar-Anteil Weiß in [0,1] (für die Balkenhöhe).
export function evalBarFraction(ev: Evaluation): number {
  return winProbability(ev)
}

// Menschlich lesbarer Bewertungstext, z. B. "+1.3" oder "M3".
export function formatEval(ev: Evaluation): string {
  if (ev.mate !== null) {
    if (ev.mate === 0) return 'Matt'
    return `M${Math.abs(ev.mate)}${ev.mate < 0 ? ' ♚' : ''}`
  }
  if (ev.cp === null) return '0.0'
  const pawns = ev.cp / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`
}

// Klassifikation eines Zugs anhand des Bewertungs-Deltas (aus Sicht der
// ziehenden Seite, in Centipawns). Heuristik-Fallback für Kommentare.
export type MoveQuality =
  | 'brilliant'
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'

export function classifyMove(deltaCp: number): MoveQuality {
  // deltaCp < 0 = Stellung hat sich für die ziehende Seite verschlechtert.
  if (deltaCp <= -300) return 'blunder'
  if (deltaCp <= -150) return 'mistake'
  if (deltaCp <= -60) return 'inaccuracy'
  if (deltaCp >= 80) return 'brilliant'
  if (deltaCp >= 20) return 'best'
  return 'good'
}
