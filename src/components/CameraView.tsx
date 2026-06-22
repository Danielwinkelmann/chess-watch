import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Chess } from 'chess.js'
import { getVision } from '../workers/clients'
import { mapDetectionsToBoard } from '../vision/board'
import { placementToFenField } from '../vision/toFen'
import { detectMove, StabilityTracker } from '../game/moveDetection'
import { HandGate } from '../vision/handGate'
import { CLASS_TO_FEN, type Detection } from '../vision/detect'

interface CameraViewProps {
  chess: Chess
  visionReady: boolean
  orientation: 'white' | 'black'
  onMove: (move: { from: string; to: string; promotion?: string }) => Promise<boolean>
}

const DETECT_INTERVAL_MS = 300 // ~3 fps

// FEN-Zeichen → Unicode-Schachsymbol (für die Box-Beschriftung).
const FEN_GLYPH: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}

// Stabiler Schlüssel je Box (Klasse + grob gerasterter Auflagepunkt), damit
// Framer Motion ruhende Figuren wiedererkennt und Positionen weich animiert.
function boxKey(d: Detection, vw: number): string {
  const cell = vw / 12
  const cx = Math.round((d.x + d.w / 2) / cell)
  const cy = Math.round((d.y + d.h) / cell)
  return `${d.className}@${cx},${cy}`
}

export function CameraView({ chess, visionReady, orientation, onMove }: CameraViewProps) {
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

  return (
    <div className="camera">
      <div className="camera-stage">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <svg
          className="camera-overlay"
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <AnimatePresence>
            {[...boxes.entries()].map(([key, d]) => {
              const isBoard = d.className === 'board'
              const color = isBoard ? '#8e8b5e' : '#dfb62a'
              const glyph = FEN_GLYPH[CLASS_TO_FEN[d.className] ?? '']
              const labelSize = Math.max(18, d.w * 0.42)
              return (
                <motion.g
                  key={key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <motion.rect
                    initial={{ x: d.x, y: d.y, width: d.w, height: d.h }}
                    animate={{ x: d.x, y: d.y, width: d.w, height: d.h }}
                    transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                    rx={4}
                    fill="none"
                    stroke={color}
                    strokeWidth={isBoard ? 4 : 3}
                  />
                  {!isBoard && glyph && (
                    <motion.text
                      initial={{ x: d.x + 4, y: d.y + labelSize }}
                      animate={{ x: d.x + 4, y: d.y + labelSize }}
                      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                      fontSize={labelSize}
                      fill={color}
                      style={{ pointerEvents: 'none', fontWeight: 700 }}
                    >
                      {glyph}
                    </motion.text>
                  )}
                </motion.g>
              )
            })}
          </AnimatePresence>
        </svg>
        <AnimatePresence>
          {handBlocked && (
            <motion.div
              className="camera-hand"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              ✋ Hand erkannt – warte …
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="camera-controls">
        <span className="muted">{status}</span>
        {!streaming ? (
          <motion.button whileTap={{ scale: 0.96 }} onClick={start} disabled={!visionReady}>
            {visionReady ? 'Kamera starten' : 'Erst Erkennung aktivieren'}
          </motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.96 }} onClick={stop}>
            Stoppen
          </motion.button>
        )}
      </div>
    </div>
  )
}
