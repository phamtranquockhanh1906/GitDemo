'use client'

import { useEffect, useId, useRef, useState } from 'react'

export function Sparkline({ data, color, width = 84, height = 30 }: { data: number[]; color: string; width?: number; height?: number }) {
  const gid = useId()
  const min = Math.min(...data)
  const max = Math.max(...data)
  const r = max - min || 1
  const pts = data.map((v, i) => [i * (width / (data.length - 1)), height - 3 - ((v - min) / r) * (height - 6)])
  const line = pts.map((p) => p.join(',')).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0] - 1} cy={last[1]} r="2.5" fill={color} />
    </svg>
  )
}

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, ...size }
}

export type Series = { data: number[]; color: string; fill?: boolean; axis?: 1 | 2 }

type LineChartProps = {
  series: Series[]
  labels: string[]
  yMin: number
  yMax: number
  y2?: { min: number; max: number }
  baseline?: number
  baselineLabel?: string
  ariaLabel: string
  className?: string
}

export function LineChart({ series, labels, yMin, yMax, y2, baseline, baselineLabel = 'Personal Baseline', ariaLabel, className = 'chart' }: LineChartProps) {
  const { ref, w, h } = useElementSize<HTMLDivElement>()
  const W = w || 600
  const H = h || 200
  const pl = 36
  const pr = y2 ? 36 : 12
  const pt = 12
  const pb = 22
  const iw = W - pl - pr
  const ih = H - pt - pb
  const x = (i: number) => pl + i * (iw / (labels.length - 1))
  const y = (v: number, mn: number, mx: number) => pt + ih - ((v - mn) / (mx - mn)) * ih

  return (
    <div ref={ref} className={className}>
      {w > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
          {[0, 1, 2, 3, 4].map((k) => {
            const yy = pt + (k * ih) / 4
            const v = +(yMax - (k * (yMax - yMin)) / 4).toFixed(1)
            return (
              <g key={k}>
                <line x1={pl} x2={W - pr} y1={yy} y2={yy} stroke="#1E293B" />
                <text x={pl - 8} y={yy + 4} fill="#94A3B8" fontSize="10" textAnchor="end" fontFamily="var(--mono)">
                  {Number.isInteger(v) ? v : v.toFixed(1)}
                </text>
                {y2 && (
                  <text x={W - pr + 8} y={yy + 4} fill="#94A3B8" fontSize="10" fontFamily="var(--mono)">
                    {Math.round(y2.max - (k * (y2.max - y2.min)) / 4)}
                  </text>
                )}
              </g>
            )
          })}
          {labels.map((l, i) => (
            <text key={i} x={x(i)} y={H - 6} fill="#94A3B8" fontSize="10" textAnchor="middle" fontFamily="var(--mono)">
              {l}
            </text>
          ))}
          {baseline !== undefined && (
            <g>
              <line x1={pl} x2={W - pr} y1={y(baseline, yMin, yMax)} y2={y(baseline, yMin, yMax)} stroke="#94A3B8" strokeDasharray="4 4" />
              <text x={pl + 6} y={y(baseline, yMin, yMax) - 6} fill="#CBD5E1" fontSize="10" fontFamily="var(--sans)">
                {`${baselineLabel} · ${baseline}`}
              </text>
            </g>
          )}
          {series.map((s, si) => {
            const mn = s.axis === 2 && y2 ? y2.min : yMin
            const mx = s.axis === 2 && y2 ? y2.max : yMax
            const pts = s.data.map((v, i) => `${x(i)},${y(v, mn, mx)}`).join(' ')
            const last = s.data[s.data.length - 1]
            return (
              <g key={si}>
                {s.fill && <polygon points={`${pl},${pt + ih} ${pts} ${x(s.data.length - 1)},${pt + ih}`} fill={s.color} opacity=".08" />}
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinejoin="round" />
                {s.data.map((v, i) => {
                  const isLast = i === s.data.length - 1
                  return <circle key={i} cx={x(i)} cy={y(v, mn, mx)} r={isLast ? 4 : 2.5} fill={isLast ? s.color : '#131C2E'} stroke={s.color} strokeWidth="1.5" />
                })}
                <text x={x(s.data.length - 1) - 8} y={y(last, mn, mx) - 9} fill={s.color} fontSize="11" fontWeight="600" textAnchor="end" fontFamily="var(--mono)">
                  {last}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export function BarChart({ data, labels, target, max, ariaLabel }: { data: number[]; labels: string[]; target: number; max: number; ariaLabel: string }) {
  const { ref, w, h } = useElementSize<HTMLDivElement>()
  const W = w || 400
  const H = h || 200
  const pl = 30
  const pr = 10
  const pt = 12
  const pb = 22
  const iw = W - pl - pr
  const ih = H - pt - pb
  const slot = iw / data.length
  const bw = Math.min(36, slot * 0.55)
  const y = (v: number) => pt + ih - (v / max) * ih

  return (
    <div ref={ref} className="chart">
      {w > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
          {[0, 1, 2, 3, 4].map((k) => {
            const yy = pt + (k * ih) / 4
            return (
              <g key={k}>
                <line x1={pl} x2={W - pr} y1={yy} y2={yy} stroke="#1E293B" />
                <text x={pl - 6} y={yy + 4} fill="#94A3B8" fontSize="10" textAnchor="end" fontFamily="var(--mono)">
                  {Math.round(max - (k * max) / 4)}
                </text>
              </g>
            )
          })}
          {data.map((v, i) => {
            const below = v < target
            const cx = pl + slot * i + slot / 2
            return (
              <g key={i}>
                <rect x={cx - bw / 2} y={y(v)} width={bw} height={pt + ih - y(v)} rx="4" fill={below ? '#F59E0B' : '#0EA5E9'} opacity={below ? 0.85 : 0.75} />
                <text x={cx} y={y(v) - 6} fill={below ? '#FCD34D' : '#7DD3FC'} fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="var(--mono)">
                  {v.toFixed(1)}
                </text>
                <text x={cx} y={H - 6} fill="#94A3B8" fontSize="10" textAnchor="middle" fontFamily="var(--mono)">
                  {labels[i]}
                </text>
              </g>
            )
          })}
          <line x1={pl} x2={W - pr} y1={y(target)} y2={y(target)} stroke="#94A3B8" strokeDasharray="4 4" />
          <text x={W - pr - 4} y={y(target) - 6} fill="#CBD5E1" fontSize="10" textAnchor="end" fontFamily="var(--sans)">
            {`Target · ${target} h`}
          </text>
        </svg>
      )}
    </div>
  )
}

export function RingGauge({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 64
  const c = 2 * Math.PI * r
  const arc = c * 0.75
  const filled = arc * (value / 100)
  return (
    <svg viewBox="0 0 160 160" width="168" height="168" role="img" aria-label={`${label}: ${value} out of 100`}>
      <g transform="rotate(135 80 80)">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#1E293B" strokeWidth="12" strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="12" strokeDasharray={`${filled} ${c}`} strokeLinecap="round" />
      </g>
      <text x="80" y="82" textAnchor="middle" fill="#F1F5F9" fontSize="38" fontWeight="600" fontFamily="var(--mono)">
        {value}
      </text>
      <text x="80" y="104" textAnchor="middle" fill="#94A3B8" fontSize="11" letterSpacing="2" fontFamily="var(--sans)">
        / 100 RISK
      </text>
    </svg>
  )
}
