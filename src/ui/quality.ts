import type { MoveQuality } from '../engine/evaluation'

// Zug-Qualitäts-Badges exakt nach Design-Vorlage (Chess Watch.dc.html, CLS()).
export interface QualityStyle {
  label: string
  sym: string
  bg: string
  fg: string
}

export const ACCENT = '#8e8b5e'

export const QUALITY: Record<MoveQuality, QualityStyle> = {
  brilliant: { label: 'Glanzzug', sym: '!!', bg: ACCENT, fg: '#211c1b' },
  good: { label: 'Gut', sym: '!', bg: '#7E9A75', fg: '#211c1b' },
  best: { label: 'Bester Zug', sym: '✓', bg: '#4a4636', fg: '#d4cfc3' },
  inaccuracy: { label: 'Ungenau', sym: '?!', bg: '#dfb62a', fg: '#2a2008' },
  mistake: { label: 'Fehler', sym: '?', bg: '#c70a33', fg: '#1a0a0c' },
  blunder: { label: 'Patzer', sym: '??', bg: '#B4352E', fg: '#fff' },
}

// Farbe für Eval-Label (Wert in Bauern, Weiß-Sicht).
export function evalColor(pawns: number): string {
  if (pawns >= 4) return ACCENT
  if (pawns >= 1) return '#d4cfc3'
  if (pawns >= -0.5) return '#9a9388'
  return '#c76a5f'
}

// Marker-Farbe für die Zeitleiste (nur auffällige Züge).
export const MARKER_COLOR: Partial<Record<MoveQuality, string>> = {
  brilliant: ACCENT,
  inaccuracy: '#dfb62a',
  mistake: '#c70a33',
  blunder: '#8f0a26',
}
