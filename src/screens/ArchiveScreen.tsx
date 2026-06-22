import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Game } from '../storage/db'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../ui/icons'

function resultView(r?: string) {
  if (r === '1-0') return { txt: '1–0', bg: '#2b2a1d', fg: '#8e8b5e', word: 'Sieg Weiß' }
  if (r === '0-1') return { txt: '0–1', bg: '#2e1417', fg: '#c76a5f', word: 'Sieg Schwarz' }
  if (r === '1/2-1/2') return { txt: '½–½', bg: '#37322e', fg: '#9a9388', word: 'Remis' }
  return { txt: '…', bg: '#37322e', fg: '#9a9388', word: 'offen' }
}

// Vollständige PGN mit Tags + Ergebnis bauen und als .pgn herunterladen.
function downloadPgn(g: Game) {
  const date = new Date(g.createdAt)
  const d = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  const res = g.result && g.result !== '*' ? g.result : '*'
  const tags = [
    `[Event "Chess Watch"]`,
    `[Site "chess-watch"]`,
    `[Date "${d}"]`,
    `[White "?"]`,
    `[Black "?"]`,
    `[Result "${res}"]`,
  ].join('\n')
  // g.pgn enthält bereits Movetext (ggf. mit eigenen Tags) – wir nehmen den
  // Movetext-Teil und setzen saubere Tags davor.
  const moveText = g.pgn.replace(/\[[^\]]*\]\s*/g, '').trim()
  const pgn = `${tags}\n\n${moveText} ${res}\n`
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${g.name.replace(/[^\w\-]+/g, '_')}.pgn`
  a.click()
  URL.revokeObjectURL(url)
}

export function ArchiveScreen({
  canSave,
  onSave,
  onOpen,
}: {
  canSave: boolean
  onSave: () => void
  onOpen: (g: Game) => void
}) {
  const games = useLiveQuery(() => db.games.orderBy('updatedAt').reverse().toArray(), [])
  const [del, setDel] = useState<Game | null>(null)

  return (
    <div className="cw-pad">
      <div className="cw-screen-head">
        <div className="stack">
          <span className="cw-section-label">— Gespeicherte Partien</span>
          <h1 className="cw-h1">Partien-<span className="accent">Archiv</span></h1>
        </div>
        {canSave && (
          <button className="cw-recpill" onClick={onSave} style={{ alignSelf: 'flex-end' }}>
            + Speichern
          </button>
        )}
      </div>

      <div className="cw-arch-list">
        {!games?.length && <span className="cw-hint">Noch keine Partien gespeichert.</span>}
        {games?.map((g) => {
          const r = resultView(g.result)
          return (
            <div key={g.id} className="cw-arch-item" role="button" onClick={() => onOpen(g)}>
              <div className="cw-arch-res" style={{ background: r.bg, color: r.fg }}>{r.txt}</div>
              <div className="cw-arch-meta">
                <div className="t">{g.name}</div>
                <div className="s">
                  {new Date(g.createdAt).toLocaleDateString('de-DE')} · {g.moves.length} Züge · {r.word}
                </div>
              </div>
              <button className="cw-arch-act" onClick={(e) => { e.stopPropagation(); downloadPgn(g) }} title="PGN exportieren">{Icon.download({ size: 17 })}</button>
              <button className="cw-arch-del" onClick={(e) => { e.stopPropagation(); setDel(g) }} title="Löschen">✕</button>
              <span style={{ display: 'flex', color: 'var(--faint)' }}>{Icon.chevron({ size: 18 })}</span>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title="Partie löschen?"
        description={`„${del?.name ?? ''}" wird dauerhaft entfernt.`}
        confirmLabel="Löschen"
        onConfirm={() => del && db.games.delete(del.id)}
      />
    </div>
  )
}
