import { motion, AnimatePresence } from 'framer-motion'
import { formatEval } from '../engine/evaluation'
import { QUALITY, evalColor } from '../ui/quality'
import type { SessionState } from '../game/useChessSession'

export function FeedScreen({ state }: { state: SessionState }) {
  const items = [...state.commentary].reverse()
  return (
    <div className="cw-pad">
      <div className="cw-screen-head">
        <div className="stack">
          <span className="cw-section-label">— Live-Feed</span>
          <h1 className="cw-h1">Live-<span className="accent">Kommentar</span></h1>
        </div>
        <span className="count">{state.commentary.length} Züge</span>
      </div>
      <div className="cw-feed">
        {items.length === 0 && <span className="cw-hint">Noch keine Züge – starte eine Partie im Live-Tab.</span>}
        <AnimatePresence initial={false}>
          {items.map((f) => {
            const q = QUALITY[f.quality]
            const pawns = (f.cp ?? 0) / 100
            const no = f.side === 'w' ? `${Math.floor(f.ply / 2) + 1}.` : `${Math.floor(f.ply / 2) + 1}…`
            return (
              <motion.div
                key={f.ply}
                layout
                className="cw-feed-card"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                <div className="cw-feed-top">
                  <span className="sidedot" style={{ flex: 'none', width: 8, height: 8, borderRadius: 99, background: f.side === 'w' ? '#edeae0' : '#171311', boxShadow: '0 0 0 1px var(--border)' }} />
                  <span style={{ fontSize: 12, color: 'var(--muted-2)', minWidth: 30 }}>{no}</span>
                  <span className="san">{f.san}</span>
                  <span className="cw-badge" style={{ background: q.bg, color: q.fg, gap: 4, padding: '3px 9px' }}>
                    {q.sym} {q.label}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: evalColor(pawns) }}>
                    {f.pending ? '…' : formatEval({ cp: f.cp, mate: f.mate, depth: 0 })}
                  </span>
                </div>
                <p className="cw-feed-comment">{f.text}</p>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
