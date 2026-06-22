import { useEffect, useRef, useState } from 'react'
import type { Chess } from 'chess.js'
import { getVision } from '../workers/clients'
import { mapDetectionsToBoard } from '../vision/board'
import { placementToFenField } from '../vision/toFen'
import { detectMove, StabilityTracker } from '../game/moveDetection'
import { HandGate } from '../vision/handGate'
import type { Detection } from '../vision/detect'

interface CameraViewProps {
  chess: Chess
  visionReady: boolean
  orientation: 'white' | 'black'
  onMove: (move: { from: string; to: string; promotion?: string }) => Promise<boolean>
}

const DETECT_INTERVAL_MS = 300 // ~3 fps

export function CameraView({ chess, visionReady, orientation, onMove }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const grabRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const handGateRef = useRef<HandGate | null>(null)
  const stabilityRef = useRef(new StabilityTracker(4))
  const runningRef = useRef(false)
  const lastRunRef = useRef(0)

  const [status, setStatus] = useState('Kamera aus')
  const [handBlocked, setHandBlocked] = useState(false)
  const [streaming, setStreaming] = useState(false)

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
      setStatus(`Kamera-Fehler: ${e}`)
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
  }

  function drawOverlay(dets: Detection[], vw: number, vh: number) {
    const canvas = overlayRef.current
    if (!canvas) return
    canvas.width = vw
    canvas.height = vh
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, vw, vh)
    for (const d of dets) {
      const isBoard = d.className === 'board'
      ctx.strokeStyle = isBoard ? '#1abc9c' : '#f1c40f'
      ctx.lineWidth = isBoard ? 3 : 2
      ctx.strokeRect(d.x, d.y, d.w, d.h)
    }
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
          const dets = await getVision().detect({
            data: imageData.data,
            width: vw,
            height: vh,
          })
          drawOverlay(dets, vw, vh)

          const mapping = mapDetectionsToBoard(dets, orientation)
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
          setStatus(`Erkennung: ${e}`)
        }
      }
    }
    requestAnimationFrame(loop)
  }

  useEffect(() => () => stop(), [])

  return (
    <div className="camera">
      <div className="camera-stage">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={overlayRef} className="camera-overlay" />
        {handBlocked && <div className="camera-hand">✋ Hand erkannt – warte …</div>}
      </div>
      <div className="camera-controls">
        <span className="muted">{status}</span>
        {!streaming ? (
          <button onClick={start} disabled={!visionReady}>
            {visionReady ? 'Kamera starten' : 'Erst YOLO-Modell laden'}
          </button>
        ) : (
          <button onClick={stop}>Stoppen</button>
        )}
      </div>
    </div>
  )
}
