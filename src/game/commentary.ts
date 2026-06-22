import type { Evaluation, MoveQuality } from '../engine/evaluation'

// Eingabe für das Kommentar-Modell zu genau einem Zug.
export interface CommentaryInput {
  fen: string // Stellung NACH dem Zug
  san: string // gespielter Zug in SAN
  side: 'White' | 'Black' // wer gezogen hat
  cpBefore: number | null // Weiß-Sicht, vor dem Zug
  cpAfter: number | null // Weiß-Sicht, nach dem Zug
  bestAlt?: string // bester Zug laut Engine (UCI) in der Vorher-Stellung
  language?: string // z. B. "German"
  langCode?: string // z. B. "de"
}

// Baut den Prompt im Format der Modellkarte von NAKSTStudio/chess-gemma-commentary.
// Beispiel-Userblock laut Karte:
//   LanguageL: English / LangCode: en / Type: standard / FEN: ... / MoveSAN: Nf6 ...
export function buildCommentaryPrompt(input: CommentaryInput): {
  system: string
  user: string
} {
  const cpB = input.cpBefore ?? 0
  const cpA = input.cpAfter ?? 0
  // CP-Delta aus Sicht des Ziehers.
  const signed = input.side === 'White' ? 1 : -1
  const delta = Math.round((cpA - cpB) * signed)
  const system =
    'Generate professional chess commentary in the specified language. ' +
    'For Type=standard use 30-40 words. ' +
    'Return exactly: Commentary, Predicted ELO, Verified Classification.'
  const user = [
    `LanguageL: ${input.language ?? 'German'}`,
    `LangCode: ${input.langCode ?? 'de'}`,
    'Type: standard',
    `FEN: ${input.fen}`,
    `MoveSAN: ${input.san}`,
    `Side: ${input.side}`,
    'Actor: human',
    input.bestAlt ? `BestAlt: ${input.bestAlt}` : 'BestAlt: -',
    `CP: ${Math.round(cpB)}->${Math.round(cpA)} (Δ=${delta})`,
  ].join('\n')
  return { system, user }
}

// Deterministischer Heuristik-Kommentar (Fallback ohne LLM / während es lädt).
const QUALITY_TEXT_DE: Record<MoveQuality, string> = {
  brilliant: 'Starker Zug – die Stellung kippt deutlich zugunsten des Ziehenden.',
  best: 'Gute Wahl, behält die Initiative.',
  good: 'Solider Zug ohne Bewertungsverlust.',
  inaccuracy: 'Ungenau – es gab präzisere Fortsetzungen.',
  mistake: 'Fehler, der dem Gegner Vorteil verschafft.',
  blunder: 'Grober Patzer – die Bewertung springt stark zum Gegner.',
}

export function heuristicComment(
  quality: MoveQuality,
  san: string,
  ev: Evaluation,
): string {
  const base = QUALITY_TEXT_DE[quality]
  const evalText =
    ev.mate !== null
      ? `Matt in ${Math.abs(ev.mate)} ist in Sicht.`
      : `Bewertung jetzt ${(ev.cp ?? 0) / 100 >= 0 ? '+' : ''}${((ev.cp ?? 0) / 100).toFixed(1)}.`
  return `${san}: ${base} ${evalText}`
}
