import type { Evaluation } from './evaluation'
import { toWhitePov } from './evaluation'

// Pfad zur Single-Thread-Lite-Build (kein SharedArrayBuffer nötig, läuft
// überall). Datei liegt unter public/engine und wird per SW gecacht.
const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`

type InfoListener = (ev: Evaluation) => void

// Dünner UCI-Wrapper um den Stockfish-Worker. Stockfish (Emscripten) ist selbst
// ein klassischer Worker, der UCI-Strings über postMessage entgegennimmt.
export class StockfishEngine {
  private worker: Worker | null = null
  private ready = false
  private readyPromise: Promise<void>
  private resolveReady!: () => void
  private sideToMove: 'w' | 'b' = 'w'
  private onInfo: InfoListener | null = null
  private lastEval: Evaluation | null = null
  private onDone: ((ev: Evaluation) => void) | null = null

  constructor() {
    this.readyPromise = new Promise((res) => (this.resolveReady = res))
  }

  async init(): Promise<void> {
    if (this.worker) return this.readyPromise
    this.worker = new Worker(ENGINE_URL)
    this.worker.onmessage = (e: MessageEvent) => this.handleLine(String(e.data))
    this.send('uci')
    this.send('setoption name UCI_AnalyseMode value true')
    this.send('isready')
    return this.readyPromise
  }

  private handleLine(line: string) {
    if (line.includes('uciok') || line.includes('readyok')) {
      if (!this.ready) {
        this.ready = true
        this.resolveReady()
      }
      return
    }
    if (line.startsWith('info') && line.includes(' score ')) {
      const ev = this.parseInfo(line)
      if (ev) {
        this.lastEval = ev
        this.onInfo?.(ev)
      }
      return
    }
    if (line.startsWith('bestmove')) {
      const best = line.split(/\s+/)[1]
      const ev: Evaluation = this.lastEval ?? { cp: 0, mate: null, depth: 0 }
      this.onDone?.({ ...ev, bestMove: best !== '(none)' ? best : ev.bestMove })
      this.onDone = null
    }
  }

  private parseInfo(line: string): Evaluation | null {
    const depth = Number(/\bdepth (\d+)/.exec(line)?.[1] ?? 0)
    const scoreMatch = /\bscore (cp|mate) (-?\d+)/.exec(line)
    if (!scoreMatch) return null
    const pvMatch = /\bpv (.+)$/.exec(line)
    const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : undefined
    const raw = Number(scoreMatch[2])
    if (scoreMatch[1] === 'mate') {
      // Matt-Distanz ebenfalls auf Weiß-Sicht drehen.
      const mate = this.sideToMove === 'w' ? raw : -raw
      return { cp: null, mate, depth, pv, bestMove: pv?.[0] }
    }
    return {
      cp: toWhitePov(raw, this.sideToMove),
      mate: null,
      depth,
      pv,
      bestMove: pv?.[0],
    }
  }

  // Stellung analysieren. onInfo liefert laufend tiefer werdende Bewertungen.
  async analyse(fen: string, depth: number, onInfo: InfoListener): Promise<void> {
    await this.init()
    this.sideToMove = (fen.split(' ')[1] as 'w' | 'b') ?? 'w'
    this.onInfo = onInfo
    this.send('stop')
    this.send(`position fen ${fen}`)
    this.send(`go depth ${depth}`)
  }

  // Einmalige Analyse bis zur Zieltiefe; löst mit der finalen Bewertung auf.
  // onInfo liefert weiterhin laufende Zwischenstände (z. B. für die Eval-Bar).
  async evaluate(
    fen: string,
    depth: number,
    onInfo?: InfoListener,
  ): Promise<Evaluation> {
    await this.init()
    this.sideToMove = (fen.split(' ')[1] as 'w' | 'b') ?? 'w'
    this.onInfo = onInfo ?? null
    this.lastEval = null
    this.send('stop')
    this.send(`position fen ${fen}`)
    return new Promise<Evaluation>((resolve) => {
      this.onDone = resolve
      this.send(`go depth ${depth}`)
    })
  }

  stop() {
    this.send('stop')
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd)
  }

  dispose() {
    this.send('quit')
    this.worker?.terminate()
    this.worker = null
  }
}
