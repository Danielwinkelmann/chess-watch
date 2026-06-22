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
        setEstimate(
          `${(usage / 1e6).toFixed(0)} MB / ${(quota / 1e9).toFixed(1)} GB belegt`,
        )
      }
    })()
  }, [vision.status, commentary.status])

  async function loadVision() {
    setVision({ status: 'loading', progress: 0, detail: 'YOLO-Modell …' })
    try {
      const { backend } = await getVision().load()
      setVision({ status: 'ready', progress: 1, detail: `Backend: ${backend}` })
      onVisionReady()
    } catch (e) {
      setVision({ status: 'error', progress: 0, detail: String(e) })
    }
  }

  async function loadCommentary() {
    setCommentary({ status: 'loading', progress: 0, detail: 'Gemma GGUF …' })
    try {
      await loadCommentaryModel((loaded, total) =>
        setCommentary((s) => ({ ...s, progress: total ? loaded / total : 0 })),
      )
      setCommentary({ status: 'ready', progress: 1 })
      onCommentaryReady()
    } catch (e) {
      setCommentary({ status: 'error', progress: 0, detail: String(e) })
    }
  }

  return (
    <div className="models">
      <h2>Modelle</h2>
      <p className="muted">
        {persisted === null
          ? 'Speicher …'
          : persisted
            ? 'Persistenter Speicher aktiv'
            : 'Speicher nicht persistent (kann geräumt werden)'}
        {estimate ? ` · ${estimate}` : ''}
      </p>

      <ModelRow
        name="Bilderkennung (YOLO)"
        state={vision}
        onLoad={loadVision}
        hint="≈104 MB ONNX, einmalig"
      />
      <ModelRow
        name="Kommentar (Gemma 270M)"
        state={commentary}
        onLoad={loadCommentary}
        hint="≈292 MB GGUF, einmalig"
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
        <span className="badge-ok">geladen</span>
      ) : state.status === 'loading' ? (
        <div className="progress">
          <div className="progress-fill" style={{ width: `${state.progress * 100}%` }} />
        </div>
      ) : (
        <button onClick={onLoad}>
          {state.status === 'error' ? 'Erneut' : 'Laden'}
        </button>
      )}
    </div>
  )
}
