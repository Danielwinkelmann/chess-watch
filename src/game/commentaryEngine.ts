import { Wllama } from '@wllama/wllama'
import singleThreadWasm from '@wllama/wllama/esm/wasm/wllama.wasm?url'
import { buildCommentaryPrompt, type CommentaryInput } from './commentary'

// Kommentar-Engine (Gemma 3 270M GGUF) im Main-Thread. wllama startet für die
// eigentliche Rechenarbeit intern eigene Worker, daher blockiert das die UI nicht
// nennenswert – und wir vermeiden das „document is not defined"-Problem, das beim
// Verschachteln von wllama in einem Modul-Worker auftritt.
const MODEL_URL = `${import.meta.env.BASE_URL}models/commentary/chess-gemma-q8_0.gguf`

let wllama: Wllama | null = null
let ready = false
let loading: Promise<void> | null = null

export function isCommentaryReady(): boolean {
  return ready
}

export function loadCommentaryModel(
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  if (ready) return Promise.resolve()
  if (loading) return loading
  loading = (async () => {
    wllama = new Wllama({
      default: singleThreadWasm,
      'single-thread/wllama.wasm': singleThreadWasm,
    })
    await wllama.loadModelFromUrl(MODEL_URL, {
      n_ctx: 1024,
      progressCallback: ({ loaded, total }) => onProgress?.(loaded, total),
    })
    ready = true
  })()
  return loading
}

export async function generateComment(input: CommentaryInput): Promise<string> {
  if (!wllama || !ready) throw new Error('Kommentar-Modell nicht geladen')
  const { system, user } = buildCommentaryPrompt(input)
  const res = await wllama.createChatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 160,
  })
  const raw = res.choices?.[0]?.message?.content?.trim() ?? ''
  return cleanCommentary(raw)
}

// Modell liefert „Commentary: … , Predicted ELO: … , Verified Classification: …".
// Für den Feed nur den Prosa-Teil (mit kurzem ELO/Klassifikations-Anhang) zeigen.
function cleanCommentary(raw: string): string {
  if (!raw) return raw
  const commentary =
    /Commentary:\s*(.+?)(?:,?\s*Predicted ELO:|$)/is.exec(raw)?.[1]?.trim() ?? raw
  const elo = /Predicted ELO:\s*([0-9]{3,4})/i.exec(raw)?.[1]
  const klass = /Verified Classification:\s*([A-Za-zÄÖÜäöü]+)/i.exec(raw)?.[1]
  const suffix = [elo && `ELO ${elo}`, klass].filter(Boolean).join(' · ')
  return suffix ? `${commentary} (${suffix})` : commentary
}
