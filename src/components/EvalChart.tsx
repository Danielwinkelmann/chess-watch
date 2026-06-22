import type { EvalPoint } from '../game/useChessSession'

// Bewertungsverlauf als Flächen-/Liniendiagramm (Lichess-Stil): Kurve = Gewinn-
// wahrscheinlichkeit Weiß. Fläche unter der Kurve = Weiß-Vorteil (hell), darüber
// = Schwarz-Vorteil (dunkel). Mattpunkte werden markiert.
const W = 600
const H = 200

export function EvalChart({ history }: { history: EvalPoint[] }) {
  if (history.length < 2) {
    return (
      <div className="chart-empty muted">
        Noch kein Verlauf – spiele Züge, um die Stärke-Kurve zu sehen.
      </div>
    )
  }

  const n = history.length
  const x = (i: number) => (n === 1 ? 0 : (i / (n - 1)) * W)
  const y = (wp: number) => H * (1 - wp)

  // Polylinien-Punkte der Kurve.
  const pts = history.map((p, i) => `${x(i)},${y(p.winProb)}`).join(' ')
  // Weiß-Fläche (Kurve bis Unterkante), Schwarz-Fläche (Kurve bis Oberkante).
  const whiteArea = `0,${H} ${pts} ${W},${H}`
  const blackArea = `0,0 ${pts} ${W},0`

  return (
    <div className="evalchart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="evalchart-svg">
        <polygon points={blackArea} fill="#2b3038" />
        <polygon points={whiteArea} fill="#e9edf2" />
        {/* Mittellinie = ausgeglichen */}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1} />
        {/* Kurve */}
        <polyline points={pts} fill="none" stroke="#1abc9c" strokeWidth={2} />
        {/* Mattpunkte markieren */}
        {history.map((p, i) =>
          p.mate !== null ? (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.winProb)}
              r={4}
              fill={p.mate > 0 ? '#e9edf2' : '#e74c3c'}
              stroke="#111418"
              strokeWidth={1}
            />
          ) : null,
        )}
      </svg>
      <div className="evalchart-axis">
        <span>Weiß</span>
        <span className="muted">Zug 1 → {n - 1}</span>
        <span>Schwarz</span>
      </div>
    </div>
  )
}
