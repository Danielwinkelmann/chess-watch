import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/icons'
import { SquareCrop } from './SquareCrop'

const CAP = 640

// Quadratische Bildauswahl: Live-Kamera (1:1, mittiger Crop) ODER Upload mit
// verschieb-/zoombarem Quadrat-Crop. Liefert ein CAP×CAP-Canvas an onPick.
export function SquareImagePicker({
  onPick,
  onCancel,
}: {
  onPick: (canvas: HTMLCanvasElement) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<'choose' | 'camera' | 'crop'>('choose')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camOk, setCamOk] = useState<boolean | null>(null)

  useEffect(() => {
    if (mode !== 'camera') return
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
  }, [mode])

  function shoot() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const side = Math.min(v.videoWidth, v.videoHeight)
    const cv = document.createElement('canvas')
    cv.width = CAP
    cv.height = CAP
    cv.getContext('2d')!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, CAP, CAP)
    onPick(cv)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    setMode('crop')
  }

  if (mode === 'crop' && cropSrc) {
    return (
      <SquareCrop
        src={cropSrc}
        onDone={(cv) => {
          URL.revokeObjectURL(cropSrc)
          onPick(cv)
        }}
        onCancel={() => {
          URL.revokeObjectURL(cropSrc)
          setCropSrc(null)
          setMode('choose')
        }}
      />
    )
  }

  if (mode === 'camera') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="cw-board-panel" style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 8, border: '2px dashed rgba(255,255,255,.5)', borderRadius: 8, pointerEvents: 'none' }} />
          {camOk === false && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20, color: 'var(--muted-2)' }}>
              Keine Kamera – nutze „Hochladen".
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="cw-tool" onClick={shoot} disabled={camOk !== true} style={{ justifyContent: 'center', background: 'var(--accent)', color: '#211c1b' }}>
            {Icon.camera({ size: 18 })} Auslösen
          </button>
          <button className="cw-tool" onClick={() => setMode('choose')} style={{ justifyContent: 'center' }}>
            Zurück
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button className="cw-tool" onClick={() => setMode('camera')} style={{ justifyContent: 'center', background: 'var(--accent)', color: '#211c1b' }}>
        {Icon.camera({ size: 18 })} Mit Kamera aufnehmen
      </button>
      <label className="cw-tool" style={{ justifyContent: 'center', cursor: 'pointer' }}>
        {Icon.image({ size: 18 })} Bild hochladen &amp; zuschneiden
        <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      </label>
      <button className="cw-tool" onClick={onCancel} style={{ justifyContent: 'center' }}>
        Abbrechen
      </button>
    </div>
  )
}
