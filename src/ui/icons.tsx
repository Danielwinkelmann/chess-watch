// SVG-Icons aus der Design-Vorlage (Chess Watch.dc.html, icons()).
import { createElement } from 'react'

type P = (string | { t: 'circle' | 'rect' | 'line'; a: Record<string, number> })[]

function Svg({
  paths,
  size = 22,
  sw = 1.9,
  fill = 'none',
  color = 'currentColor',
}: {
  paths: P
  size?: number
  sw?: number
  fill?: string
  color?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((p, i) =>
        typeof p === 'string'
          ? createElement('path', { key: i, d: p })
          : createElement(p.t, { key: i, ...p.a }),
      )}
    </svg>
  )
}

export const Icon = {
  camera: (p?: { size?: number }) => (
    <Svg size={p?.size} paths={['M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z', { t: 'circle', a: { cx: 12, cy: 13, r: 3.4 } }]} />
  ),
  board: (p?: { size?: number }) => (
    <Svg size={p?.size} paths={[{ t: 'rect', a: { x: 3, y: 3, width: 18, height: 18, rx: 2 } }, 'M3 9h18M3 15h18M9 3v18M15 3v18']} />
  ),
  feed: (p?: { size?: number }) => <Svg size={p?.size} paths={['M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z']} />,
  archive: (p?: { size?: number }) => (
    <Svg size={p?.size} paths={[{ t: 'rect', a: { x: 3, y: 4, width: 18, height: 4, rx: 1 } }, 'M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8', 'M10 12h4']} />
  ),
  chart: (p?: { size?: number }) => <Svg size={p?.size} paths={['M3 3v18h18', 'M7 14l3-4 3 2.5L21 7']} />,
  first: (p?: { size?: number }) => <Svg size={p?.size} fill="currentColor" sw={2} paths={['M19 5v14l-9-7z', { t: 'line', a: { x1: 6, y1: 5, x2: 6, y2: 19 } }]} />,
  last: (p?: { size?: number }) => <Svg size={p?.size} fill="currentColor" sw={2} paths={['M5 5v14l9-7z', { t: 'line', a: { x1: 18, y1: 5, x2: 18, y2: 19 } }]} />,
  prev: (p?: { size?: number }) => <Svg size={p?.size} sw={2.1} paths={['M15 5l-7 7 7 7']} />,
  next: (p?: { size?: number }) => <Svg size={p?.size} sw={2.1} paths={['M9 5l7 7-7 7']} />,
  play: (p?: { size?: number }) => <Svg size={p?.size ?? 20} sw={0} fill="currentColor" paths={['M7 4l13 8-13 8z']} />,
  pause: (p?: { size?: number }) => <Svg size={p?.size ?? 20} sw={0} fill="currentColor" paths={[{ t: 'rect', a: { x: 6, y: 5, width: 4, height: 14, rx: 1 } }, { t: 'rect', a: { x: 14, y: 5, width: 4, height: 14, rx: 1 } }]} />,
  torch: (p?: { size?: number }) => <Svg size={p?.size} paths={['M9 2h6l-1 7h3l-8 13 2-9H8z']} />,
  flip: (p?: { size?: number }) => <Svg size={p?.size} paths={['M21 8a9 9 0 0 0-15-3L3 8', 'M3 16a9 9 0 0 0 15 3l3-3', 'M3 4v4h4', 'M21 20v-4h-4']} />,
  back: (p?: { size?: number }) => <Svg size={p?.size} sw={2.1} paths={['M15 5l-7 7 7 7']} />,
  chevron: (p?: { size?: number }) => <Svg size={p?.size} sw={2} paths={['M9 5l7 7-7 7']} />,
  eye: (p?: { size?: number; color?: string }) => <Svg size={p?.size ?? 16} color={p?.color} paths={['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', { t: 'circle', a: { cx: 12, cy: 12, r: 3 } }]} />,
  cpu: (p?: { size?: number; color?: string }) => <Svg size={p?.size ?? 16} color={p?.color} paths={[{ t: 'rect', a: { x: 6, y: 6, width: 12, height: 12, rx: 2 } }, { t: 'rect', a: { x: 9, y: 9, width: 6, height: 6, rx: 1 } }, 'M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3']} />,
  brain: (p?: { size?: number; color?: string }) => <Svg size={p?.size ?? 16} color={p?.color} paths={['M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 6 1V4a3 3 0 0 0-2-1z', 'M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-6 1']} />,
  search: (p?: { size?: number }) => <Svg size={p?.size ?? 16} paths={[{ t: 'circle', a: { cx: 11, cy: 11, r: 7 } }, 'M21 21l-4-4']} />,
  hand: (p?: { size?: number; color?: string }) => <Svg size={p?.size ?? 16} color={p?.color} paths={['M18 11V6a1.5 1.5 0 0 0-3 0', 'M15 11V4.5a1.5 1.5 0 0 0-3 0V11', 'M12 11V5.5a1.5 1.5 0 0 0-3 0V12', 'M9 12V8a1.5 1.5 0 0 0-3 0v6a7 7 0 0 0 7 7h1a6 6 0 0 0 6-6v-1']} />,
  detect: (p?: { size?: number; color?: string }) => <Svg size={p?.size ?? 16} color={p?.color} paths={['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', { t: 'circle', a: { cx: 12, cy: 12, r: 3 } }]} />,
  camOff: (p?: { size?: number; color?: string }) => <Svg size={p?.size ?? 16} color={p?.color} paths={['M2 2l20 20', 'M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h13', 'M17 7h3a2 2 0 0 1 2 2v7', 'M14.5 4h-5']} />,
  lock: (p?: { size?: number; color?: string }) => <Svg size={p?.size ?? 30} color={p?.color ?? '#c76a5f'} paths={[{ t: 'rect', a: { x: 4, y: 11, width: 16, height: 10, rx: 2 } }, 'M8 11V8a4 4 0 0 1 8 0v3']} />,
  pawn: (p?: { size?: number; color?: string }) => <Svg size={p?.size ?? 20} color={p?.color} sw={1.8} paths={['M12 3a3 3 0 0 0-1.6 5.5C9 9.4 8.4 10.7 9 12h6c.6-1.3 0-2.6-1.4-3.5A3 3 0 0 0 12 3z', 'M8 12h8l1 4H7z', 'M6 16h12l1 4H5z']} />,
  tools: (p?: { size?: number }) => <Svg size={p?.size} paths={['M14.7 6.3a4 4 0 0 0-5.4 5.3L3 18v3h3l6.4-6.3a4 4 0 0 0 5.3-5.4l-2.6 2.6-2-2 2.6-2.6z']} />,
  copy: (p?: { size?: number }) => <Svg size={p?.size ?? 18} paths={[{ t: 'rect', a: { x: 9, y: 9, width: 11, height: 11, rx: 2 } }, 'M5 15V5a2 2 0 0 1 2-2h8']} />,
  paste: (p?: { size?: number }) => <Svg size={p?.size ?? 18} paths={[{ t: 'rect', a: { x: 6, y: 4, width: 12, height: 16, rx: 2 } }, { t: 'rect', a: { x: 9, y: 2, width: 6, height: 4, rx: 1 } }, 'M9 12h6M9 16h4']} />,
  image: (p?: { size?: number }) => <Svg size={p?.size ?? 18} paths={[{ t: 'rect', a: { x: 3, y: 3, width: 18, height: 18, rx: 2 } }, { t: 'circle', a: { cx: 8.5, cy: 8.5, r: 1.5 } }, 'M21 15l-5-5L5 21']} />,
  download: (p?: { size?: number }) => <Svg size={p?.size ?? 18} paths={['M12 3v12', 'M7 11l5 5 5-5', 'M5 21h14']} />,
  video: (p?: { size?: number }) => <Svg size={p?.size ?? 18} paths={[{ t: 'rect', a: { x: 3, y: 6, width: 13, height: 12, rx: 2 } }, 'M16 10l5-3v10l-5-3z']} />,
  edit: (p?: { size?: number }) => <Svg size={p?.size ?? 18} paths={['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z']} />,
}
