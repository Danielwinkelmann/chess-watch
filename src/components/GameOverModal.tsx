import { motion, AnimatePresence } from 'framer-motion'
import type { CommentaryEntry, GameResult } from '../game/useChessSession'
import type { MoveQuality } from '../engine/evaluation'
import { QUALITY } from '../ui/quality'

const ROWS: { q: MoveQuality; label: string }[] = [
  { q: 'brilliant', label: 'Glanzzüge' },
  { q: 'inaccuracy', label: 'Ungenau' },
  { q: 'mistake', label: 'Fehler' },
  { q: 'blunder', label: 'Patzer' },
]

function counts(entries: CommentaryEntry[], side: 'w' | 'b', q: MoveQuality) {
  return entries.filter((e) => e.side === side && e.quality === q).length
}

export function GameOverModal({
  open, result, commentary, moveCount, onNewGame, onSave, onClose,
}: {
  open: boolean
  result: GameResult
  commentary: CommentaryEntry[]
  moveCount: number
  onNewGame: () => void
  onSave: () => void
  onClose: () => void
}) {
  const isMate = result?.type === 'checkmate'
  const winner = isMate ? result.winner : null
  const headline = isMate ? (winner === 'white' ? 'Weiß gewinnt' : 'Schwarz gewinnt') : 'Remis'
  const crown = isMate ? (winner === 'white' ? '♔' : '♚') : '½'
  const full = Math.ceil(moveCount / 2)

  return (
    <AnimatePresence>
      {open && result && (
        <motion.div className="cw-over" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="cw-over-card"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div className="cw-over-crown" initial={{ scale: 0, rotate: -18 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 13, delay: 0.08 }}>
              {crown}
            </motion.div>
            <div className="cw-over-title">{headline}</div>
            <div className="cw-over-sub">{isMate ? `Schachmatt nach ${full} Zügen` : `${result.reason} nach ${full} Zügen`}</div>

            <div className="cw-over-table">
              <span className="cw-over-th">— Übersicht</span>
              <span className="cw-over-th r">Weiß</span>
              <span className="cw-over-th r">Schwarz</span>
              {ROWS.map((r) => (
                <div key={r.q} style={{ display: 'contents' }}>
                  <span className="cw-over-rl"><b style={{ color: QUALITY[r.q].bg }}>{QUALITY[r.q].sym}</b> {r.label}</span>
                  <span className="cw-over-n">{counts(commentary, 'w', r.q)}</span>
                  <span className="cw-over-n">{counts(commentary, 'b', r.q)}</span>
                </div>
              ))}
            </div>

            <div className="cw-over-actions">
              <button className="ui-btn primary" onClick={onSave}>Partie speichern</button>
              <button className="ui-btn" onClick={onNewGame}>Neue Partie</button>
              <button className="ui-btn ghost" onClick={onClose}>Schließen</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
