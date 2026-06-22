import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Arrow, PieceDropHandlerArgs, SquareHandlerArgs } from 'react-chessboard'

interface BoardViewProps {
  fen: string
  orientation?: 'white' | 'black'
  // Rückgabe true = Zug akzeptiert. Bei Vision-Spiegelung kann das Ziehen
  // deaktiviert werden (allowDragging=false).
  onMove?: (from: string, to: string) => boolean
  allowDragging?: boolean
  arrows?: Arrow[]
}

export function BoardView({
  fen,
  orientation = 'white',
  onMove,
  allowDragging = true,
  arrows,
}: BoardViewProps) {
  // Klick-zum-Ziehen: erstes Klicken wählt ein Feld, zweites zieht.
  const [selected, setSelected] = useState<string | null>(null)

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
    if (!targetSquare || !onMove) return false
    setSelected(null)
    return onMove(sourceSquare, targetSquare)
  }

  function handleSquareClick({ square, piece }: SquareHandlerArgs) {
    if (!onMove) return
    if (selected && selected !== square) {
      const ok = onMove(selected, square)
      setSelected(ok ? null : piece ? square : null)
      return
    }
    setSelected(piece ? square : null)
  }

  const highlight = selected
    ? { [selected]: { background: 'rgba(26, 188, 156, 0.45)' } }
    : {}

  return (
    <Chessboard
      options={{
        position: fen,
        boardOrientation: orientation,
        onPieceDrop: handleDrop,
        onSquareClick: handleSquareClick,
        squareStyles: highlight,
        allowDragging,
        animationDurationInMs: 250,
        arrows: arrows ?? [],
        id: 'main-board',
      }}
    />
  )
}
