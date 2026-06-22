import { evalBarFraction, formatEval, type Evaluation } from '../engine/evaluation'

// Vertikaler Balken: Weiß-Anteil unten, Schwarz oben.
export function EvalBar({ evaluation }: { evaluation: Evaluation }) {
  const whiteFrac = evalBarFraction(evaluation)
  const whitePct = Math.round(whiteFrac * 100)
  return (
    <div className="evalbar" title={`Bewertung: ${formatEval(evaluation)}`}>
      <div className="evalbar-black" style={{ height: `${100 - whitePct}%` }} />
      <div className="evalbar-white" style={{ height: `${whitePct}%` }} />
      <span className="evalbar-label">{formatEval(evaluation)}</span>
    </div>
  )
}
