import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { EvalPoint } from '../game/useChessSession'
import type { MoveQuality } from '../engine/evaluation'

const NAG_COLOR: Partial<Record<MoveQuality, string>> = {
  brilliant: '#dfb62a',
  inaccuracy: '#a07b1f',
  mistake: '#9e2436',
  blunder: '#c70a33',
}

export interface TimelineMarker {
  ply: number // 1..total
  quality: MoveQuality
}

const W = 1000
const H = 100

// Draggable Zeitleiste: Eval-Verlauf als Track, ziehbarer Playhead, Klick-zum-
// Springen, farbige Marker für auffällige Züge.
export function MoveTimeline({
  total,
  value,
  onChange,
  history,
  markers = [],
}: {
  total: number
  value: number
  onChange: (ply: number) => void
  history: EvalPoint[]
  markers?: TimelineMarker[]
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  function seek(clientX: number) {
    const el = trackRef.current
    if (!el || total <= 0) return
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onChange(Math.round(frac * total))
  }

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true)
    trackRef.current?.setPointerCapture(e.pointerId)
    seek(e.clientX)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragging) seek(e.clientX)
  }
  function onPointerUp(e: React.PointerEvent) {
    setDragging(false)
    trackRef.current?.releasePointerCapture(e.pointerId)
  }

  const n = Math.max(1, total)
  const pts = history.map((p, i) => `${(i / n) * W},${H * (1 - p.winProb)}`).join(' ')
  const whiteArea = `0,${H} ${pts} ${W},${H}`
  const blackArea = `0,0 ${pts} ${W},0`
  const handlePct = (value / n) * 100

  return (
    <div
      className={`timeline${dragging ? ' dragging' : ''}`}
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <svg className="timeline-track" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <polygon points={blackArea} fill="#252525" />
        <polygon points={whiteArea} fill="#e6e2d6" />
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#8e8b5e" strokeDasharray="6 6" strokeWidth={1} />
      </svg>

      {/* Marker für auffällige Züge */}
      {markers.map((m) => {
        const color = NAG_COLOR[m.quality]
        if (!color) return null
        return (
          <span
            key={m.ply}
            className="timeline-marker"
            style={{ left: `${(m.ply / n) * 100}%`, background: color }}
            title={`Zug ${m.ply}`}
          />
        )
      })}

      {/* Playhead */}
      <motion.div
        className="timeline-playhead"
        style={{ left: `${handlePct}%` }}
        animate={{ left: `${handlePct}%` }}
        transition={dragging ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }}
      >
        <motion.span
          className="timeline-knob"
          animate={{ scale: dragging ? 1.25 : 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        />
      </motion.div>

      <span className="timeline-count">
        {value} / {total}
      </span>
    </div>
  )
}
