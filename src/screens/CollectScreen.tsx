import { useEffect, useRef, useState } from 'react'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { storage, db, ensureAuth } from '../lib/firebase'
import { PositionEditor } from './PositionEditor'
import { Icon } from '../ui/icons'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const CAP = 800 // Kantenlänge des quadratischen Captures

type Step = 'capture' | 'label' | 'uploading'

// Sammelt (Foto, Stellung)-Paare des eigenen Bretts und lädt sie nach Firebase
// (Storage = Bild, Firestore = Label/FEN). Ziel: Finetuning auf dem eigenen Set.
export function CollectScreen() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [step, setStep] = useState<Step>('capture')
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null)
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
  async function capture() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const side = Math.min(v.videoWidth, v.videoHeight)
    const sx = (v.videoWidth - side) / 2
    const sy = (v.videoHeight - side) / 2
    const cv = document.createElement('canvas')
    cv.width = CAP
    cv.height = CAP
    cv.getContext('2d')!.drawImage(v, sx, sy, side, side, 0, 0, CAP, CAP)
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.9))
    if (!blob) return
    setShot({ blob, url: URL.createObjectURL(blob) })
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
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.9))
    if (!blob) return
    setShot({ blob, url: URL.createObjectURL(blob) })
    setLabelFen(lastFen)
    setStep('label')
  }

  // Stellung gelabelt → Bild + FEN nach Firebase hochladen.
  async function upload(fen: string) {
    if (!shot) return
    setStep('uploading')
    flash('Lade hoch …')
    try {
      const uid = await ensureAuth()
      const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const path = `training/${uid}/${id}.jpg`
      const r = storageRef(storage, path)
      await uploadBytes(r, shot.blob, { contentType: 'image/jpeg' })
      const url = await getDownloadURL(r)
      await addDoc(collection(db, 'samples'), {
        uid,
        fen: fen.split(' ')[0], // nur das Stellungsfeld – das labelt der Editor
        fullFen: fen,
        path,
        url,
        createdAt: serverTimestamp(),
      })
      URL.revokeObjectURL(shot.url)
      setShot(null)
      setLastFen(fen)
      setCount((c) => c + 1)
      setStep('capture')
      flash('Gespeichert ✓')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setStep('label')
      flash(msg.includes('permission') || msg.includes('unauthorized')
        ? 'Upload abgelehnt – Firebase-Rules/Storage prüfen'
        : 'Upload fehlgeschlagen')
    }
  }

  function discard() {
    if (shot) URL.revokeObjectURL(shot.url)
    setShot(null)
    setStep('capture')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cw-card" style={{ fontSize: 13, color: 'var(--muted-2)', lineHeight: 1.5 }}>
        Foto deines Bretts aufnehmen → Stellung antippen → hochladen. So lernt das
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
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'none' }}
            />
            {/* Quadrat-Hilfsrahmen */}
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
            <img src={shot.url} alt="Aufnahme" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
