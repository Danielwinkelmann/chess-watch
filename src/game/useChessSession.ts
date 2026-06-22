import { useCallback, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import { StockfishEngine } from '../engine/engine'
import {
  classifyMove,
  evalToWhiteCp,
  winProbability,
  type Evaluation,
  type MoveQuality,
} from '../engine/evaluation'
import { heuristicComment, type CommentaryInput } from './commentary'
import { generateComment, isCommentaryReady } from './commentaryEngine'
import { db, newGameId, type Game, type RecordedMove } from '../storage/db'

const ANALYSE_DEPTH = 16

export interface CommentaryEntry {
  ply: number
  san: string
  quality: MoveQuality
  text: string
  pending: boolean
}

// Ein Punkt im Bewertungsverlauf (für den Analyse-Chart).
export interface EvalPoint {
  ply: number // 0 = Startstellung
  san: string // '–' für die Startstellung
  cp: number | null
  mate: number | null
  winProb: number // Gewinnwahrscheinlichkeit Weiß, 0..1
}

export interface SessionState {
  fen: string
  evaluation: Evaluation
  commentary: CommentaryEntry[]
  evalHistory: EvalPoint[]
  recording: boolean
  moveCount: number
  llmReady: boolean
}

const START_EVAL: Evaluation = { cp: 0, mate: null, depth: 0 }
const START_POINT: EvalPoint = { ply: 0, san: '–', cp: 0, mate: null, winProb: 0.5 }

export function useChessSession() {
  const gameRef = useRef(new Chess())
  const engineRef = useRef<StockfishEngine | null>(null)
  const lastEvalRef = useRef<Evaluation>(START_EVAL)
  const recordedRef = useRef<RecordedMove[]>([])

  const [state, setState] = useState<SessionState>({
    fen: gameRef.current.fen(),
    evaluation: START_EVAL,
    commentary: [],
    evalHistory: [START_POINT],
    recording: false,
    moveCount: 0,
    llmReady: false,
  })

  const getEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new StockfishEngine()
    return engineRef.current
  }, [])

  // Wendet einen Zug an (manuell vom Brett oder aus der Vision-Erkennung) und
  // löst Bewertung + Kommentar aus.
  const applyMove = useCallback(
    async (move: string | { from: string; to: string; promotion?: string }) => {
      const game = gameRef.current
      const fenBefore = game.fen()
      const prevEval = lastEvalRef.current

      let applied: Move | null = null
      try {
        applied = game.move(move)
      } catch {
        return false // illegaler Zug → ignorieren
      }
      if (!applied) return false

      const side: 'White' | 'Black' = applied.color === 'w' ? 'White' : 'Black'
      const fenAfter = game.fen()
      const ply = recordedRef.current.length

      // Sofort Brett aktualisieren (Kommentar folgt asynchron).
      setState((s) => ({
        ...s,
        fen: fenAfter,
        moveCount: ply + 1,
        commentary: [
          ...s.commentary,
          {
            ply,
            san: applied!.san,
            quality: 'good',
            text: '…',
            pending: true,
          },
        ],
      }))

      // Bewertung der neuen Stellung.
      const engine = getEngine()
      let ev = await engine.evaluate(fenAfter, ANALYSE_DEPTH, (live) =>
        setState((s) => ({ ...s, evaluation: live })),
      )
      // Schachmatt auf dem Brett: „mate 0" verliert das Vorzeichen → Sieger
      // (die ziehende Seite) eindeutig über cp kodieren.
      if (game.isCheckmate()) {
        ev = { cp: applied.color === 'w' ? 100000 : -100000, mate: 0, depth: ev.depth }
      }
      lastEvalRef.current = ev
      const point: EvalPoint = {
        ply: ply + 1,
        san: applied.san,
        cp: ev.cp,
        mate: ev.mate,
        winProb: winProbability(ev),
      }
      setState((s) => ({
        ...s,
        evaluation: ev,
        evalHistory: [...s.evalHistory, point],
      }))

      // Delta aus Sicht des Ziehers; matt-bewusst (cp ist Weiß-Sicht).
      const cpWhiteBefore = evalToWhiteCp(prevEval)
      const cpWhiteAfter = evalToWhiteCp(ev)
      const signed = side === 'White' ? 1 : -1
      const deltaCp = Math.round((cpWhiteAfter - cpWhiteBefore) * signed)
      const quality = classifyMove(deltaCp)
      // Für den LLM-Prompt lesbar begrenzen (Matt → ±3000 statt ±100000).
      const clamp = (v: number) => Math.max(-3000, Math.min(3000, v))
      const cpBefore = clamp(cpWhiteBefore)
      const cpAfter = clamp(cpWhiteAfter)

      // Kommentar: LLM falls geladen, sonst Heuristik.
      let text = heuristicComment(quality, applied.san, ev)
      if (isCommentaryReady()) {
        try {
          const input: CommentaryInput = {
            fen: fenAfter,
            san: applied.san,
            side,
            cpBefore,
            cpAfter,
            bestAlt: prevEval.bestMove,
          }
          const llmText = await generateComment(input)
          if (llmText) text = llmText
        } catch {
          /* Heuristik bleibt */
        }
      }

      const record: RecordedMove = {
        ply,
        san: applied.san,
        fenBefore,
        fenAfter,
        cp: ev.cp,
        mate: ev.mate,
        deltaCp,
        quality,
        comment: text,
        ts: Date.now(),
      }
      recordedRef.current = [...recordedRef.current, record]

      setState((s) => ({
        ...s,
        commentary: s.commentary.map((c) =>
          c.ply === ply ? { ...c, quality, text, pending: false } : c,
        ),
      }))
      return true
    },
    [getEngine, state.llmReady],
  )

  const reset = useCallback(() => {
    gameRef.current = new Chess()
    lastEvalRef.current = START_EVAL
    recordedRef.current = []
    setState((s) => ({
      ...s,
      fen: gameRef.current.fen(),
      evaluation: START_EVAL,
      commentary: [],
      evalHistory: [START_POINT],
      moveCount: 0,
    }))
  }, [])

  const setRecording = useCallback((recording: boolean) => {
    setState((s) => ({ ...s, recording }))
  }, [])

  const markLlmReady = useCallback(() => {
    setState((s) => ({ ...s, llmReady: true }))
  }, [])

  // Aktuelle Partie in IndexedDB speichern.
  const saveGame = useCallback(async (name: string): Promise<Game> => {
    const now = Date.now()
    const game: Game = {
      id: newGameId(),
      name,
      pgn: gameRef.current.pgn(),
      finalFen: gameRef.current.fen(),
      moves: recordedRef.current,
      createdAt: now,
      updatedAt: now,
      syncState: 'local',
    }
    await db.games.put(game)
    return game
  }, [])

  return {
    state,
    chess: gameRef.current,
    applyMove,
    reset,
    setRecording,
    markLlmReady,
    saveGame,
  }
}
