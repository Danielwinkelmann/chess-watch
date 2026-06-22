import { formatEval } from '../engine/evaluation'
import type { MoveQuality } from '../engine/evaluation'
import { LineChart, type Series } from '../ui/LineChart'
import { QUALITY, evalColor, ACCENT } from '../ui/quality'
import type { CommentaryEntry, SessionState } from '../game/useChessSession'

const PENALTY: Record<MoveQuality, number> = {
  brilliant: 0, best: 0, good: 1, inaccuracy: 6, mistake: 14, blunder: 28,
}
const ELO: Record<MoveQuality, number> = {
  brilliant: 2450, best: 2150, good: 1950, inaccuracy: 1650, mistake: 1400, blunder: 1100,
}

function sideStats(entries: CommentaryEntry[], side: 'w' | 'b') {
  const mine = entries.filter((e) => e.side === side && !e.pending)
  if (!mine.length) return { acc: '–', elo: '–', bril: 0 }
  const penalty = mine.reduce((s, e) => s + PENALTY[e.quality], 0)
  const acc = Math.max(35, Math.min(100, Math.round(100 - penalty)))
  const elo = Math.round(mine.reduce((s, e) => s + ELO[e.quality], 0) / mine.length)
  const bril = mine.filter((e) => e.quality === 'brilliant').length
  return { acc: String(acc), elo: String(elo), bril }
}

export function AnalysisScreen({ state, onOpenReplay }: { state: SessionState; onOpenReplay: () => void }) {
  const c = state.commentary
  const w = sideStats(c, 'w')
  const b = sideStats(c, 'b')

  // Stärke-Verlauf (geschätztes Elo je Zug, getrennt nach Seite)
  const wData: { x: number; v: number }[] = []
  const bData: { x: number; v: number }[] = []
  c.forEach((e) => {
    const mn = Math.floor(e.ply / 2) + 1
    if (e.side === 'w') wData.push({ x: mn, v: ELO[e.quality] })
    else bData.push({ x: mn, v: ELO[e.quality] })
  })
  const totalMoves = Math.max(1, Math.ceil(c.length / 2))
  const strengthSeries: Series[] = [
    { data: wData, color: '#edeae0', w: 2 },
    { data: bData, color: ACCENT, w: 2 },
  ]

  // Stellungsbewertung
  const eData = state.evalHistory.map((p) => ({
    x: p.ply,
    v: Math.max(-7, Math.min(7, p.mate !== null ? (p.mate > 0 ? 7 : -7) : (p.cp ?? 0) / 100)),
  }))

  // Zugpaar-Tabelle
  const pairs: { no: number; w?: CommentaryEntry; b?: CommentaryEntry }[] = []
  c.forEach((e) => {
    const no = Math.floor(e.ply / 2) + 1
    let row = pairs.find((p) => p.no === no)
    if (!row) { row = { no }; pairs.push(row) }
    if (e.side === 'w') row.w = e
    else row.b = e
  })

  const cell = (e?: CommentaryEntry) => {
    if (!e) return <div className="cw-mt-cell" />
    const pawns = (e.cp ?? 0) / 100
    return (
      <div className="cw-mt-cell">
        <span className="san">{e.san}</span>
        <span className="dot" style={{ background: QUALITY[e.quality].bg }} />
        <span style={{ flex: 1 }} />
        <span className="eval" style={{ color: evalColor(pawns) }}>
          {e.pending ? '…' : formatEval({ cp: e.cp, mate: e.mate, depth: 0 })}
        </span>
      </div>
    )
  }

  return (
    <div className="cw-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="cw-section-label">— Partie-Auswertung</span>
        <h1 className="cw-h1">Analyse</h1>
      </div>

      {c.length === 0 && <span className="cw-hint">Noch keine Züge – spiele eine Partie im Live-Tab.</span>}

      <div className="cw-acc-row">
        <div className="cw-acc">
          <div className="cw-acc-head"><span className="dot" style={{ background: '#edeae0' }} />Weiß</div>
          <div className="cw-acc-big" style={{ color: ACCENT }}>{w.acc}<small>%</small></div>
          <div className="cw-acc-cap">Genauigkeit</div>
          <div className="cw-acc-sub">Ø ~{w.elo} Elo · {w.bril} Glanzzüge</div>
        </div>
        <div className="cw-acc">
          <div className="cw-acc-head"><span className="dot" style={{ background: '#3a3531' }} />Schwarz</div>
          <div className="cw-acc-big" style={{ color: 'var(--text-2)' }}>{b.acc}<small>%</small></div>
          <div className="cw-acc-cap">Genauigkeit</div>
          <div className="cw-acc-sub">Ø ~{b.elo} Elo · {b.bril} Glanzzüge</div>
        </div>
      </div>

      <div className="cw-panel">
        <div className="cw-panel-head"><b>Spielstärke im Verlauf</b><small>geschätztes Elo je Zug</small></div>
        <LineChart series={strengthSeries} opts={{ w: 340, h: 130, xMax: totalMoves, ymin: 1000, ymax: 2600, grid: [1200, 1700, 2200, 2600] }} />
        <div className="cw-legend">
          <span><i style={{ background: '#edeae0' }} />Weiß</span>
          <span><i style={{ background: ACCENT }} />Schwarz</span>
        </div>
      </div>

      <div className="cw-panel">
        <div className="cw-panel-head"><b>Stellungsbewertung</b><small>+ Vorteil Weiß</small></div>
        <LineChart series={[{ data: eData, color: ACCENT, w: 2, fill: ACCENT, fillOpacity: 0.14 }]} opts={{ w: 340, h: 110, xMax: Math.max(1, state.evalHistory.length - 1), ymin: -7, ymax: 7, zero: 0 }} />
      </div>

      {pairs.length > 0 && (
        <div className="cw-mt">
          <div className="cw-mt-head"><span style={{ width: 26 }}>#</span><span style={{ flex: 1 }}>Weiß</span><span style={{ flex: 1 }}>Schwarz</span></div>
          {pairs.map((p) => (
            <div key={p.no} className="cw-mt-row">
              <span className="cw-mt-no">{p.no}</span>
              {cell(p.w)}
              {cell(p.b)}
            </div>
          ))}
        </div>
      )}

      {state.moveCount > 0 && (
        <button className="ui-btn primary" style={{ alignSelf: 'flex-start' }} onClick={onOpenReplay}>
          Im Replay durchgehen
        </button>
      )}
    </div>
  )
}
