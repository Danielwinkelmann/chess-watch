import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

// Erkennt, ob eine Hand über dem Brett ist. Solange ja → Erkennung pausieren;
// erst wenn die Hand für N Frames weg ist, gilt die Stellung als „abgesetzt".
// Läuft leichtgewichtig im Main-Thread auf dem <video>-Element.
const WASM_PATH = `${import.meta.env.BASE_URL}models/mediapipe/wasm`
const MODEL_PATH = `${import.meta.env.BASE_URL}models/mediapipe/hand_landmarker.task`

export class HandGate {
  private landmarker: HandLandmarker | null = null
  private available = false
  private absentFrames = 0
  constructor(private readonly clearAfter = 6) {}

  async init(): Promise<boolean> {
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: 'VIDEO',
        numHands: 1,
      })
      this.available = true
    } catch (err) {
      // Modell fehlt/Fehler → Gate deaktivieren (Pipeline läuft ohne Gate weiter).
      console.warn('HandGate nicht verfügbar:', err)
      this.available = false
    }
    return this.available
  }

  isAvailable() {
    return this.available
  }

  // true = Brett ist frei (Stellung darf gelesen werden).
  // false = Hand erkannt → Erkennung pausieren.
  update(video: HTMLVideoElement, timestampMs: number): boolean {
    if (!this.available || !this.landmarker) return true
    const res = this.landmarker.detectForVideo(video, timestampMs)
    const handPresent = (res.landmarks?.length ?? 0) > 0
    if (handPresent) {
      this.absentFrames = 0
      return false
    }
    this.absentFrames++
    return this.absentFrames >= this.clearAfter
  }

  dispose() {
    this.landmarker?.close()
    this.landmarker = null
  }
}
