import { motion } from 'framer-motion'
import type { Chess } from 'chess.js'
import { BoardView } from '../components/BoardView'
import { CameraView } from '../components/CameraView'
import { formatEval, evalBarFraction } from '../engine/evaluation'
import { QUALITY } from '../ui/quality'
import { evalColor } from '../ui/quality'
import { Icon } from '../ui/icons'
import type { SessionState } from '../game/useChessSession'

export function LiveScreen({
  chess,
  state,
  visionReady,
  liveView,
  setLiveView,
  onVisionMove,
  onManualMove,
  onShowFeed,
}: {
  chess: Chess
  state: SessionState
  visionReady: boolean
  liveView: 'camera' | 'board'
  setLiveView: (v: 'camera' | 'board') => void
  onVisionMove: (m: { from: string; to: string; promotion?: string }) => Promise<boolean>
  onManualMove: (from: string, to: string) => boolean
  onShowFeed: () => void
}) {
  const whitePct = Math.round(evalBarFraction(state.evaluation) * 100)
  const recent = [...state.commentary].slice(-6).reverse()

  return (
    <div className="cw-pad">
      <div className="cw-seg" style={{ marginBottom: 14 }}>
        <button className={liveView === 'camera' ? 'active' : ''} onClick={() => setLiveView('camera')}>
          {Icon.camera({ size: 16 })} Kamera
        </button>
        <button className={liveView === 'board' ? 'active' : ''} onClick={() => setLiveView('board')}>
          {Icon.board({ size: 16 })} Brett
        </button>
      </div>

      {liveView === 'camera' ? (
        <CameraView chess={chess} visionReady={visionReady} orientation="white" onMove={onVisionMove} />
      ) : (
        <div className="cw-boardrow">
          <div className="cw-evalbar-wrap">
            <span className="cw-evalbar-top">{formatEval(state.evaluation)}</span>
            <div className="cw-evalbar">
              <motion.div className="white" animate={{ height: `${whitePct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
              <span className="mid" />
            </div>
          </div>
          <div className="cw-board-panel">
            <BoardView fen={state.fen} onMove={onManualMove} />
          </div>
        </div>
      )}

      {/* Letzte Züge */}
      <div className="cw-card cw-moves-card">
        <div className="cw-moves-head">
          <span className="cw-section-label">— Letzte Züge</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {recent.length === 0 && <span className="cw-hint">Noch keine Züge.</span>}
          {recent.map((m) => {
            const q = QUALITY[m.quality]
            const pawns = (m.cp ?? 0) / 100
            const no = m.side === 'w' ? `${Math.floor(m.ply / 2) + 1}.` : `${Math.floor(m.ply / 2) + 1}…`
            return (
              <button key={m.ply} className="cw-moverow" onClick={onShowFeed}>
                <span className="sidedot" style={{ background: m.side === 'w' ? '#edeae0' : '#171311' }} />
                <span className="no">{no}</span>
                <span className="san">{m.san}</span>
                <span className="cw-badge" style={{ background: q.bg, color: q.fg }}>{q.sym}</span>
                <span style={{ flex: 1 }} />
                <span className="eval" style={{ color: evalColor(pawns) }}>
                  {m.pending ? '…' : formatEval({ cp: m.cp, mate: m.mate, depth: 0 })}
                </span>
              </button>
            )
          })}
        </div>
        <div className="cw-hint">
          Volle Kommentare &amp; Analyse im <span className="accent" onClick={onShowFeed} style={{ cursor: 'pointer' }}>Kommentar</span>-Tab
        </div>
      </div>
    </div>
  )
}
