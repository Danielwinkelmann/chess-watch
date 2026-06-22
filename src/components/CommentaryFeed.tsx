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
