import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Game } from '../storage/db'
import { BoardView } from './BoardView'

export function GameReplay() {
  const games = useLiveQuery(() => db.games.orderBy('updatedAt').reverse().toArray(), [])
  const [selected, setSelected] = useState<Game | null>(null)
  const [ply, setPly] = useState(0)

  function open(g: Game) {
    setSelected(g)
    setPly(0)
  }

  if (!selected) {
    return (
      <div className="replay">
        <h2>Gespeicherte Partien</h2>
        {!games?.length && <p className="muted">Noch keine Partien gespeichert.</p>}
        <ul className="game-list">
          {games?.map((g) => (
            <li key={g.id}>
              <button className="link" onClick={() => open(g)}>
                {g.name}
              </button>
              <small className="muted">
                {g.moves.length} Züge · {new Date(g.createdAt).toLocaleString('de-DE')}
              </small>
              <button
                className="danger"
                onClick={() => db.games.delete(g.id)}
                title="Löschen"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const moves = selected.moves
  const current = ply === 0 ? null : moves[ply - 1]
  // Startstellung, wenn ply 0; sonst fenAfter des aktuellen Zugs.
  const fen = current?.fenAfter ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  return (
    <div className="replay">
      <button className="link" onClick={() => setSelected(null)}>
        ← Zurück zur Liste
      </button>
      <h2>{selected.name}</h2>
      <div className="replay-board">
        <BoardView fen={fen} allowDragging={false} />
      </div>
      <div className="replay-controls">
        <button onClick={() => setPly(0)} disabled={ply === 0}>
          ⏮
        </button>
        <button onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0}>
          ◀
        </button>
        <span>
          {ply} / {moves.length}
        </span>
        <button
          onClick={() => setPly((p) => Math.min(moves.length, p + 1))}
          disabled={ply === moves.length}
        >
          ▶
        </button>
        <button onClick={() => setPly(moves.length)} disabled={ply === moves.length}>
          ⏭
        </button>
      </div>
      {current && (
        <div className="replay-comment">
          <strong>{current.san}</strong>
          <p>{current.comment}</p>
        </div>
      )}
    </div>
  )
}
