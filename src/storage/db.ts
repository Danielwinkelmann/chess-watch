import Dexie, { type EntityTable } from 'dexie'
import type { MoveQuality } from '../engine/evaluation'

// Ein aufgezeichneter Zug innerhalb einer Partie.
export interface RecordedMove {
  ply: number // Halbzug-Index ab 0
  san: string // z. B. "Nf3"
  fenBefore: string
  fenAfter: string
  cp: number | null // Bewertung nach dem Zug (Weiß-Sicht)
  mate: number | null
  deltaCp: number | null // Bewertungsänderung durch den Zug (Sicht des Ziehers)
  quality: MoveQuality | null
  comment: string | null
  ts: number // Zeitstempel (ms)
}

export interface Game {
  id: string // uuid (offline-first: lokal vergeben)
  name: string
  pgn: string
  finalFen: string
  moves: RecordedMove[]
  createdAt: number
  updatedAt: number
  // Vorbereitung für späteren Cloud-Sync.
  syncState: 'local' | 'synced' | 'dirty'
}

const db = new Dexie('chess-watch') as Dexie & {
  games: EntityTable<Game, 'id'>
}

db.version(1).stores({
  // Indizes: Primärschlüssel id, plus updatedAt für Sortierung/Sync.
  games: 'id, updatedAt, syncState',
})

export { db }

export function newGameId(): string {
  return crypto.randomUUID()
}
