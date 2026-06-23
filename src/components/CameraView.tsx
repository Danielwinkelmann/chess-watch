import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Chess } from 'chess.js'
import { getVision } from '../workers/clients'
import { mapDetectionsToBoard } from '../vision/board'
import { placementToFenField } from '../vision/toFen'
import { detectMove, StabilityTracker } from '../game/moveDetection'
import { HandGate } from '../vision/handGate'
import { type Detection } from '../vision/detect'
import { Icon } from '../ui/icons'
import { useVisionStatus, loadVisionModel } from '../game/visionModel'

interface CameraViewProps {
  chess: Chess
  orientation: 'white' | 'black'
  onMove: (move: { from: string; to: string; promotion?: string }) => Promise<boolean>
}

const DETECT_INTERVAL_MS = 300 // ~3 fps

// Stabiler Schlüssel je Box (Klasse + grob gerasterter Auflagepunkt), damit
// Framer Motion ruhende Figuren wiedererkennt und Positionen weich animiert.
function boxKey(d: Detection, vw: number): string {
  const cell = vw / 12
  const cx = Math.round((d.x + d.w / 2) / cell)
  const cy = Math.round((d.y + d.h) / cell)
  return `${d.className}@${cx},${cy}`
}

export function CameraView({ chess, orientation, onMove }: CameraViewProps) {
  const visionStatus = useVisionStatus()
  const visionReady = visionStatus === 'ready'
  const videoRef = useRef<HTMLVideoElement>(null)
  const grabRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const handGateRef = useRef<HandGate | null>(null)
  const stabilityRef = useRef(new StabilityTracker(4))
  const runningRef = useRef(false)
  const lastRunRef = useRef(0)

  const [status, setStatus] = useState('Kamera aus')
  const [handBlocked, setHandBlocked] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [dets, setDets] = useState<Detection[]>([])
  const [dims, setDims] = useState({ w: 1280, h: 720 })
  const [recording, setRecording] = useState(false)

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
        audio: false,
      })
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setStreaming(true)
      setStatus('Kamera läuft')

      handGateRef.current = new HandGate()
      const gateOk = await handGateRef.current.init()
      if (!gateOk) setStatus('Kamera läuft (ohne Hand-Erkennung)')

      runningRef.current = true
      loop()
    } catch (e) {
      void e
      setStatus('Kamera konnte nicht gestartet werden')
    }
  }

  function stop() {
    runningRef.current = false
    const video = videoRef.current
    const stream = video?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    if (video) video.srcObject = null
    setStreaming(false)
    setStatus('Kamera aus')
    setDets([])
  }

  async function loop() {
    if (!runningRef.current) return
    const video = videoRef.current!
    const now = performance.now()

    if (visionReady && now - lastRunRef.current >= DETECT_INTERVAL_MS && video.videoWidth) {
      lastRunRef.current = now

      // Hand-Gate: nur lesen, wenn Brett frei ist.
      const free = handGateRef.current?.update(video, now) ?? true
      setHandBlocked(!free)

      if (free) {
        const vw = video.videoWidth
        const vh = video.videoHeight
        const grab = grabRef.current
        grab.width = vw
        grab.height = vh
        const gctx = grab.getContext('2d')!
        gctx.drawImage(video, 0, 0, vw, vh)
        const imageData = gctx.getImageData(0, 0, vw, vh)

        try {
          const found = await getVision().detect({
            data: imageData.data,
            width: vw,
            height: vh,
          })
          setDims({ w: vw, h: vh })
          setDets(found)

          const mapping = mapDetectionsToBoard(found, orientation)
          if (mapping) {
            const field = placementToFenField(mapping.placement)
            const stable = stabilityRef.current.push(field)
            if (stable) {
              const move = detectMove(chess, stable)
              if (move) {
                await onMove({ from: move.from, to: move.to, promotion: move.promotion })
                stabilityRef.current.reset()
              }
            }
          }
        } catch (e) {
          void e
          setStatus('Erkennung unterbrochen')
        }
      }
    }
    requestAnimationFrame(loop)
  }

  useEffect(() => () => stop(), [])

  // Deduplizieren je Box-Schlüssel (höchster Score gewinnt) für stabile Keys.
  const boxes = new Map<string, Detection>()
  for (const d of dets) {
    const k = boxKey(d, dims.w)
    const prev = boxes.get(k)
    if (!prev || d.score > prev.score) boxes.set(k, d)
  }

  const pieceCount = [...boxes.values()].filter((d) => d.className !== 'board').length
  const hasBoard = [...boxes.values()].some((d) => d.className === 'board')
  const detLabel = !streaming
    ? visionReady
      ? 'Bereit'
      : 'Erkennung aktivieren'
    : handBlocked
      ? 'Hand erkannt – pausiert'
      : pieceCount > 0
        ? `${pieceCount} Figuren${hasBoard ? '' : ' (kein Brett)'}`
        : 'Suche Brett …'
  const detColor = handBlocked ? '#dfb62a' : pieceCount > 0 ? '#8e8b5e' : '#9a9388'

  return (
    <div className="camera">
      <div className="cw-cam">
        <video ref={videoRef} playsInline muted />
        {/* preserveAspectRatio="none": SVG-Koordinaten = native Framekoordinaten,
            das Video nutzt object-fit:fill (s. CSS) → Boxen sitzen exakt. */}
        <svg
          className="cw-cam-overlay"
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          preserveAspectRatio="none"
        >
          {[...boxes.entries()].map(([key, d]) => {
            const isBoard = d.className === 'board'
            const color = isBoard ? '#8e8b5e' : '#dfb62a'
            const label = `${d.className.replace('white_', 'w').replace('black_', 'b').replace('board', 'Brett')} ${d.score.toFixed(2)}`
            return (
              <g key={key}>
                <rect
                  x={d.x}
                  y={d.y}
                  width={d.w}
                  height={d.h}
                  rx={4}
                  fill="none"
                  stroke={color}
                  strokeWidth={isBoard ? 3 : 2.2}
                  vectorEffect="non-scaling-stroke"
                />
                {!isBoard && (
                  <text x={d.x + 2} y={Math.max(12, d.y - 4)} fontSize={Math.max(11, dims.w / 40)} fill={color} stroke="#161311" strokeWidth={0.5} style={{ fontWeight: 700, paintOrder: 'stroke' }}>
                    {label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Status-Chip oben links */}
        <div className="cw-cam-chip" style={{ color: detColor, border: `1px solid ${detColor}55` }}>
          {detLabel}
        </div>
        <div className="cw-cam-fps">CAM · live</div>
        {streaming && (
          <div className="cw-cam-rec">
            <span style={{ width: 8, height: 8, borderRadius: 99, background: '#8e8b5e' }} />
            live
          </div>
        )}

        {/* Kamera aus → je nach Modell-Status */}
        {!streaming && (
          <div className="cw-cam-center">
            {visionStatus === 'loading' ? (
              <>
                <span style={{ color: '#8e8b5e', animation: 'cw-spin 1.1s linear infinite' }}>{Icon.detect({ size: 30, color: '#8e8b5e' })}</span>
                <div style={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase' }}>Modell <span style={{ color: '#8e8b5e' }}>lädt …</span></div>
                <div style={{ fontSize: 13, color: '#9a9388', lineHeight: 1.5, maxWidth: 240 }}>Brett-Erkennung wird geladen (~100 MB). Das passiert nur einmal.</div>
              </>
            ) : visionReady ? (
              <>
                <span style={{ color: '#8e8b5e' }}>{Icon.camera({ size: 30 })}</span>
                <div style={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase' }}>Modell <span style={{ color: '#8e8b5e' }}>bereit</span></div>
                <div style={{ fontSize: 13, color: '#9a9388', lineHeight: 1.5, maxWidth: 240 }}>Starte die Kamera, damit Chess Watch das Brett erkennt.</div>
                <button onClick={start} className="cw-cam-cta">→ Kamera starten</button>
              </>
            ) : (
              <>
                <span style={{ color: '#c76a5f' }}>{Icon.eye({ size: 30, color: '#c76a5f' })}</span>
                <div style={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase' }}>Erkennung <span style={{ color: '#8e8b5e' }}>aktivieren</span></div>
                <div style={{ fontSize: 13, color: '#9a9388', lineHeight: 1.5, maxWidth: 240 }}>
                  {visionStatus === 'error' ? 'Das Laden ist fehlgeschlagen. Bitte erneut versuchen.' : 'Lade das Brett-Erkennungsmodell (einmalig, ~100 MB), dann kannst du die Kamera starten.'}
                </div>
                <button onClick={() => void loadVisionModel()} className="cw-cam-cta">
                  {visionStatus === 'error' ? '↻ Erneut versuchen' : '↓ Modell laden (~100 MB)'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Status-Zeile unter der Bühne */}
      <div className="cw-cam-status">
        {visionStatus === 'ready'
          ? '● Erkennungsmodell geladen'
          : visionStatus === 'loading'
            ? '◌ Erkennungsmodell lädt …'
            : visionStatus === 'error'
              ? '✕ Modell nicht geladen'
              : '○ Erkennungsmodell noch nicht geladen'}
      </div>

      {/* Steuerung */}
      <div className="cw-cam-controls">
        <button className="cw-round" title="Licht">{Icon.torch({ size: 22 })}</button>
        <motion.button
          className={`cw-recbtn${recording ? ' on' : ''}`}
          whileTap={{ scale: 0.94 }}
          onClick={() => (streaming ? setRecording((r) => !r) : visionReady ? start() : void loadVisionModel())}
          title={streaming ? 'Aufnahme' : visionReady ? 'Kamera starten' : 'Modell laden'}
        >
          <span className="inner" />
        </motion.button>
        <button className="cw-round" onClick={stop} title="Stoppen">{Icon.flip({ size: 22 })}</button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#7d776c', marginTop: 10 }}>
        {streaming
          ? recording ? 'Aufnahme läuft – Züge werden protokolliert' : status
          : visionReady ? 'Tippe zum Starten der Kamera' : 'Modell laden, dann Kamera starten'}
      </div>
    </div>
  )
}
