import { useEffect, useState } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Chess } from 'chess.js'
import './App.css'
import { useChessSession } from './game/useChessSession'
import { BoardView } from './components/BoardView'
import { EvalBar } from './components/EvalBar'
import { CommentaryFeed } from './components/CommentaryFeed'
import { MoveList } from './components/MoveList'
import { CameraView } from './components/CameraView'
import { GameReplay } from './components/GameReplay'
import { ModelLoader } from './components/ModelLoader'
import { AnalysisPanel } from './components/AnalysisPanel'
import { GameOverOverlay } from './components/GameOverOverlay'

type View = 'play' | 'replay'
type Mode = 'camera' | 'board'
type Theme = 'dark' | 'light'
type SidePanel = 'comments' | 'moves'

// Wiederkehrende Ein-/Ausblend-Animation für gewechselte Bereiche.
const swap = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
}

// Sanftes Auftauchen für Panels (gestaffelt).
function panelMotion(delay: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, stiffness: 260, damping: 26, delay },
  }
}

export default function App() {
  const session = useChessSession()
  const [view, setView] = useState<View>('play')
  const [mode, setMode] = useState<Mode>('board')
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [visionReady, setVisionReady] = useState(false)
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('cw-theme') as Theme) || 'dark',
  )
  const [zen, setZen] = useState(false)
  const [sidePanel, setSidePanel] = useState<SidePanel>('comments')
  const [overlayOpen, setOverlayOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cw-theme', theme)
  }, [theme])

  // Sieg-/Remis-Overlay automatisch öffnen, sobald die Partie endet.
  useEffect(() => {
    if (session.state.result) setOverlayOpen(true)
  }, [session.state.result])

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

  async function save() {
    const name =
      prompt('Name der Partie:', `Partie ${new Date().toLocaleString('de-DE')}`) ?? ''
    if (name) {
      await session.saveGame(name)
      alert('Gespeichert.')
    }
  }

  const tap = { whileTap: { scale: 0.96 } }

  return (
    <MotionConfig reducedMotion="user">
      <div className={`app${zen ? ' zen' : ''}`}>
        <header className="topbar">
          <h1 className="wordmark">
            Chess <span className="accent">Watch</span>
          </h1>
          <div className="topbar-right">
            <nav className="tabs">
              <motion.button {...tap} className={view === 'play' ? 'active' : ''} onClick={() => setView('play')}>
                Spiel
              </motion.button>
              <motion.button {...tap} className={view === 'replay' ? 'active' : ''} onClick={() => setView('replay')}>
                Archiv
              </motion.button>
            </nav>
            <motion.button
              {...tap}
              className="icon-btn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="Hell/Dunkel umschalten"
            >
              {theme === 'dark' ? '☀ Hell' : '☾ Dunkel'}
            </motion.button>
            <motion.button
              {...tap}
              className={`icon-btn${zen ? ' active' : ''}`}
              onClick={() => setZen((z) => !z)}
              title="Zen-Modus: nur das Brett"
            >
              ⤢ Zen
            </motion.button>
          </div>
        </header>

        <main className="layout">
          <section className="stage">
            <AnimatePresence mode="wait">
              {view === 'play' ? (
                <motion.div key="play" {...swap} className="stage-inner">
                  <div className="stage-head">
                    <div className="segment">
                      <motion.button {...tap} className={mode === 'board' ? 'active' : ''} onClick={() => setMode('board')}>
                        Brett
                      </motion.button>
                      <motion.button {...tap} className={mode === 'camera' ? 'active' : ''} onClick={() => setMode('camera')}>
                        Kamera
                      </motion.button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {mode === 'camera' ? (
                      <motion.div key="camera" {...swap}>
                        <CameraView
                          chess={session.chess}
                          visionReady={visionReady}
                          orientation={orientation}
                          onMove={session.applyMove}
                        />
                      </motion.div>
                    ) : (
                      <motion.div key="board" {...swap} className="board-wrap">
                        <EvalBar evaluation={session.state.evaluation} />
                        <div className="board-area">
                          <BoardView
                            fen={session.state.fen}
                            orientation={orientation}
                            onMove={handleManualMove}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="actions">
                    <motion.button {...tap} onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
                      Brett drehen
                    </motion.button>
                    <motion.button {...tap} onClick={session.reset}>Neu</motion.button>
                    <motion.button {...tap} onClick={save} disabled={session.state.moveCount === 0}>
                      Partie speichern
                    </motion.button>
                    <span className="muted">{session.state.moveCount} Halbzüge</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="replay" {...swap}>
                  <GameReplay />
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {view === 'play' && (
            <aside className="sidebar">
              <motion.div {...panelMotion(0)}>
                <AnalysisPanel
                  evaluation={session.state.evaluation}
                  history={session.state.evalHistory}
                />
              </motion.div>

              <motion.div className="sidebar-panel" {...panelMotion(0.08)}>
                <div className="sidebar-panel-head">
                  <span className="label">Partie</span>
                  <div className="segment">
                    <motion.button {...tap} className={sidePanel === 'comments' ? 'active' : ''} onClick={() => setSidePanel('comments')}>
                      Kommentare
                    </motion.button>
                    <motion.button {...tap} className={sidePanel === 'moves' ? 'active' : ''} onClick={() => setSidePanel('moves')}>
                      Züge
                    </motion.button>
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={sidePanel}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.16 }}
                  >
                    {sidePanel === 'comments' ? (
                      <CommentaryFeed entries={session.state.commentary} bare />
                    ) : (
                      <MoveList entries={session.state.commentary} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              <motion.div {...panelMotion(0.16)}>
                <ModelLoader
                  onVisionReady={() => setVisionReady(true)}
                  onCommentaryReady={session.markLlmReady}
                />
              </motion.div>
            </aside>
          )}
        </main>

        <GameOverOverlay
          result={overlayOpen ? session.state.result : null}
          commentary={session.state.commentary}
          evalHistory={session.state.evalHistory}
          moveCount={session.state.moveCount}
          onNewGame={() => {
            session.reset()
            setOverlayOpen(false)
          }}
          onSave={save}
          onClose={() => setOverlayOpen(false)}
        />
      </div>
    </MotionConfig>
  )
}
