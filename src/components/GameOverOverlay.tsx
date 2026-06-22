import { motion, AnimatePresence } from 'framer-motion'
import type { CommentaryEntry, EvalPoint, GameResult } from '../game/useChessSession'
import type { MoveQuality } from '../engine/evaluation'
import { EvalChart } from './EvalChart'

// Qualitäts-Kategorien für die Übersicht (Symbol + Label + Farbe).
const ROWS: { q: MoveQuality; sym: string; label: string; color: string }[] = [
  { q: 'brilliant', sym: '!!', label: 'Glanzzüge', color: '#dfb62a' },
  { q: 'best', sym: '!', label: 'Starke Züge', color: '#28a745' },
  { q: 'inaccuracy', sym: '?!', label: 'Ungenauigkeiten', color: '#a07b1f' },
  { q: 'mistake', sym: '?', label: 'Fehler', color: '#9e2436' },
  { q: 'blunder', sym: '??', label: 'Patzer', color: '#c70a33' },
]

type SideCounts = Record<MoveQuality, number>
const emptyCounts = (): SideCounts => ({
  brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0,
})

function countByside(entries: CommentaryEntry[]) {
  const white = emptyCounts()
  const black = emptyCounts()
  for (const e of entries) {
    ;(e.ply % 2 === 0 ? white : black)[e.quality]++
  }
  return { white, black }
}

export function GameOverOverlay({
  result,
  commentary,
  evalHistory,
  moveCount,
  onNewGame,
  onSave,
  onClose,
}: {
  result: GameResult
  commentary: CommentaryEntry[]
  evalHistory: EvalPoint[]
  moveCount: number
  onNewGame: () => void
  onSave: () => void
  onClose: () => void
}) {
  const open = result !== null
  const { white, black } = countByside(commentary)
  const fullMoves = Math.ceil(moveCount / 2)

  const isMate = result?.type === 'checkmate'
  const winner = isMate ? result.winner : null
  const headline = isMate
    ? winner === 'white'
      ? 'Weiß gewinnt'
      : 'Schwarz gewinnt'
    : 'Remis'
  const crown = isMate ? (winner === 'white' ? '♔' : '♚') : '½'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`overlay-card${isMate ? ` win-${winner}` : ' win-draw'}`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="overlay-crown"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
            >
              {crown}
            </motion.div>
            <h2 className="overlay-title">{headline}</h2>
            <p className="overlay-sub">
              {isMate
                ? `Schachmatt nach ${fullMoves} Zügen`
                : `${result?.reason ?? 'Unentschieden'} nach ${fullMoves} Zügen`}
            </p>

            <div className="overlay-overview">
              <div className="overlay-table">
                <span className="label">— Übersicht</span>
                <span className="overlay-col">Weiß</span>
                <span className="overlay-col">Schwarz</span>
                {ROWS.map((r) => (
                  <div key={r.q} style={{ display: 'contents' }}>
                    <span className="overlay-row-label">
                      <b style={{ color: r.color }}>{r.sym}</b> {r.label}
                    </span>
                    <span className="overlay-num">{white[r.q]}</span>
                    <span className="overlay-num">{black[r.q]}</span>
                  </div>
                ))}
              </div>

              <div className="overlay-chart">
                <span className="label">— Stärke-Verlauf</span>
                <EvalChart history={evalHistory} />
              </div>
            </div>

            <div className="overlay-actions">
              <motion.button whileTap={{ scale: 0.96 }} className="primary" onClick={onNewGame}>
                Neue Partie
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={onSave}>
                Partie speichern
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} className="ghost" onClick={onClose}>
                Schließen
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
