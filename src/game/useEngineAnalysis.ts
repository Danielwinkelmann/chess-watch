import { useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { StockfishEngine } from '../engine/engine'
import type { Evaluation } from '../engine/evaluation'

export interface EngineAnalysis {
  evaluation: Evaluation | null
  bestUci: string | null // z. B. "g1f3" – für den Pfeil aufs Brett
  bestSan: string | null // z. B. "Nf3"
  pvSans: string[] // Hauptvariante in SAN
  thinking: boolean
}

const EMPTY: EngineAnalysis = {
  evaluation: null,
  bestUci: null,
  bestSan: null,
  pvSans: [],
  thinking: false,
}

// UCI-Zugfolge → SAN-Liste (anhand der Ausgangsstellung).
function uciLineToSan(fen: string, uciMoves: string[], max = 6): string[] {
  const chess = new Chess(fen)
  const out: string[] = []
  for (const uci of uciMoves.slice(0, max)) {
    try {
      const m = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined,
      })
      if (!m) break
      out.push(m.san)
    } catch {
      break
    }
  }
  return out
}

// Analysiert eine Stellung mit Stockfish, solange `enabled`. Liefert laufend
// tiefere Bewertungen + besten Zug. Stellungswechsel bricht die alte Suche ab.
export function useEngineAnalysis(fen: string, enabled: boolean, depth = 18): EngineAnalysis {
  const engineRef = useRef<StockfishEngine | null>(null)
  const reqRef = useRef(0)
  const [analysis, setAnalysis] = useState<EngineAnalysis>(EMPTY)

  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setAnalysis(EMPTY)
      engineRef.current?.stop()
      return
    }
    const req = ++reqRef.current
    if (!engineRef.current) engineRef.current = new StockfishEngine()
    const engine = engineRef.current
    setAnalysis({ ...EMPTY, thinking: true })

    void engine
      .evaluate(fen, depth, (live) => {
        if (req !== reqRef.current) return
        setAnalysis((a) => ({ ...a, evaluation: live, thinking: true }))
      })
      .then((ev) => {
        if (req !== reqRef.current) return
        const bestUci = ev.bestMove ?? null
        const pvSans = ev.pv ? uciLineToSan(fen, ev.pv) : []
        setAnalysis({
          evaluation: ev,
          bestUci,
          bestSan: pvSans[0] ?? null,
          pvSans,
          thinking: false,
        })
      })

    return () => {
      reqRef.current++
      engine.stop()
    }
  }, [fen, enabled, depth])

  return analysis
}
