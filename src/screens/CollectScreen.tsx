import { useEffect, useRef, useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, ensureAuth } from '../lib/firebase'
import { PositionEditor } from './PositionEditor'
import { Icon } from '../ui/icons'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const CAP = 640 // Kantenlänge des quadratischen Captures (klein → unter 1 MB Firestore-Limit)
const MAX_LEN = 950_000 // Sicherheitsgrenze für das base64-Feld (< 1 MB Dokument)

type Step = 'capture' | 'label' | 'uploading'

// JPEG-DataURL mit fallender Qualität, bis es sicher unter MAX_LEN passt.
function encode(cv: HTMLCanvasElement): string {
  for (const q of [0.85, 0.75, 0.65, 0.5]) {
    const u = cv.toDataURL('image/jpeg', q)
    if (u.length <= MAX_LEN) return u
  }
  return cv.toDataURL('image/jpeg', 0.4)
}

// Sammelt (Foto, Stellung)-Paare des eigenen Bretts und legt sie in Firestore ab
// (Bild als base64 im Dokument – kostenloser Spark-Tarif, kein Storage nötig).
// Ziel: Finetuning auf dem eigenen Set.
export function CollectScreen() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [step, setStep] = useState<Step>('capture')
  const [shot, setShot] = useState<string | null>(null) // DataURL
  const [labelFen, setLabelFen] = useState(START_FEN)
  const [lastFen, setLastFen] = useState(START_FEN)
  const [count, setCount] = useState(0)
  const [toast, setToast] = useState('')
  const [camOk, setCamOk] = useState<boolean | null>(null)

  function flash(m: string) {
    setToast(m)
    setTimeout(() => setToast(''), 2000)
  }

  // Kamera nur im Capture-Schritt laufen lassen.
  useEffect(() => {
    if (step !== 'capture') return
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: 1280, height: 1280 },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
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

  // Mittigen Quadrat-Crop aus dem Videoframe schneiden (passt zum Modell-Input).
  function capture() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const side = Math.min(v.videoWidth, v.videoHeight)
    const cv = document.createElement('canvas')
    cv.width = CAP
    cv.height = CAP
    cv.getContext('2d')!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, CAP, CAP)
    setShot(encode(cv))
    setLabelFen(lastFen) // Vorbelegen mit letzter Stellung (oft nur 1 Zug Unterschied)
    setStep('label')
  }

  // Foto aus der Galerie statt Live-Kamera (Fallback / Desktop).
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
    setShot(encode(cv))
    setLabelFen(lastFen)
    setStep('label')
  }

  // Stellung gelabelt → Bild (base64) + FEN nach Firestore.
  async function upload(fen: string) {
    if (!shot) return
    setStep('uploading')
    flash('Speichere …')
    try {
      const uid = await ensureAuth()
      await addDoc(collection(db, 'samples'), {
        uid,
        fen: fen.split(' ')[0], // nur das Stellungsfeld – das labelt der Editor
        fullFen: fen,
        image: shot, // DataURL (image/jpeg;base64)
        size: CAP,
        createdAt: serverTimestamp(),
      })
      setShot(null)
      setLastFen(fen)
      setCount((c) => c + 1)
      setStep('capture')
      flash('Gespeichert ✓')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setStep('label')
      flash(msg.includes('permission') || msg.includes('insufficient')
        ? 'Abgelehnt – Firestore-Rules/Anonymous-Auth prüfen'
        : 'Speichern fehlgeschlagen')
    }
  }

  function discard() {
    setShot(null)
    setStep('capture')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cw-card" style={{ fontSize: 13, color: 'var(--muted-2)', lineHeight: 1.5 }}>
        Foto deines Bretts aufnehmen → Stellung antippen → speichern. So lernt das
        Modell <strong>dein</strong> Set. Ziel: 30–50 Fotos aus verschiedenen
        Winkeln & Stellungen. <strong>{count}</strong> in dieser Sitzung gespeichert.
      </div>

      {step === 'capture' && (
        <>
          <div className="cw-board-panel" style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
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
        </>
      )}

      {(step === 'label' || step === 'uploading') && shot && (
        <>
          <div className="cw-board-panel" style={{ aspectRatio: '1 / 1', overflow: 'hidden' }}>
            <img src={shot} alt="Aufnahme" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>
            Stelle die Figuren genau wie auf dem Foto aufs Brett – dann „Speichern".
          </div>
          <PositionEditor initialFen={labelFen} onApply={upload} />
          <button className="cw-tool" onClick={discard} disabled={step === 'uploading'} style={{ justifyContent: 'center' }}>
            Verwerfen, neues Foto
          </button>
        </>
      )}

      {toast && <div className="cw-toast">{toast}</div>}
    </div>
  )
}
