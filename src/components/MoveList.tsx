import { motion } from 'framer-motion'
import type { CommentaryEntry } from '../game/useChessSession'
import type { MoveQuality } from '../engine/evaluation'

// NAG-Symbol + Farbe je Zugqualität.
const NAG: Record<MoveQuality, { sym: string; color: string }> = {
  brilliant: { sym: '!!', color: '#dfb62a' },
  best: { sym: '!', color: '#28a745' },
  good: { sym: '', color: 'transparent' },
  inaccuracy: { sym: '?!', color: '#a07b1f' },
  mistake: { sym: '?', color: '#9e2436' },
  blunder: { sym: '??', color: '#c70a33' },
}

interface Row {
  no: number
  white?: CommentaryEntry
  black?: CommentaryEntry
}

function toRows(entries: CommentaryEntry[]): Row[] {
  const rows: Row[] = []
  for (const e of entries) {
    const no = Math.floor(e.ply / 2) + 1
    let row = rows.find((r) => r.no === no)
    if (!row) {
      row = { no }
      rows.push(row)
    }
    if (e.ply % 2 === 0) row.white = e
    else row.black = e
  }
  return rows
}

function MoveCell({ entry }: { entry?: CommentaryEntry }) {
  if (!entry) return <span />
  const nag = NAG[entry.quality]
  return (
    <motion.button
      className="movelist-move"
      title={entry.text}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
    >
      {entry.san}
      {nag.sym && (
        <span className="movelist-nag" style={{ color: nag.color }}>
          {nag.sym}
        </span>
      )}
    </motion.button>
  )
}

export function MoveList({ entries }: { entries: CommentaryEntry[] }) {
  if (entries.length === 0) {
    return <p className="movelist-empty muted">Noch keine Züge.</p>
  }
  const rows = toRows(entries)
  return (
    <div className="movelist">
      <div className="movelist-table">
        {rows.map((r) => (
          <div key={r.no} style={{ display: 'contents' }}>
            <span className="movelist-no">{r.no}.</span>
            <MoveCell entry={r.white} />
            <MoveCell entry={r.black} />
          </div>
        ))}
      </div>
    </div>
  )
}
