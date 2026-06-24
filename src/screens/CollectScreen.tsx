import { useEffect, useRef, useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, ensureAuth } from '../lib/firebase'
import { getVision } from '../workers/clients'
import { PositionEditor } from './PositionEditor'
import { Icon } from '../ui/icons'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const CAP = 640 // Kantenlänge des quadratischen Captures (klein → unter 1 MB Firestore-Limit)
const MAX_LEN = 950_000 // Sicherheitsgrenze für das base64-Feld (< 1 MB Dokument)

type Step = 'capture' | 'review' | 'label' | 'uploading'
interface Shot {
  dataUrl: string
  frame: { data: Uint8ClampedArray; width: number; height: number }
}

function encode(cv: HTMLCanvasElement): string {
  for (const q of [0.85, 0.75, 0.65, 0.5]) {
    const u = cv.toDataURL('image/jpeg', q)
    if (u.length <= MAX_LEN) return u
  }
  return cv.toDataURL('image/jpeg', 0.4)
}

// Canvas → Shot (DataURL fürs Speichern + RGBA-Frame für die KI).
function toShot(cv: HTMLCanvasElement): Shot {
  const ctx = cv.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, CAP, CAP)
  return { dataUrl: encode(cv), frame: { data, width: CAP, height: CAP } }
}

// Sammelt (Foto, Stellung)-Paare des eigenen Bretts → Firestore (base64 im Doc).
// KI füllt die Stellung vor (nur korrigieren); „gleiche Stellung" spart das
// Labeln bei mehreren Winkeln derselben Stellung.
export function CollectScreen() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [step, setStep] = useState<Step>('capture')
  const [shot, setShot] = useState<Shot | null>(null)
  const [labelFen, setLabelFen] = useState(START_FEN)
  const [sessionFen, setSessionFen] = useState<string | null>(null)
  const [keepSame, setKeepSame] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [count, setCount] = useState(0)
  const [toast, setToast] = useState('')
  const [camOk, setCamOk] = useState<boolean | null>(null)

  function flash(m: string) {
    setToast(m)
    setTimeout(() => setToast(''), 2200)
  }

  useEffect(() => {
    if (step !== 'capture') return
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: 1280, height: 1280 },
          audio: false,
        })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          await v.play()
        }
        setCamOk(true)
      } catch {
        setCamOk(false)
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [step])

  // KI-Vorschlag holen (best effort): Recognizer → FEN ins Brett vorbelegen.
  // Fällt das Modell aus (z. B. live noch nicht gehostet), bleibt der Fallback.
  async function runAi(frame: Shot['frame'], fallback: string) {
    setLabelFen(fallback)
    setAiBusy(true)
    try {
      await getVision().loadRecognizer()
      const field = await getVision().recognize(frame)
      setLabelFen(`${field} w - - 0 1`)
    } catch {
      /* Fallback bleibt */
    } finally {
      setAiBusy(false)
    }
  }

  function gotShot(s: Shot) {
    setShot(s)
    if (keepSame && sessionFen) {
      setStep('review') // gleiche Stellung → ein Tap zum Speichern
    } else {
      setStep('label')
      runAi(s.frame, sessionFen || START_FEN)
    }
  }

  function capture() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const side = Math.min(v.videoWidth, v.videoHeight)
    const cv = document.createElement('canvas')
    cv.width = CAP
    cv.height = CAP
    cv.getContext('2d')!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, CAP, CAP)
    gotShot(toShot(cv))
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const bmp = await createImageBitmap(file)
    const side = Math.min(bmp.width, bmp.height)
    const cv = document.createElement('canvas')
    cv.width = CAP
    cv.height = CAP
    cv.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, CAP, CAP)
    bmp.close?.()
    gotShot(toShot(cv))
  }

  async function upload(fen: string) {
    if (!shot) return
    setStep('uploading')
    flash('Speichere …')
    try {
      const uid = await ensureAuth()
      await addDoc(collection(db, 'samples'), {
        uid,
        fen: fen.split(' ')[0],
        fullFen: fen,
        image: shot.dataUrl,
        size: CAP,
        createdAt: serverTimestamp(),
      })
      if (keepSame) setSessionFen(fen)
      setShot(null)
      setCount((c) => c + 1)
      setStep('capture')
      flash('Gespeichert ✓')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setStep(keepSame && sessionFen ? 'review' : 'label')
      flash(msg.includes('permission') || msg.includes('insufficient')
        ? 'Abgelehnt – Firestore-Rules/Anonymous-Auth prüfen'
        : 'Speichern fehlgeschlagen')
    }
  }

  function correct() {
    if (!shot) return
    setStep('label')
    runAi(shot.frame, sessionFen || START_FEN)
  }

  function discard() {
    setShot(null)
    setStep('capture')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cw-card" style={{ fontSize: 13, color: 'var(--muted-2)', lineHeight: 1.5 }}>
        Foto deines Bretts → KI schlägt die Stellung vor → korrigieren → speichern.
        So lernt das Modell <strong>dein</strong> Set. <strong>{count}</strong> in
        dieser Sitzung gespeichert.
      </div>

      {/* Sitzungs-Stellung: gleiche Stellung, nur Winkel wechseln */}
      <label className="cw-card" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
        <input type="checkbox" checked={keepSame} onChange={(e) => { setKeepSame(e.target.checked); if (!e.target.checked) setSessionFen(null) }} />
        <span>Gleiche Stellung in dieser Sitzung <span style={{ color: 'var(--muted-2)' }}>(nur Winkel ändern – dann 1 Tap pro Foto)</span></span>
      </label>

      {step === 'capture' && (
        <>
          <div className="cw-board-panel" style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
            <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 8, border: '2px dashed rgba(255,255,255,.5)', borderRadius: 8, pointerEvents: 'none' }} />
            {camOk === false && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20, color: 'var(--muted-2)' }}>
                Keine Kamera – nutze „Aus Galerie".
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="cw-tool" onClick={capture} disabled={camOk !== true} style={{ justifyContent: 'center', background: 'var(--accent)', color: '#211c1b' }}>
              {Icon.camera({ size: 18 })} Foto aufnehmen
            </button>
            <label className="cw-tool" style={{ justifyContent: 'center', cursor: 'pointer' }}>
              {Icon.image({ size: 18 })} Aus Galerie
              <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
            </label>
          </div>
          {keepSame && sessionFen && (
            <div style={{ fontSize: 12, color: 'var(--muted-2)', textAlign: 'center' }}>
              Gemerkte Stellung aktiv – nächstes Foto wird mit einem Tap gespeichert.
            </div>
          )}
        </>
      )}

      {step === 'review' && shot && (
        <>
          <div className="cw-board-panel" style={{ aspectRatio: '1 / 1', overflow: 'hidden' }}>
            <img src={shot.dataUrl} alt="Aufnahme" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>Gleiche Stellung wie gemerkt. Passt sie?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="cw-tool" onClick={() => upload(sessionFen!)} style={{ justifyContent: 'center', background: 'var(--accent)', color: '#211c1b' }}>
              Speichern
            </button>
            <button className="cw-tool" onClick={correct} style={{ justifyContent: 'center' }}>Stellung ändern</button>
          </div>
          <button className="cw-tool" onClick={discard} style={{ justifyContent: 'center' }}>Verwerfen</button>
        </>
      )}

      {(step === 'label' || step === 'uploading') && shot && (
        <>
          <div className="cw-board-panel" style={{ aspectRatio: '1 / 1', overflow: 'hidden' }}>
            <img src={shot.dataUrl} alt="Aufnahme" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          {aiBusy ? (
            <div className="cw-card" style={{ textAlign: 'center', color: 'var(--muted-2)', fontSize: 13 }}>
              🧠 KI erkennt die Stellung …
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>
                KI-Vorschlag – korrigiere falsche Felder, dann „Speichern".
              </div>
              <PositionEditor key={labelFen} initialFen={labelFen} onApply={upload} />
            </>
          )}
          <button className="cw-tool" onClick={discard} disabled={step === 'uploading'} style={{ justifyContent: 'center' }}>
            Verwerfen, neues Foto
          </button>
        </>
      )}

      {toast && <div className="cw-toast">{toast}</div>}
    </div>
  )
}
