import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { SquareHandlerArgs } from 'react-chessboard'

const GLYPH: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}

type Cell = string | null
type Board = Cell[][] // [rank8..rank1][a..h]

function fenToBoard(fen: string): Board {
  const field = fen.split(' ')[0]
  return field.split('/').map((row) => {
    const out: Cell[] = []
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) out.push(null)
      else out.push(ch)
    }
    while (out.length < 8) out.push(null)
    return out.slice(0, 8)
  })
}

function boardToFen(b: Board, side: 'w' | 'b'): string {
  const field = b
    .map((row) => {
      let s = ''
      let e = 0
      for (const c of row) {
        if (c === null) e++
        else {
          if (e) { s += e; e = 0 }
          s += c
        }
      }
      if (e) s += e
      return s
    })
    .join('/')
  return `${field} ${side} - - 0 1`
}

function sqToRC(sq: string): [number, number] {
  return [8 - Number(sq[1]), sq.charCodeAt(0) - 97]
}

const PALETTE: Cell[] = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p', null]

export function PositionEditor({ initialFen, onApply }: { initialFen: string; onApply: (fen: string) => void }) {
  const [board, setBoard] = useState<Board>(() => fenToBoard(initialFen))
  const [sel, setSel] = useState<Cell>('P')
  const [side, setSide] = useState<'w' | 'b'>('w')

  const fen = boardToFen(board, side)
  const kings = fen.includes('K') && fen.includes('k')

  function place({ square }: SquareHandlerArgs) {
    const [r, c] = sqToRC(square)
    setBoard((b) => b.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? sel : cell)) : row)))
  }

  function empty() {
    setBoard(Array.from({ length: 8 }, () => Array<Cell>(8).fill(null)))
  }
  function startpos() {
    setBoard(fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cw-board-panel">
        <Chessboard
          options={{
            position: fen,
            allowDragging: false,
            onSquareClick: place,
            darkSquareStyle: { backgroundColor: '#4a443f' },
            lightSquareStyle: { backgroundColor: '#bdb8ad' },
            id: 'editor-board',
          }}
        />
      </div>

      {/* Palette */}
      <div className="cw-palette">
        {PALETTE.map((p, i) => (
          <button
            key={i}
            className={`cw-pal${sel === p ? ' active' : ''}`}
            onClick={() => setSel(p)}
            title={p === null ? 'Löschen' : p}
          >
            {p === null ? '⌫' : <span style={{ color: p === p.toUpperCase() ? '#edeae0' : '#171311', fontSize: 22 }}>{GLYPH[p]}</span>}
          </button>
        ))}
      </div>

      <div className="cw-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="cw-acc-cap">Am Zug</span>
        <div className="cw-seg" style={{ flex: 'none', padding: 3 }}>
          <button className={side === 'w' ? 'active' : ''} onClick={() => setSide('w')} style={{ padding: '6px 12px' }}>Weiß</button>
          <button className={side === 'b' ? 'active' : ''} onClick={() => setSide('b')} style={{ padding: '6px 12px' }}>Schwarz</button>
        </div>
      </div>

      <div className="cw-tools">
        <button className="cw-tool" onClick={empty}>Leeren</button>
        <button className="cw-tool" onClick={startpos}>Grundstellung</button>
        <button className="cw-tool" style={{ gridColumn: '1 / -1', justifyContent: 'center', background: kings ? 'var(--accent)' : 'var(--card)', color: kings ? '#211c1b' : 'var(--muted-2)' }} disabled={!kings} onClick={() => onApply(fen)}>
          {kings ? '✓ Stellung übernehmen' : 'Beide Könige setzen'}
        </button>
      </div>
      <div className="cw-fen-box">{fen}</div>
    </div>
  )
}
