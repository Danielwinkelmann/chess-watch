import { useEffect, useState } from 'react'
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

type View = 'play' | 'replay'
type Mode = 'camera' | 'board'
type Theme = 'dark' | 'light'
type SidePanel = 'comments' | 'moves'

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

  // Theme global anwenden + merken.
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

  async function save() {
    const name =
      prompt('Name der Partie:', `Partie ${new Date().toLocaleString('de-DE')}`) ?? ''
    if (name) {
      await session.saveGame(name)
      alert('Gespeichert.')
    }
  }

  return (
    <div className={`app${zen ? ' zen' : ''}`}>
      <header className="topbar">
        <h1 className="wordmark">
          Chess <span className="accent">Watch</span>
        </h1>
        <div className="topbar-right">
          <nav className="tabs">
            <button className={view === 'play' ? 'active' : ''} onClick={() => setView('play')}>
              Spiel
            </button>
            <button className={view === 'replay' ? 'active' : ''} onClick={() => setView('replay')}>
              Archiv
            </button>
          </nav>
          <button
            className="icon-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title="Hell/Dunkel umschalten"
          >
            {theme === 'dark' ? '☀ Hell' : '☾ Dunkel'}
          </button>
          <button
            className={`icon-btn${zen ? ' active' : ''}`}
            onClick={() => setZen((z) => !z)}
            title="Zen-Modus: nur das Brett"
          >
            ⤢ Zen
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="stage">
          {view === 'play' && (
            <>
              <div className="stage-head">
                <div className="segment">
                  <button
                    className={mode === 'board' ? 'active' : ''}
                    onClick={() => setMode('board')}
                  >
                    Brett
                  </button>
                  <button
                    className={mode === 'camera' ? 'active' : ''}
                    onClick={() => setMode('camera')}
                  >
                    Kamera
                  </button>
                </div>
              </div>

              {mode === 'camera' ? (
                <CameraView
                  chess={session.chess}
                  visionReady={visionReady}
                  orientation={orientation}
                  onMove={session.applyMove}
                />
              ) : (
                <div className="board-wrap">
                  <EvalBar evaluation={session.state.evaluation} />
                  <div className="board-area">
                    <BoardView
                      fen={session.state.fen}
                      orientation={orientation}
                      onMove={handleManualMove}
                    />
                  </div>
                </div>
              )}

              <div className="actions">
                <button
                  onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
                >
                  Brett drehen
                </button>
                <button onClick={session.reset}>Neu</button>
                <button onClick={save} disabled={session.state.moveCount === 0}>
                  Partie speichern
                </button>
                <span className="muted">{session.state.moveCount} Halbzüge</span>
              </div>
            </>
          )}

          {view === 'replay' && <GameReplay />}
        </section>

        {view === 'play' && (
          <aside className="sidebar">
            {/* Analyse-Chart rechts oben */}
            <AnalysisPanel
              evaluation={session.state.evaluation}
              history={session.state.evalHistory}
            />

            <div className="sidebar-panel">
              <div className="sidebar-panel-head">
                <span className="label">Partie</span>
                <div className="segment">
                  <button
                    className={sidePanel === 'comments' ? 'active' : ''}
                    onClick={() => setSidePanel('comments')}
                  >
                    Kommentare
                  </button>
                  <button
                    className={sidePanel === 'moves' ? 'active' : ''}
                    onClick={() => setSidePanel('moves')}
                  >
                    Züge
                  </button>
                </div>
              </div>
              {sidePanel === 'comments' ? (
                <CommentaryFeed entries={session.state.commentary} bare />
              ) : (
                <MoveList entries={session.state.commentary} />
              )}
            </div>

            <ModelLoader
              onVisionReady={() => setVisionReady(true)}
              onCommentaryReady={session.markLlmReady}
            />
          </aside>
        )}
      </main>
    </div>
  )
}
