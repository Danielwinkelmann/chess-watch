import { useSyncExternalStore } from 'react'
import { getVision } from '../workers/clients'

// Gemeinsamer Lade-Status des YOLO-Erkennungsmodells (für Intro UND Kamera).
export type VisionStatus = 'idle' | 'loading' | 'ready' | 'error'

let status: VisionStatus = 'idle'
const subs = new Set<() => void>()
function emit() {
  subs.forEach((f) => f())
}

export function getVisionStatus(): VisionStatus {
  return status
}

export async function loadVisionModel(): Promise<void> {
  if (status === 'ready' || status === 'loading') return
  status = 'loading'
  emit()
  try {
    await getVision().load()
    status = 'ready'
  } catch (e) {
    console.error('[Erkennung] Laden fehlgeschlagen:', e)
    status = 'error'
  }
  emit()
}

export function useVisionStatus(): VisionStatus {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    getVisionStatus,
    getVisionStatus,
  )
}
