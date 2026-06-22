import type { Evaluation } from '../engine/evaluation'

// Zeigt eine Matt-Drohung als Skala M5 M4 M3 M2 M1 an. Die aktuelle Mattdistanz
// wird hervorgehoben; Farbe nach mattsetzender Seite.
const STEPS = [5, 4, 3, 2, 1]

export function MateIndicator({ evaluation }: { evaluation: Evaluation }) {
  const mate = evaluation.mate
  const delivered = mate === 0 // Schachmatt steht bereits auf dem Brett
  const active = mate !== null && mate !== 0
  const n = active ? Math.abs(mate!) : null
  const whiteMates = active && mate! > 0

  return (
    <div className={`mate ${active ? (whiteMates ? 'mate-white' : 'mate-black') : 'mate-none'}`}>
      <div className="mate-head">
        {delivered ? (
          <strong>Schachmatt!</strong>
        ) : active ? (
          <strong>
            {whiteMates ? 'Weiß' : 'Schwarz'} setzt matt in {n}
            {n! > 5 ? ' Zügen' : ''}
          </strong>
        ) : (
          <span className="muted">Kein Matt in Sicht</span>
        )}
      </div>
      <div className="mate-scale">
        {STEPS.map((step) => {
          const isActive = active && n === step
          const inDanger = active && n! <= step // M5..M1 leuchten bis zur Distanz auf
          return (
            <div
              key={step}
              className={`mate-step${isActive ? ' active' : ''}${inDanger ? ' danger' : ''}`}
              title={`Matt in ${step}`}
            >
              M{step}
            </div>
          )
        })}
      </div>
    </div>
  )
}
