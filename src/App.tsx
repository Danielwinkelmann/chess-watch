import { useEffect, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Chess } from 'chess.js'
import './App.css'
import { useChessSession } from './game/useChessSession'
import { Icon } from './ui/icons'
import { LiveScreen } from './screens/LiveScreen'
import { FeedScreen } from './screens/FeedScreen'
import { ArchiveScreen } from './screens/ArchiveScreen'
import { AnalysisScreen } from './screens/AnalysisScreen'
import { ReplayOverlay } from './screens/ReplayOverlay'
import { IntroScreen } from './screens/IntroScreen'
import { SaveGameDialog } from './components/SaveGameDialog'
import type { Game } from './storage/db'

type Tab = 'live' | 'feed' | 'archive' | 'analysis'
type Theme = 'dark' | 'light'

const NAV: { key: Tab; label: string; icon: (p?: { size?: number }) => React.ReactNode }[] = [
  { key: 'live', label: 'Live', icon: Icon.camera },
  { key: 'feed', label: 'Kommentar', icon: Icon.feed },
  { key: 'archive', label: 'Archiv', icon: Icon.archive },
  { key: 'analysis', label: 'Analyse', icon: Icon.chart },
]

export default function App() {
  const session = useChessSession()
  const [intro, setIntro] = useState(true)
  const [tab, setTab] = useState<Tab>('live')
  const [liveView, setLiveView] = useState<'camera' | 'board'>('board')
  const [visionReady, setVisionReady] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('cw-theme') as Theme) || 'dark')
  const [replayGame, setReplayGame] = useState<Game | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cw-theme', theme)
  }, [theme])

  function handleManualMove(from: string, to: string): boolean {
    const probe = new Chess(session.chess.fen())
    try {
      if (!probe.move({ from, to, promotion: 'q' })) return false
    } catch {
      return false
    }
    void session.applyMove({ from, to, promotion: 'q' })
    return true
  }

  function openLiveReplay() {
    const moves = session.currentMoves()
    if (!moves.length) return
    setReplayGame({
      id: 'live', name: 'Live-Partie', pgn: session.chess.pgn(), finalFen: session.chess.fen(),
      moves, createdAt: Date.now(), updatedAt: Date.now(), syncState: 'local',
    })
  }

  const moves = Math.ceil(session.state.moveCount / 2)
  const headerSub = session.state.moveCount > 0 ? `Live-Partie · ${moves} Züge` : 'Bereit für deine Partie'
  const live = session.state.moveCount > 0
  const chip = live
    ? { label: 'Live', dot: 'var(--accent)', bg: '#2b2a1d', border: '#4a4632', fg: 'var(--text-2)' }
    : { label: 'Bereit', dot: 'var(--muted-2)', bg: 'var(--card-2)', border: 'var(--border)', fg: 'var(--text-2)' }

  return (
    <MotionConfig reducedMotion="user">
      <div className="cw-root">
        <div className="cw-app">
          {intro && (
            <IntroScreen
              onEnter={() => setIntro(false)}
              onVisionReady={() => setVisionReady(true)}
              onCommentaryReady={session.markLlmReady}
            />
          )}

          {/* Header */}
          <header className="cw-header">
            <div className="cw-logo">{Icon.pawn({ size: 20 })}</div>
            <div className="cw-title">
              <b>Chess <span className="accent">Watch</span></b>
              <small>{headerSub}</small>
            </div>
            <span className="cw-header-spacer" />
            <div className="cw-chip" style={{ background: chip.bg, border: `1px solid ${chip.border}`, color: chip.fg }}>
              <span className="dot" style={{ background: chip.dot }} />
              {chip.label}
            </div>
            <button className="cw-iconbtn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} title="Hell/Dunkel">
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </header>

          {/* Screens */}
          <main className="cw-screen">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                {tab === 'live' && (
                  <LiveScreen
                    chess={session.chess}
                    state={session.state}
                    visionReady={visionReady}
                    liveView={liveView}
                    setLiveView={setLiveView}
                    onVisionMove={session.applyMove}
                    onManualMove={handleManualMove}
                    onShowFeed={() => setTab('feed')}
                  />
                )}
                {tab === 'feed' && <FeedScreen state={session.state} />}
                {tab === 'archive' && (
                  <ArchiveScreen
                    canSave={session.state.moveCount > 0}
                    onSave={() => setSaveOpen(true)}
                    onOpen={(g) => setReplayGame(g)}
                  />
                )}
                {tab === 'analysis' && <AnalysisScreen state={session.state} onOpenReplay={openLiveReplay} />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Replay overlay */}
          {replayGame && <ReplayOverlay game={replayGame} onClose={() => setReplayGame(null)} />}

          {/* Bottom nav */}
          <nav className="cw-nav">
            {NAV.map((n) => (
              <button key={n.key} className={tab === n.key ? 'active' : ''} onClick={() => setTab(n.key)}>
                <span className="ind" />
                <span className="pill">{n.icon({ size: 22 })}</span>
                <span className="lbl">{n.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <SaveGameDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          defaultName={`Partie ${new Date().toLocaleDateString('de-DE')}`}
          onSave={async (name) => { await session.saveGame(name) }}
        />
      </div>
    </MotionConfig>
  )
}
