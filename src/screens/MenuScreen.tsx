import { useState } from 'react'
import { Chess } from 'chess.js'
import { Dialog } from '@base-ui-components/react/dialog'
import type { Arrow } from 'react-chessboard'
import { BoardView } from '../components/BoardView'
import { Icon } from '../ui/icons'
import { ACCENT } from '../ui/quality'
import { formatEval } from '../engine/evaluation'
import { useEngineAnalysis } from '../game/useEngineAnalysis'
import { useVisionStatus, loadVisionModel } from '../game/visionModel'
import { getVision } from '../workers/clients'
import { mapDetectionsWithCorners } from '../vision/board'
import { placementToFen } from '../vision/toFen'
import { PositionEditor } from './PositionEditor'
import { VideoAnalysis } from './VideoAnalysis'
import { CornerCalibrator } from './CornerCalibrator'
import type { Pt } from '../vision/homography'
import type { Game } from '../storage/db'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
type Mode = 'analyse' | 'build' | 'video'

export function MenuScreen({ liveFen, onOpenGame }: { liveFen: string; onOpenGame: (g: Game) => void }) {
  const [mode, setMode] = useState<Mode>('analyse')
  const [fen, setFen] = useState(START_FEN)
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [toast, setToast] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteVal, setPasteVal] = useState('')
  const [photo, setPhoto] = useState<'idle' | 'working' | 'done' | 'err'>('idle')
  const [calib, setCalib] = useState<{ src: string; bmp: ImageBitmap } | null>(null)

  const visionStatus = useVisionStatus()
  const analysis = useEngineAnalysis(fen, true)
  const arrows: Arrow[] = analysis.bestUci
    ? [{ startSquare: analysis.bestUci.slice(0, 2), endSquare: analysis.bestUci.slice(2, 4), color: ACCENT }]
    : []

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 1800)
  }

  function onMove(from: string, to: string): boolean {
    const c = new Chess(fen)
    try {
      const m = c.move({ from, to, promotion: 'q' })
      if (!m) return false
    } catch {
      return false
    }
    setFen(c.fen())
    return true
  }

  async function copyFen() {
    try {
      await navigator.clipboard.writeText(fen)
      flash('FEN kopiert')
    } catch {
      flash('Kopieren nicht möglich')
    }
  }

  function applyPaste() {
    const v = pasteVal.trim()
    try {
      const c = new Chess(v)
      setFen(c.fen())
      setPasteOpen(false)
      flash('Stellung geladen')
    } catch {
      flash('Ungültige FEN')
    }
  }

  // Foto wählen → Kalibrator öffnen (Ecken antippen) statt direkt zu raten.
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (visionStatus !== 'ready') {
      flash('Lade Erkennungsmodell …')
      await loadVisionModel()
    }
    try {
      const bmp = await createImageBitmap(file)
      setCalib({ src: URL.createObjectURL(file), bmp })
    } catch {
      flash('Bild konnte nicht geladen werden')
    }
  }

  // Nach Eckpunkt-Kalibrierung: erkennen + perspektivisch entzerren.
  async function runDetection(corners: Pt[], orient: 'white' | 'black') {
    const c = calib
    if (!c) return
    setCalib(null)
    setPhoto('working')
    flash('Analysiere Foto …')
    try {
      const cvs = document.createElement('canvas')
      cvs.width = c.bmp.width
      cvs.height = c.bmp.height
      const ctx = cvs.getContext('2d')!
      ctx.drawImage(c.bmp, 0, 0)
      const img = ctx.getImageData(0, 0, c.bmp.width, c.bmp.height)
      const dets = await getVision().detect({ data: img.data, width: c.bmp.width, height: c.bmp.height })
      const placement = mapDetectionsWithCorners(dets, corners, orient)
      URL.revokeObjectURL(c.src)
      setFen(placementToFen(placement))
      setOrientation(orient)
      setPhoto('done')
      flash('Aus Foto erstellt')
    } catch {
      setPhoto('err')
      flash('Foto konnte nicht analysiert werden')
    }
  }

  return (
    <div className="cw-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="cw-section-label">— Werkzeuge</span>
        <h1 className="cw-h1">
          {mode === 'analyse' ? <>Analyse-<span className="accent">brett</span></> : mode === 'build' ? <>Stellung <span className="accent">aufbauen</span></> : <>Video-<span className="accent">Analyse</span></>}
        </h1>
      </div>

      <div className="cw-seg">
        <button className={mode === 'analyse' ? 'active' : ''} onClick={() => setMode('analyse')}>Analyse</button>
        <button className={mode === 'build' ? 'active' : ''} onClick={() => setMode('build')}>Aufbauen</button>
        <button className={mode === 'video' ? 'active' : ''} onClick={() => setMode('video')}>Video</button>
      </div>

      {mode === 'build' && (
        <PositionEditor initialFen={fen} onApply={(f) => { setFen(f); setMode('analyse'); flash('Stellung übernommen') }} />
      )}
      {mode === 'video' && <VideoAnalysis onSaved={onOpenGame} />}

      {mode === 'analyse' && calib && (
        <CornerCalibrator
          src={calib.src}
          natW={calib.bmp.width}
          natH={calib.bmp.height}
          onConfirm={runDetection}
          onCancel={() => { URL.revokeObjectURL(calib.src); setCalib(null) }}
        />
      )}

      {mode === 'analyse' && !calib && (<>
      <div className="cw-board-panel">
        <BoardView fen={fen} orientation={orientation} onMove={onMove} arrows={arrows} />
      </div>

      {/* Engine-Zeile */}
      <div className="cw-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="engine-stat" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="cw-acc-cap">Bewertung</span>
          <strong style={{ fontWeight: 700 }}>{analysis.evaluation ? formatEval(analysis.evaluation) : '…'}</strong>
        </div>
        <div className="engine-stat" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="cw-acc-cap">Bester Zug</span>
          <strong style={{ fontWeight: 700 }}>{analysis.bestSan ?? (analysis.thinking ? 'rechnet …' : '–')}</strong>
        </div>
        <span style={{ flex: 1 }} />
        <button className="cw-recpill" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>Drehen</button>
      </div>

      {/* Werkzeuge */}
      <div className="cw-tools">
        <button className="cw-tool" onClick={copyFen}>{Icon.copy()} FEN kopieren</button>
        <button className="cw-tool" onClick={() => { setPasteVal(''); setPasteOpen(true) }}>{Icon.paste()} FEN einfügen</button>
        <label className="cw-tool">
          {photo === 'working' ? <span style={{ animation: 'cw-spin 1s linear infinite', display: 'inline-flex' }}>{Icon.detect({ size: 18 })}</span> : Icon.image()}
          {photo === 'working' ? 'Analysiere …' : 'Aus Foto erstellen'}
          <input type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />
        </label>
        <button className="cw-tool" onClick={() => { setFen(liveFen); flash('Live-Stellung geladen') }}>{Icon.board({ size: 18 })} Aus Live laden</button>
        <button className="cw-tool" onClick={() => setFen(START_FEN)}>{Icon.first({ size: 18 })} Grundstellung</button>
      </div>

      <div className="cw-fen-box" onClick={copyFen} title="Tippen zum Kopieren">{fen}</div>
      </>)}

      {toast && <div className="cw-toast">{toast}</div>}

      <Dialog.Root open={pasteOpen} onOpenChange={setPasteOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="ui-backdrop" />
          <Dialog.Popup className="ui-dialog">
            <Dialog.Title className="ui-dialog-title">FEN einfügen</Dialog.Title>
            <Dialog.Description className="ui-dialog-desc">Füge eine FEN-Zeichenkette ein, um die Stellung zu laden.</Dialog.Description>
            <textarea
              className="ui-input"
              rows={3}
              value={pasteVal}
              onChange={(e) => setPasteVal(e.target.value)}
              placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              autoFocus
            />
            <div className="ui-dialog-actions">
              <Dialog.Close className="ui-btn ghost">Abbrechen</Dialog.Close>
              <button className="ui-btn primary" onClick={applyPaste} disabled={!pasteVal.trim()}>Laden</button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
