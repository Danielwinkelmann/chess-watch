import { motion, AnimatePresence } from 'framer-motion'
import type { CommentaryEntry } from '../game/useChessSession'
import type { MoveQuality } from '../engine/evaluation'

// Farben aus der Modernhunter-Signalpalette (sparsam): Gold/Grün/Olive für gute
// Züge, Rot-Töne für Fehler.
const QUALITY_BADGE: Record<MoveQuality, { label: string; color: string }> = {
  brilliant: { label: '!!', color: '#dfb62a' }, // Gold
  best: { label: '!', color: '#28a745' }, // Grün
  good: { label: '✓', color: '#8e8b5e' }, // Olive
  inaccuracy: { label: '?!', color: '#a07b1f' }, // gedämpftes Gold
  mistake: { label: '?', color: '#9e2436' }, // gedämpftes Rot
  blunder: { label: '??', color: '#c70a33' }, // Rot
}

// bare = ohne eigene Panel-Box/Überschrift (eingebettet in ein anderes Panel).
export function CommentaryFeed({
  entries,
  bare = false,
}: {
  entries: CommentaryEntry[]
  bare?: boolean
}) {
  const body = (
    <>
      {entries.length === 0 && <p className="muted">Noch keine Züge.</p>}
      <ol reversed>
        <AnimatePresence initial={false}>
          {[...entries].reverse().map((e) => {
            const badge = QUALITY_BADGE[e.quality]
            const moveNo = Math.floor(e.ply / 2) + 1
            const dots = e.ply % 2 === 0 ? '.' : '…'
            return (
              <motion.li
                key={e.ply}
                layout
                className="commentary-item"
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                <span className="commentary-move">
                  {moveNo}{dots} {e.san}
                </span>
                <span className="commentary-badge" style={{ background: badge.color }}>
                  {badge.label}
                </span>
                <span className={`commentary-text${e.pending ? ' pending' : ''}`}>
                  {e.text}
                </span>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
    </>
  )

  if (bare) return <div className="commentary commentary-bare">{body}</div>
  return (
    <div className="commentary">
      <h2>Kommentare</h2>
      {body}
    </div>
  )
}
