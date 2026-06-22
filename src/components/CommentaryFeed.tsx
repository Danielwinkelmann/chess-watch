import type { CommentaryEntry } from '../game/useChessSession'
import type { MoveQuality } from '../engine/evaluation'

const QUALITY_BADGE: Record<MoveQuality, { label: string; color: string }> = {
  brilliant: { label: '!!', color: '#1abc9c' },
  best: { label: '!', color: '#2ecc71' },
  good: { label: '✓', color: '#95a5a6' },
  inaccuracy: { label: '?!', color: '#f1c40f' },
  mistake: { label: '?', color: '#e67e22' },
  blunder: { label: '??', color: '#e74c3c' },
}

export function CommentaryFeed({ entries }: { entries: CommentaryEntry[] }) {
  return (
    <div className="commentary">
      <h2>Kommentare</h2>
      {entries.length === 0 && <p className="muted">Noch keine Züge.</p>}
      <ol reversed>
        {[...entries].reverse().map((e) => {
          const badge = QUALITY_BADGE[e.quality]
          const moveNo = Math.floor(e.ply / 2) + 1
          const dots = e.ply % 2 === 0 ? '.' : '…'
          return (
            <li key={e.ply} className="commentary-item">
              <span className="commentary-move">
                {moveNo}{dots} {e.san}
              </span>
              <span className="commentary-badge" style={{ background: badge.color }}>
                {badge.label}
              </span>
              <span className={`commentary-text${e.pending ? ' pending' : ''}`}>
                {e.text}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
