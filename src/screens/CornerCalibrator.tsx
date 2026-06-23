import { useRef, useState } from 'react'
import type { Pt } from '../vision/homography'

const LABELS = ['1', '2', '3', '4'] // TL, TR, BR, BL

// Lässt den Nutzer die 4 Brettecken auf einem Foto antippen/ziehen.
// Gibt die Ecken in BILD-Koordinaten zurück (Reihenfolge TL, TR, BR, BL).
export function CornerCalibrator({
  src,
  natW,
  natH,
  onConfirm,
  onCancel,
}: {
  src: string
  natW: number
  natH: number
  onConfirm: (corners: Pt[], orientation: 'white' | 'black') => void
  onCancel: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<number | null>(null)
  // Normalisierte Punkte (0..1) relativ zur angezeigten Bildfläche.
  const [pts, setPts] = useState<[number, number][]>([
    [0.18, 0.18], [0.82, 0.18], [0.82, 0.82], [0.18, 0.82],
  ])
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')

  function move(clientX: number, clientY: number) {
    const i = dragRef.current
    if (i === null || !wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
    setPts((p) => p.map((pt, k) => (k === i ? [x, y] : pt)))
  }

  function confirm() {
    const corners: Pt[] = pts.map(([x, y]) => [x * natW, y * natH])
    onConfirm(corners, orientation)
  }

  const poly = pts.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')

  return (
    <div className="cw-cal">
      <div className="cw-cal-hint">Tippe/ziehe die 4 <b>Brettecken</b>: 1 oben-links, 2 oben-rechts, 3 unten-rechts, 4 unten-links.</div>
      <div
        className="cw-cal-stage"
        ref={wrapRef}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={() => { dragRef.current = null }}
      >
        <img src={src} alt="" draggable={false} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="cw-cal-svg">
          <polygon points={poly} fill="rgba(142,139,94,.18)" stroke="#8e8b5e" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {pts.map(([x, y], i) => (
          <div
            key={i}
            className="cw-cal-handle"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            onPointerDown={(e) => { dragRef.current = i; (e.target as HTMLElement).setPointerCapture(e.pointerId) }}
          >
            {LABELS[i]}
          </div>
        ))}
      </div>

      <div className="cw-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="cw-acc-cap">Unten ist</span>
        <div className="cw-seg" style={{ flex: 'none', padding: 3 }}>
          <button className={orientation === 'white' ? 'active' : ''} onClick={() => setOrientation('white')} style={{ padding: '6px 12px' }}>Weiß</button>
          <button className={orientation === 'black' ? 'active' : ''} onClick={() => setOrientation('black')} style={{ padding: '6px 12px' }}>Schwarz</button>
        </div>
      </div>

      <div className="cw-tools">
        <button className="cw-tool" onClick={onCancel}>Abbrechen</button>
        <button className="cw-tool" style={{ background: 'var(--accent)', color: '#211c1b', justifyContent: 'center' }} onClick={confirm}>✓ Stellung erkennen</button>
      </div>
    </div>
  )
}
