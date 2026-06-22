import { useState } from 'react'
import { Chess } from 'chess.js'
import './App.css'
import { useChessSession } from './game/useChessSession'
import { BoardView } from './components/BoardView'
import { EvalBar } from './components/EvalBar'
import { CommentaryFeed } from './components/CommentaryFeed'
import { CameraView } from './components/CameraView'
import { GameReplay } from './components/GameReplay'
import { ModelLoader } from './components/ModelLoader'
import { AnalysisPanel } from './components/AnalysisPanel'

type View = 'camera' | 'board' | 'analysis' | 'replay'

export default function App() {
  const session = useChessSession()
  const [view, setView] = useState<View>('board')
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [visionReady, setVisionReady] = useState(false)

  // Manueller Zug vom Brett: synchron auf Legalität prüfen (für Drag-UX),
  // dann asynchron anwenden (Bewertung + Kommentar).
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
    <div className="app">
      <header className="topbar">
        <h1>♟ Chess Watch</h1>
        <nav className="tabs">
          <button className={view === 'camera' ? 'active' : ''} onClick={() => setView('camera')}>
            Kamera
          </button>
          <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>
            Brett
          </button>
          <button className={view === 'analysis' ? 'active' : ''} onClick={() => setView('analysis')}>
            Analyse
          </button>
          <button className={view === 'replay' ? 'active' : ''} onClick={() => setView('replay')}>
            Archiv
          </button>
        </nav>
      </header>

      <main className="layout">
        <section className="stage">
          {view === 'camera' && (
            <CameraView
              chess={session.chess}
              visionReady={visionReady}
              orientation={orientation}
              onMove={session.applyMove}
            />
          )}

          {view === 'board' && (
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

          {view === 'analysis' && (
            <AnalysisPanel
              evaluation={session.state.evaluation}
              history={session.state.evalHistory}
            />
          )}

          {view === 'replay' && <GameReplay />}

          {(view === 'camera' || view === 'board') && (
            <div className="actions">
              <button onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
                Brett drehen
              </button>
              <button onClick={session.reset}>Neu</button>
              <button onClick={save} disabled={session.state.moveCount === 0}>
                Partie speichern
              </button>
              <span className="muted">{session.state.moveCount} Halbzüge</span>
            </div>
          )}
        </section>

        <aside className="sidebar">
          <ModelLoader
            onVisionReady={() => setVisionReady(true)}
            onCommentaryReady={session.markLlmReady}
          />
          <CommentaryFeed entries={session.state.commentary} />
        </aside>
      </main>
    </div>
  )
}
