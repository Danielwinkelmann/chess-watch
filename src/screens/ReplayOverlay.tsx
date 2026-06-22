import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Arrow } from 'react-chessboard'
import { BoardView } from '../components/BoardView'
import { LineChart } from '../ui/LineChart'
import { Icon } from '../ui/icons'
import { QUALITY, MARKER_COLOR, ACCENT } from '../ui/quality'
import { formatEval } from '../engine/evaluation'
import { useEngineAnalysis } from '../game/useEngineAnalysis'
import type { Game } from '../storage/db'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function ReplayOverlay({ game, onClose }: { game: Game; onClose: () => void }) {
  const moves = game.moves
  const total = moves.length
  const [ply, setPly] = useState(total)
  const [playing, setPlaying] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const cur = ply === 0 ? null : moves[ply - 1]
  const fen = cur?.fenAfter ?? START_FEN
  const analysis = useEngineAnalysis(fen, true)
  const arrows: Arrow[] = analysis.bestUci
    ? [{ startSquare: analysis.bestUci.slice(0, 2), endSquare: analysis.bestUci.slice(2, 4), color: ACCENT }]
    : []

  // Auto-Play
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      setPly((p) => {
        if (p >= total) { setPlaying(false); return p }
        return p + 1
      })
    }, 950)
    return () => clearInterval(t)
  }, [playing, total])

  // Sparkline bis zum aktuellen Halbzug
  const spk = [{ x: 0, v: 0 }].concat(
    moves.slice(0, ply).map((m, i) => ({
      x: i + 1,
      v: Math.max(-7, Math.min(7, m.mate !== null ? (m.mate > 0 ? 7 : -7) : (m.cp ?? 0) / 100)),
    })),
  )
  while (spk.length < 2) spk.push({ x: 1, v: 0 })

  const markers = moves
    .map((m, i) => (m.quality && MARKER_COLOR[m.quality] ? { i: i + 1, color: MARKER_COLOR[m.quality]! } : null))
    .filter(Boolean) as { i: number; color: string }[]

  function seek(clientX: number) {
    const el = trackRef.current
    if (!el || total <= 0) return
    const r = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    setPly(Math.round(frac * total))
    setPlaying(false)
  }

  const pct = total > 0 ? (ply / total) * 100 : 0
  const lc = cur?.quality ? QUALITY[cur.quality] : null
  const winLabel = formatEval(analysis.evaluation ?? { cp: cur?.cp ?? 0, mate: cur?.mate ?? null, depth: 0 })

  return (
    <div className="cw-replay">
      <div className="cw-replay-head">
        <button className="cw-iconbtn" onClick={onClose}>{Icon.back({ size: 18 })}</button>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.name}</span>
          <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>Replay · Halbzug {ply}/{total}</span>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{winLabel}</span>
      </div>

      <div className="cw-replay-body">
        <div className="cw-replay-board">
          <BoardView fen={fen} allowDragging={false} arrows={arrows} />
        </div>

        <div style={{ width: '100%', maxWidth: 460 }} className="cw-card">
          <div style={{ fontSize: 11, color: 'var(--muted-2)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 6 }}>Eval-Verlauf</div>
          <LineChart series={[{ data: spk, color: ACCENT, w: 2, fill: ACCENT, fillOpacity: 0.14 }]} opts={{ w: 340, h: 64, xMax: Math.max(1, total), ymin: -7, ymax: 7, zero: 0 }} />
        </div>

        <div style={{ width: '100%', maxWidth: 460 }} className="cw-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{cur?.san ?? '–'}</span>
            {lc && <span className="cw-badge" style={{ background: lc.bg, color: lc.fg, gap: 5, padding: '4px 9px' }}>{lc.sym} {lc.label}</span>}
            <span style={{ flex: 1 }} />
            {analysis.bestSan && <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>Best: {analysis.bestSan}</span>}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)', margin: '11px 0 0' }}>
            {cur?.comment ?? 'Ausgangsstellung – nutze die Zeitleiste oder ▶, um die Partie abzuspielen.'}
          </p>
        </div>
      </div>

      <div className="cw-replay-foot">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
            <span className="cw-section-label" style={{ fontSize: 11, letterSpacing: '1.4px' }}>— Zeitleiste</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Halbzug {ply} / {total}</span>
          </div>
          <div
            className="cw-tl"
            ref={trackRef}
            onPointerDown={(e) => { setDragging(true); trackRef.current?.setPointerCapture(e.pointerId); seek(e.clientX) }}
            onPointerMove={(e) => dragging && seek(e.clientX)}
            onPointerUp={(e) => { setDragging(false); trackRef.current?.releasePointerCapture(e.pointerId) }}
          >
            <div className="cw-tl-track" />
            <div className="cw-tl-fill" style={{ width: `${pct}%` }} />
            {markers.map((m) => (
              <div key={m.i} className="cw-tl-marker" style={{ left: `${(m.i / total) * 100}%`, background: m.color }} onClick={(e) => { e.stopPropagation(); setPly(m.i); setPlaying(false) }} />
            ))}
            <motion.div className="cw-tl-knob" style={{ left: `${pct}%` }} animate={{ left: `${pct}%` }} transition={dragging ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }} />
          </div>
          <div className="cw-tl-legend">
            <span><i style={{ background: ACCENT }} />Glanzzug</span>
            <span><i style={{ background: '#dfb62a' }} />Ungenau</span>
            <span><i style={{ background: '#c70a33' }} />Fehler</span>
            <span><i style={{ background: '#8f0a26' }} />Patzer</span>
          </div>
        </div>

        <div className="cw-transport">
          <button className="side" onClick={() => { setPly(0); setPlaying(false) }}>{Icon.first({ size: 20 })}</button>
          <button className="mid" onClick={() => { setPly((p) => Math.max(0, p - 1)); setPlaying(false) }}>{Icon.prev({ size: 18 })} Zurück</button>
          <button className="play" onClick={() => setPlaying((p) => !p)}>{playing ? Icon.pause() : Icon.play()}</button>
          <button className="mid" onClick={() => setPly((p) => Math.min(total, p + 1))}>Vor {Icon.next({ size: 18 })}</button>
          <button className="side" onClick={() => { setPly(total); setPlaying(false) }}>{Icon.last({ size: 20 })}</button>
        </div>
      </div>
    </div>
  )
}
