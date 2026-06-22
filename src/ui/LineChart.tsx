// Liniendiagramm – portiert aus der Design-Vorlage (lineChart()).
export interface Series {
  data: { x: number; v: number | null }[]
  color: string
  w?: number
  fill?: string
  fillOpacity?: number
}

export interface ChartOpts {
  w?: number
  h?: number
  pad?: { t: number; r: number; b: number; l: number }
  xMax: number
  ymin: number
  ymax: number
  grid?: number[]
  zero?: number
  cursor?: number
  accent?: string
}

export function LineChart({ series, opts }: { series: Series[]; opts: ChartOpts }) {
  const W = opts.w ?? 320
  const H = opts.h ?? 120
  const pad = opts.pad ?? { t: 8, r: 8, b: 8, l: 8 }
  const xs = opts.xMax || 1
  const px = (i: number) => pad.l + (i / xs) * (W - pad.l - pad.r)
  const py = (v: number) => pad.t + (1 - (v - opts.ymin) / (opts.ymax - opts.ymin || 1)) * (H - pad.t - pad.b)
  const els: React.ReactNode[] = []

  ;(opts.grid ?? []).forEach((gv, k) =>
    els.push(<line key={`g${k}`} x1={pad.l} x2={W - pad.r} y1={py(gv)} y2={py(gv)} stroke="#34302c" strokeWidth={1} />),
  )
  if (opts.zero !== undefined)
    els.push(<line key="z" x1={pad.l} x2={W - pad.r} y1={py(opts.zero)} y2={py(opts.zero)} stroke="#4a443f" strokeWidth={1} strokeDasharray="3 3" />)

  series.forEach((s, si) => {
    const valid = s.data.filter((d) => d.v !== null) as { x: number; v: number }[]
    if (!valid.length) return
    const pts = valid.map((d) => `${px(d.x)},${py(d.v)}`).join(' ')
    if (s.fill) {
      const z = opts.zero !== undefined ? opts.zero : opts.ymin
      const fpts = `${pts} ${px(valid[valid.length - 1].x)},${py(z)} ${px(valid[0].x)},${py(z)}`
      els.push(<polygon key={`f${si}`} points={fpts} fill={s.fill} opacity={s.fillOpacity ?? 0.16} />)
    }
    els.push(<polyline key={`l${si}`} points={pts} fill="none" stroke={s.color} strokeWidth={s.w ?? 2} strokeLinejoin="round" strokeLinecap="round" />)
  })

  if (opts.cursor !== undefined && opts.cursor >= 0)
    els.push(<line key="cur" x1={px(opts.cursor)} x2={px(opts.cursor)} y1={pad.t} y2={H - pad.b} stroke={opts.accent ?? '#8e8b5e'} strokeWidth={1} opacity={0.5} />)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="xMidYMid meet" className="cw-chart">
      {els}
    </svg>
  )
}
