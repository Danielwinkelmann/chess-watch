import { useState } from 'react'
import { Chess } from 'chess.js'
import { Icon } from '../ui/icons'
import { getVision } from '../workers/clients'
import { mapDetectionsToBoard } from '../vision/board'
import { placementToFenField } from '../vision/toFen'
import { detectMove, StabilityTracker } from '../game/moveDetection'
import { useVisionStatus, loadVisionModel } from '../game/visionModel'
import { db, newGameId, type Game, type RecordedMove } from '../storage/db'

const SAMPLE_STEP = 1.0 // Sekunden zwischen Frames

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    const on = () => { video.removeEventListener('seeked', on); res() }
    video.addEventListener('seeked', on)
    video.currentTime = Math.min(t, video.duration - 0.05)
  })
}

export function VideoAnalysis({ onSaved }: { onSaved: (g: Game) => void }) {
  const visionStatus = useVisionStatus()
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'err'>('idle')
  const [progress, setProgress] = useState(0)
  const [info, setInfo] = useState('')
  const [moves, setMoves] = useState<string[]>([])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (visionStatus !== 'ready') {
      setInfo('Erst Erkennungsmodell laden …')
      await loadVisionModel()
      if ((await getVision().isReady()) !== true) { setInfo('Modell nicht geladen'); return }
    }

    setPhase('running')
    setMoves([])
    setProgress(0)
    setInfo('Video wird gelesen …')

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.src = URL.createObjectURL(file)
    await new Promise<void>((res) => { video.onloadedmetadata = () => res() })
    const dur = video.duration || 0
    const cvs = document.createElement('canvas')

    const chess = new Chess()
    const stab = new StabilityTracker(2)
    const recorded: RecordedMove[] = []
    let ply = 0

    try {
      for (let t = 0; t <= dur; t += SAMPLE_STEP) {
        await seekTo(video, t)
        const vw = video.videoWidth, vh = video.videoHeight
        if (!vw) continue
        cvs.width = vw; cvs.height = vh
        const ctx = cvs.getContext('2d')!
        ctx.drawImage(video, 0, 0, vw, vh)
        const img = ctx.getImageData(0, 0, vw, vh)
        const dets = await getVision().detect({ data: img.data, width: vw, height: vh })
        const mapping = mapDetectionsToBoard(dets, 'white')
        if (mapping) {
          const field = placementToFenField(mapping.placement)
          const stable = stab.push(field)
          if (stable) {
            const mv = detectMove(chess, stable)
            if (mv) {
              const before = chess.fen()
              chess.move(mv)
              recorded.push({ ply, san: mv.san, fenBefore: before, fenAfter: chess.fen(), cp: null, mate: null, deltaCp: null, quality: null, comment: '', ts: Date.now() })
              ply++
              setMoves((m) => [...m, mv.san])
              stab.reset()
            }
          }
        }
        setProgress(dur ? Math.min(100, (t / dur) * 100) : 0)
        setInfo(`Analysiere … ${recorded.length} Züge erkannt`)
      }

      URL.revokeObjectURL(video.src)
      if (!recorded.length) { setPhase('err'); setInfo('Keine Züge erkannt – Video möglichst frontal & ruhig.'); return }

      const now = Date.now()
      const result = chess.isCheckmate() ? (chess.turn() === 'w' ? '0-1' : '1-0') : chess.isDraw() ? '1/2-1/2' : '*'
      const game: Game = {
        id: newGameId(), name: `Video-Analyse ${new Date().toLocaleString('de-DE')}`,
        pgn: chess.pgn(), finalFen: chess.fen(), moves: recorded, result, createdAt: now, updatedAt: now, syncState: 'local',
      }
      await db.games.put(game)
      setPhase('done')
      setInfo(`${recorded.length} Züge erkannt – im Archiv gespeichert.`)
      onSaved(game)
    } catch (err) {
      console.error('[Video]', err)
      setPhase('err')
      setInfo('Video konnte nicht analysiert werden.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
        Lade ein Video deiner Partie hoch. Chess Watch tastet die Frames mit der Brett-Erkennung ab und rekonstruiert die Zugfolge. Am besten <b style={{ color: 'var(--text-2)' }}>frontal/leicht schräg, ruhig</b> und ohne Hände im Bild.
      </p>

      {phase !== 'running' && (
        <label className="cw-vid-drop">
          {Icon.video({ size: 30 })}
          <strong style={{ color: 'var(--text)', textTransform: 'uppercase', fontStyle: 'italic' }}>Video auswählen</strong>
          <span style={{ fontSize: 12 }}>MP4 / MOV · vom Gerät</span>
          <input type="file" accept="video/*" onChange={onFile} style={{ display: 'none' }} />
        </label>
      )}

      {phase === 'running' && (
        <div className="cw-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="cw-vid-prog"><i style={{ width: `${progress}%` }} /></div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{info}</span>
        </div>
      )}

      {(phase === 'done' || phase === 'err') && info && (
        <div className="cw-card" style={{ fontSize: 13, color: phase === 'err' ? '#c76a5f' : 'var(--accent)' }}>{info}</div>
      )}

      {moves.length > 0 && (
        <div className="cw-card" style={{ fontFamily: 'var(--font)', fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)' }}>
          {moves.map((m, i) => (
            <span key={i}>{i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{m} </span>
          ))}
        </div>
      )}
    </div>
  )
}
