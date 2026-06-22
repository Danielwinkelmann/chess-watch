import {
  formatEval,
  winProbability,
  type Evaluation,
} from '../engine/evaluation'
import type { EvalPoint } from '../game/useChessSession'
import { EvalChart } from './EvalChart'
import { MateIndicator } from './MateIndicator'

export function AnalysisPanel({
  evaluation,
  history,
}: {
  evaluation: Evaluation
  history: EvalPoint[]
}) {
  const wp = winProbability(evaluation)
  const whitePct = Math.round(wp * 100)
  const leader =
    Math.abs(wp - 0.5) < 0.03
      ? 'Ausgeglichen'
      : wp > 0.5
        ? 'Weiß ist stärker'
        : 'Schwarz ist stärker'

  return (
    <div className="analysis">
      <div className="analysis-head">
        <div className="analysis-stat">
          <span className="muted">Bewertung</span>
          <strong className="analysis-eval">{formatEval(evaluation)}</strong>
        </div>
        <div className="analysis-stat">
          <span className="muted">Tiefe</span>
          <strong>{evaluation.depth || '–'}</strong>
        </div>
        <div className="analysis-stat">
          <span className="muted">Gewinnchance</span>
          <strong>
            {whitePct}% / {100 - whitePct}%
          </strong>
        </div>
      </div>

      <div className="analysis-leader">{leader}</div>

      <MateIndicator evaluation={evaluation} />

      <h2>Stärke-Verlauf</h2>
      <EvalChart history={history} />
    </div>
  )
}
