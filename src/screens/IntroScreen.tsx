import { useState } from 'react'
import { getVision } from '../workers/clients'
import { loadCommentaryModel } from '../game/commentaryEngine'
import { Icon } from '../ui/icons'

type Status = 'idle' | 'loading' | 'ready' | 'error'

function Row({
  icon, name, sub, status, pct, onLoad, always,
}: {
  icon: React.ReactNode
  name: string
  sub: string
  status: Status
  pct: number
  onLoad?: () => void
  always?: boolean
}) {
  const done = always || status === 'ready'
  return (
    <div className="cw-intro-row">
      <div className="top">
        <span className="ic">{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nm">{name}</div>
          <div className="sb">{sub}</div>
        </div>
        {done ? (
          <span className="pct" style={{ color: 'var(--accent)' }}>fertig</span>
        ) : status === 'loading' ? (
          <span className="pct" style={{ color: 'var(--muted)' }}>{Math.round(pct)}%</span>
        ) : (
          <button onClick={onLoad} className="cw-recpill" style={{ padding: '6px 12px' }}>
            {status === 'error' ? 'Erneut' : 'Aktivieren'}
          </button>
        )}
      </div>
      <div className="cw-intro-bar"><i style={{ width: `${always ? 100 : pct}%` }} /></div>
    </div>
  )
}

export function IntroScreen({
  onEnter, onVisionReady, onCommentaryReady,
}: {
  onEnter: () => void
  onVisionReady: () => void
  onCommentaryReady: () => void
}) {
  const [vision, setVision] = useState<{ s: Status; p: number }>({ s: 'idle', p: 0 })
  const [comm, setComm] = useState<{ s: Status; p: number }>({ s: 'idle', p: 0 })

  async function loadVision() {
    setVision({ s: 'loading', p: 8 })
    try {
      // grober Fortschritt (load meldet nicht granular)
      const t = setInterval(() => setVision((v) => (v.s === 'loading' ? { ...v, p: Math.min(92, v.p + 6) } : v)), 250)
      await getVision().load()
      clearInterval(t)
      setVision({ s: 'ready', p: 100 })
      onVisionReady()
    } catch (e) {
      console.error('[Erkennung]', e)
      setVision({ s: 'error', p: 0 })
    }
  }
  async function loadComm() {
    setComm({ s: 'loading', p: 2 })
    try {
      await loadCommentaryModel((loaded, t) => setComm({ s: 'loading', p: t ? (loaded / t) * 100 : 0 }))
      setComm({ s: 'ready', p: 100 })
      onCommentaryReady()
    } catch (e) {
      console.error('[Kommentar]', e)
      setComm({ s: 'error', p: 0 })
    }
  }

  return (
    <div className="cw-intro">
      <div className="cw-intro-logo">{Icon.pawn({ size: 30 })}</div>
      <div className="cw-intro-title">Chess <span className="accent">Watch</span></div>
      <div className="cw-intro-sub">Modelle werden einmalig geladen und auf dem Gerät zwischengespeichert. Du kannst auch ohne sie starten.</div>

      <div className="cw-intro-list">
        <Row icon={Icon.eye({ color: 'currentColor' })} name="Brett-Erkennung" sub="vision · ~100 MB" status={vision.s} pct={vision.p} onLoad={loadVision} />
        <Row icon={Icon.cpu({ color: 'currentColor' })} name="Schach-Engine" sub="Stockfish · sofort bereit" status="ready" pct={100} always />
        <Row icon={Icon.brain({ color: 'currentColor' })} name="Kommentar-Modell" sub="language · ~290 MB" status={comm.s} pct={comm.p} onLoad={loadComm} />
      </div>

      <button
        className="cw-intro-btn"
        onClick={onEnter}
        style={{ background: 'var(--accent)', color: '#211c1b' }}
      >
        → Los geht's
      </button>
      <div className="cw-intro-foot">v2.0 · offline-fähig · kein Konto nötig</div>
    </div>
  )
}
