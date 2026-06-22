import { useEffect, useState } from 'react'
import { getVision } from '../workers/clients'
import { loadCommentaryModel } from '../game/commentaryEngine'

interface LoadState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number // 0..1
  detail?: string
}

const initial: LoadState = { status: 'idle', progress: 0 }

export function ModelLoader({
  onCommentaryReady,
  onVisionReady,
}: {
  onCommentaryReady: () => void
  onVisionReady: () => void
}) {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [estimate, setEstimate] = useState('')
  const [vision, setVision] = useState<LoadState>(initial)
  const [commentary, setCommentary] = useState<LoadState>(initial)

  useEffect(() => {
    void (async () => {
      if (navigator.storage?.persist) {
        const already = await navigator.storage.persisted()
        setPersisted(already || (await navigator.storage.persist()))
      }
      if (navigator.storage?.estimate) {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate()
        void quota
        setEstimate(`${(usage / 1e6).toFixed(0)} MB genutzt`)
      }
    })()
  }, [vision.status, commentary.status])

  async function loadVision() {
    setVision({ status: 'loading', progress: 0, detail: 'Wird vorbereitet …' })
    try {
      await getVision().load()
      setVision({ status: 'ready', progress: 1, detail: 'Bereit' })
      onVisionReady()
    } catch {
      setVision({ status: 'error', progress: 0, detail: 'Start fehlgeschlagen – bitte erneut versuchen' })
    }
  }

  async function loadCommentary() {
    setCommentary({ status: 'loading', progress: 0, detail: 'Wird vorbereitet …' })
    try {
      await loadCommentaryModel((loaded, total) =>
        setCommentary((s) => ({ ...s, progress: total ? loaded / total : 0 })),
      )
      setCommentary({ status: 'ready', progress: 1, detail: 'Bereit' })
      onCommentaryReady()
    } catch {
      setCommentary({ status: 'error', progress: 0, detail: 'Start fehlgeschlagen – bitte erneut versuchen' })
    }
  }

  return (
    <div className="models">
      <h2>Funktionen</h2>
      <p className="muted">
        {persisted === null
          ? 'Wird auf diesem Gerät gespeichert …'
          : persisted
            ? 'Wird dauerhaft auf diesem Gerät gespeichert'
            : 'Wird auf diesem Gerät gespeichert'}
        {estimate ? ` · ${estimate}` : ''}
      </p>

      <ModelRow
        name="Erkennung per Kamera"
        state={vision}
        onLoad={loadVision}
        hint="Einmalig aktivieren · ca. 100 MB"
      />
      <ModelRow
        name="Zug-Erklärungen"
        state={commentary}
        onLoad={loadCommentary}
        hint="Einmalig aktivieren · ca. 290 MB"
      />
    </div>
  )
}

function ModelRow({
  name,
  state,
  onLoad,
  hint,
}: {
  name: string
  state: LoadState
  onLoad: () => void
  hint: string
}) {
  return (
    <div className="model-row">
      <div className="model-info">
        <strong>{name}</strong>
        <small className="muted">{state.detail ?? hint}</small>
      </div>
      {state.status === 'ready' ? (
        <span className="badge-ok">Aktiv</span>
      ) : state.status === 'loading' ? (
        <div className="progress">
          <div className="progress-fill" style={{ width: `${state.progress * 100}%` }} />
        </div>
      ) : (
        <button onClick={onLoad}>
          {state.status === 'error' ? 'Erneut' : 'Aktivieren'}
        </button>
      )}
    </div>
  )
}
