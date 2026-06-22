import { motion } from 'framer-motion'
import { evalBarFraction, formatEval, type Evaluation } from '../engine/evaluation'

// Vertikaler Balken: Weiß-Anteil unten, Schwarz oben (animiert).
export function EvalBar({ evaluation }: { evaluation: Evaluation }) {
  const whiteFrac = evalBarFraction(evaluation)
  const whitePct = Math.round(whiteFrac * 100)
  return (
    <div className="evalbar" title={`Bewertung: ${formatEval(evaluation)}`}>
      <motion.div
        className="evalbar-black"
        animate={{ height: `${100 - whitePct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
      <motion.div
        className="evalbar-white"
        animate={{ height: `${whitePct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
      <span className="evalbar-label">{formatEval(evaluation)}</span>
    </div>
  )
}
