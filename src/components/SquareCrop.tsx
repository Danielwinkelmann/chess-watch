import { useEffect, useRef, useState } from 'react'

const CAP = 640 // Ausgabe-Kantenlänge

// Schneidet ein beliebiges Bild auf ein Quadrat zu: Bild unter einem festen
// Quadrat-Fenster verschieben (ziehen) und zoomen (Slider). Liefert ein
// CAP×CAP-Canvas an onDone.
export function SquareCrop({
  src,
  onDone,
  onCancel,
}: {
  src: string
  onDone: (canvas: HTMLCanvasElement) => void
  onCancel: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const offset = useRef({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [ready, setReady] = useState(false)

  function geom() {
    const img = imgRef.current!
    const base = Math.max(CAP / img.naturalWidth, CAP / img.naturalHeight)
    const scale = base * zoom
    return { dw: img.naturalWidth * scale, dh: img.naturalHeight * scale }
  }
  function clamp() {
    const { dw, dh } = geom()
    offset.current.x = Math.min(0, Math.max(CAP - dw, offset.current.x))
    offset.current.y = Math.min(0, Math.max(CAP - dh, offset.current.y))
  }
  function draw() {
    const c = canvasRef.current
    const img = imgRef.current
    if (!c || !img) return
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, CAP, CAP)
    const { dw, dh } = geom()
    ctx.drawImage(img, offset.current.x, offset.current.y, dw, dh)
  }

  // Bild laden + mittig einpassen.
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setReady(true)
    }
    img.src = src
  }, [src])

  // Bei Bild- oder Zoom-Änderung neu zentrieren/zeichnen.
  useEffect(() => {
    if (!ready || !imgRef.current) return
    const { dw, dh } = geom()
    // Zoom hält den Mittelpunkt: einfache Re-Zentrierung reicht hier.
    offset.current = { x: (CAP - dw) / 2, y: (CAP - dh) / 2 }
    clamp()
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, zoom])

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const c = canvasRef.current!
    const k = CAP / c.clientWidth
    offset.current.x += (e.clientX - drag.current.x) * k
    offset.current.y += (e.clientY - drag.current.y) * k
    drag.current = { x: e.clientX, y: e.clientY }
    clamp()
    draw()
  }
  function onPointerUp() {
    drag.current = null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="cw-board-panel" style={{ aspectRatio: '1 / 1', overflow: 'hidden', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={CAP}
          height={CAP}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--muted-2)' }}>
        <span>Zoom</span>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Bild ziehen zum Verschieben – Brett mittig im Quadrat platzieren.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button className="cw-tool" onClick={() => canvasRef.current && onDone(canvasRef.current)} style={{ justifyContent: 'center', background: 'var(--accent)', color: '#211c1b' }}>
          Übernehmen
        </button>
        <button className="cw-tool" onClick={onCancel} style={{ justifyContent: 'center' }}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
