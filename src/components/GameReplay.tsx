import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Arrow } from 'react-chessboard'
import { db, type Game } from '../storage/db'
import { BoardView } from './BoardView'
import { EvalBar } from './EvalBar'
import { EvalChart } from './EvalChart'
import { ConfirmDialog } from './ConfirmDialog'
import { formatEval, winProbability } from '../engine/evaluation'
import { useEngineAnalysis } from '../game/useEngineAnalysis'
import type { EvalPoint } from '../game/useChessSession'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function GameReplay() {
  const games = useLiveQuery(() => db.games.orderBy('updatedAt').reverse().toArray(), [])
  const [selected, setSelected] = useState<Game | null>(null)
  const [ply, setPly] = useState(0)
  const [engineOn, setEngineOn] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null)

  const moves = selected?.moves ?? []
  const current = ply === 0 ? null : moves[ply - 1]
  const fen = current?.fenAfter ?? START_FEN

  // Live-Analyse der aktuell gezeigten Stellung (Hook immer aufrufen).
  const analysis = useEngineAnalysis(fen, engineOn && !!selected)
  const arrows: Arrow[] =
    analysis.bestUci && selected
      ? [
          {
            startSquare: analysis.bestUci.slice(0, 2),
            endSquare: analysis.bestUci.slice(2, 4),
            color: '#8e8b5e',
          },
        ]
      : []

  if (!selected) {
    return (
      <div className="replay">
        <h2>Gespeicherte Partien</h2>
        {!games?.length && <p className="muted">Noch keine Partien gespeichert.</p>}
        <ul className="game-list">
          {games?.map((g) => (
            <li key={g.id}>
              <button className="link" onClick={() => { setSelected(g); setPly(0) }}>
                {g.name}
              </button>
              <small className="muted">
                {g.moves.length} Züge · {new Date(g.createdAt).toLocaleString('de-DE')}
              </small>
              <button className="danger" onClick={() => setDeleteTarget(g)} title="Löschen">
                ✕
              </button>
            </li>
          ))}
        </ul>

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title="Partie löschen?"
          description={`„${deleteTarget?.name ?? ''}" wird dauerhaft entfernt.`}
          confirmLabel="Löschen"
          onConfirm={() => deleteTarget && db.games.delete(deleteTarget.id)}
        />
      </div>
    )
  }

  // Bewertungsverlauf aus den gespeicherten Zügen rekonstruieren.
  const history: EvalPoint[] = [
    { ply: 0, san: '–', cp: 0, mate: null, winProb: 0.5 },
    ...moves.map((m) => ({
      ply: m.ply + 1,
      san: m.san,
      cp: m.cp,
      mate: m.mate,
      winProb: winProbability({ cp: m.cp, mate: m.mate, depth: 0 }),
    })),
  ]

  return (
    <div className="replay">
      <button className="link" onClick={() => setSelected(null)}>
        ← Zurück zur Liste
      </button>
      <h2>{selected.name}</h2>

      <div className="replay-main">
        {engineOn && <EvalBar evaluation={analysis.evaluation ?? { cp: 0, mate: null, depth: 0 }} />}
        <div className="replay-board">
          <BoardView fen={fen} allowDragging={false} arrows={arrows} />
        </div>
      </div>

      <div className="replay-controls">
        <button onClick={() => setPly(0)} disabled={ply === 0}>⏮</button>
        <button onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0}>◀</button>
        <span>{ply} / {moves.length}</span>
        <button onClick={() => setPly((p) => Math.min(moves.length, p + 1))} disabled={ply === moves.length}>▶</button>
        <button onClick={() => setPly(moves.length)} disabled={ply === moves.length}>⏭</button>
        <button
          className={`engine-toggle${engineOn ? ' on' : ''}`}
          onClick={() => setEngineOn((v) => !v)}
          title="Stockfish-Analyse"
        >
          Engine {engineOn ? 'an' : 'aus'}
        </button>
      </div>

      {engineOn && (
        <div className="replay-engine">
          <div className="engine-stat">
            <span className="muted">Bewertung</span>
            <strong>{analysis.evaluation ? formatEval(analysis.evaluation) : '…'}</strong>
          </div>
          <div className="engine-stat">
            <span className="muted">Bester Zug</span>
            <strong>{analysis.bestSan ?? (analysis.thinking ? 'rechnet …' : '–')}</strong>
          </div>
          <div className="engine-stat wide">
            <span className="muted">Variante</span>
            <strong className="engine-pv">{analysis.pvSans.join(' ') || '–'}</strong>
          </div>
        </div>
      )}

      {current && (
        <div className="replay-comment">
          <strong>{current.san}</strong>
          <p>{current.comment}</p>
        </div>
      )}

      <h2>Stärke-Verlauf</h2>
      <EvalChart history={history} />
    </div>
  )
}
