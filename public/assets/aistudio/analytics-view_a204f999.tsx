'use client'

import { ArrowRight, Download, TrendingDown, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useElementSize } from '../charts'
import type { ModuleId } from '../sidebar'
import { PageHeader, Panel, RangeTabs } from '../ui'

type MetricKey = 'hrv' | 'hr' | 'bp' | 'spo2' | 'sleep'
type Range = 'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days'

type Point = { label: string; date: string; value: number; source: string }

type MetricCfg = {
  label: string
  name: string
  unit: string
  baseline: number
  lowerIsWorse: boolean
  min: number
  max: number
  series: Record<Range, number[]>
}

const DAYS_7 = ['Oct 31', 'Nov 01', 'Nov 02', 'Nov 03', 'Nov 04', 'Nov 05', 'Nov 06']
const HOURS_24 = ['08:00', '12:00', '16:00', '20:00', '00:00', '04:00', '08:00']
const DAYS_30 = Array.from({ length: 10 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 9 + i * 3))
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })
})

const METRICS: Record<MetricKey, MetricCfg> = {
  hrv: {
    label: 'HRV Trend',
    name: 'HRV',
    unit: 'ms',
    baseline: 56,
    lowerIsWorse: true,
    min: 30,
    max: 70,
    series: {
      'Last 24 Hours': [45, 43, 41, 44, 46, 43, 42],
      'Last 7 Days': [57, 58, 54, 51, 47, 44, 42],
      'Last 30 Days': [55, 57, 56, 58, 55, 57, 54, 50, 46, 42],
    },
  },
  hr: {
    label: 'Heart Rate',
    name: 'Resting HR',
    unit: 'BPM',
    baseline: 68,
    lowerIsWorse: false,
    min: 55,
    max: 85,
    series: {
      'Last 24 Hours': [74, 77, 79, 76, 70, 72, 75],
      'Last 7 Days': [68, 67, 70, 71, 73, 74, 75],
      'Last 30 Days': [67, 68, 69, 67, 68, 69, 70, 72, 74, 75],
    },
  },
  bp: {
    label: 'Blood Pressure',
    name: 'Systolic BP',
    unit: 'mmHg',
    baseline: 118,
    lowerIsWorse: false,
    min: 100,
    max: 140,
    series: {
      'Last 24 Hours': [122, 125, 127, 123, 118, 121, 124],
      'Last 7 Days': [117, 119, 118, 121, 122, 123, 124],
      'Last 30 Days': [118, 117, 119, 118, 120, 119, 121, 122, 123, 124],
    },
  },
  spo2: {
    label: 'SpO₂',
    name: 'SpO₂',
    unit: '%',
    baseline: 98.5,
    lowerIsWorse: true,
    min: 94,
    max: 100,
    series: {
      'Last 24 Hours': [98, 98, 97, 98, 97, 98, 97],
      'Last 7 Days': [99, 98, 98, 98, 97, 98, 97],
      'Last 30 Days': [99, 98, 99, 98, 98, 99, 98, 98, 97, 97],
    },
  },
  sleep: {
    label: 'Sleep Quality',
    name: 'Sleep Duration',
    unit: 'h',
    baseline: 7.5,
    lowerIsWorse: true,
    min: 4,
    max: 9,
    series: {
      'Last 24 Hours': [5.7, 5.7, 5.7, 5.7, 5.7, 5.7, 5.7],
      'Last 7 Days': [7.4, 7.2, 6.4, 6.1, 5.9, 5.8, 5.7],
      'Last 30 Days': [7.6, 7.4, 7.5, 7.3, 7.6, 7.2, 6.8, 6.3, 5.9, 5.7],
    },
  },
}

const COMPARISON = [
  { metric: 'Heart Rate Variability', unit: 'ms', current: '42', mission: '51', base: '56', status: 'warn' as const },
  { metric: 'Resting Heart Rate', unit: 'BPM', current: '75', mission: '70', base: '68', status: 'warn' as const },
  { metric: 'Blood Pressure', unit: 'mmHg', current: '124/80', mission: '120/78', base: '118/76', status: 'ok' as const },
  { metric: 'SpO₂', unit: '%', current: '97.6', mission: '98.1', base: '98–99', status: 'ok' as const },
  { metric: 'Sleep Duration', unit: 'h/night', current: '5.7', mission: '6.6', base: '7.5', status: 'warn' as const },
]

const RANGES: Range[] = ['Last 24 Hours', 'Last 7 Days', 'Last 30 Days']

function labelsFor(range: Range) {
  return range === 'Last 24 Hours' ? HOURS_24 : range === 'Last 7 Days' ? DAYS_7 : DAYS_30
}

function findDecline(values: number[], lowerIsWorse: boolean) {
  let end = values.length - 1
  let start = end
  while (start > 0 && (lowerIsWorse ? values[start - 1] > values[start] : values[start - 1] < values[start])) start--
  return end - start >= 3 ? { start, end } : null
}

function TrendChart({ points, cfg, band }: { points: Point[]; cfg: MetricCfg; band: { start: number; end: number } | null }) {
  const { ref, w, h } = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number>(points.length - 1)
  const W = w || 700
  const H = h || 280
  const pl = 44
  const pr = 16
  const pt = 18
  const pb = 28
  const iw = W - pl - pr
  const ih = H - pt - pb
  const x = (i: number) => pl + i * (iw / (points.length - 1))
  const y = (v: number) => pt + ih - ((v - cfg.min) / (cfg.max - cfg.min)) * ih

  const path = points
    .map((p, i) => {
      if (i === 0) return `M${x(0)},${y(p.value)}`
      const px = x(i - 1)
      const py = y(points[i - 1].value)
      const cx = (px + x(i)) / 2
      return `C${cx},${py} ${cx},${y(p.value)} ${x(i)},${y(p.value)}`
    })
    .join(' ')

  const hp = points[Math.min(hover, points.length - 1)]
  const hx = x(Math.min(hover, points.length - 1))
  const below = cfg.lowerIsWorse ? hp.value < cfg.baseline : hp.value > cfg.baseline
  const tipW = 196
  const tipX = Math.min(Math.max(hx - tipW / 2, pl), W - pr - tipW)

  return (
    <div ref={ref} className="chart relative" style={{ minHeight: 280 }}>
      {w > 0 && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${cfg.name} trend with personal baseline ${cfg.baseline} ${cfg.unit}`}>
            {band && (
              <g>
                <rect x={x(band.start) - 10} y={pt} width={x(band.end) - x(band.start) + 20} height={ih} fill="rgba(245,158,11,0.09)" stroke="rgba(245,158,11,0.35)" strokeDasharray="3 3" rx="6" />
                <text x={x(band.start) - 2} y={pt + 14} fill="#FCD34D" fontSize="11" fontWeight="600" fontFamily="var(--sans)">
                  {`Detected Downward Trend (${band.end - band.start + 1} Consecutive)`}
                </text>
              </g>
            )}
            {[0, 1, 2, 3, 4].map((k) => {
              const yy = pt + (k * ih) / 4
              const v = cfg.max - (k * (cfg.max - cfg.min)) / 4
              return (
                <g key={k}>
                  <line x1={pl} x2={W - pr} y1={yy} y2={yy} stroke="#1E293B" />
                  <text x={pl - 8} y={yy + 4} fill="#94A3B8" fontSize="11" textAnchor="end" fontFamily="var(--mono)">
                    {Number.isInteger(v) ? v : v.toFixed(1)}
                  </text>
                </g>
              )
            })}
            {points.map((p, i) => (
              <text key={i} x={x(i)} y={H - 8} fill={i === hover ? '#E0F2FE' : '#94A3B8'} fontSize="11" textAnchor="middle" fontFamily="var(--mono)">
                {p.label}
              </text>
            ))}
            <line x1={pl} x2={W - pr} y1={y(cfg.baseline)} y2={y(cfg.baseline)} stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="6 5" />
            <text x={W - pr - 4} y={y(cfg.baseline) - 7} fill="#FCD34D" fontSize="11" textAnchor="end" fontFamily="var(--sans)" fontWeight="600">
              {`Astronaut Personal Baseline (${cfg.baseline} ${cfg.unit})`}
            </text>
            <path d={`${path} L${x(points.length - 1)},${pt + ih} L${pl},${pt + ih} Z`} fill="rgba(14,165,233,0.08)" />
            <path d={path} fill="none" stroke="#0EA5E9" strokeWidth="2.75" strokeLinecap="round" />
            <line x1={hx} x2={hx} y1={pt} y2={pt + ih} stroke="#475569" strokeDasharray="2 3" />
            {points.map((p, i) => (
              <circle key={i} cx={x(i)} cy={y(p.value)} r={i === hover ? 6 : 3.5} fill={i === hover ? '#0EA5E9' : '#131C2E'} stroke="#0EA5E9" strokeWidth="2" />
            ))}
            {points.map((p, i) => {
              const half = iw / (points.length - 1) / 2
              return (
                <rect
                  key={`hit-${i}`}
                  x={x(i) - half}
                  y={pt}
                  width={half * 2}
                  height={ih}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                  tabIndex={0}
                  onFocus={() => setHover(i)}
                  aria-label={`${p.date}: ${p.value} ${cfg.unit}`}
                  role="button"
                />
              )
            })}
          </svg>
          <div
            className="absolute pointer-events-none rounded-[10px] border border-slate-600 bg-[#0B0F19]/95 px-3 py-2 text-xs shadow-xl"
            style={{ left: tipX, top: Math.max(y(hp.value) - 112, 4), width: tipW }}
            aria-live="polite"
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-slate-400">Date</dt>
              <dd className="font-mono">{hp.date}</dd>
              <dt className="text-slate-400">Value</dt>
              <dd className="font-mono font-semibold text-sky-300">
                {hp.value}
                {cfg.unit}
              </dd>
              <dt className="text-slate-400">Source</dt>
              <dd>{hp.source}</dd>
              <dt className="text-slate-400">Status</dt>
              <dd className={below ? 'text-amber-300 font-semibold' : 'text-emerald-300 font-semibold'}>{below ? (cfg.lowerIsWorse ? 'Below Baseline' : 'Above Baseline') : 'Within Baseline'}</dd>
            </dl>
          </div>
        </>
      )}
    </div>
  )
}

export function AnalyticsView({ onNavigate }: { onNavigate: (id: ModuleId) => void }) {
  const [metric, setMetric] = useState<MetricKey>('hrv')
  const [range, setRange] = useState<Range>('Last 7 Days')
  const cfg = METRICS[metric]
  const values = cfg.series[range]
  const labels = labelsFor(range)
  const points: Point[] = values.map((v, i) => ({
    label: labels[i],
    date: range === 'Last 24 Hours' ? `Nov 06, ${labels[i]}` : `${labels[i]}, 2026`,
    value: v,
    source: metric === 'sleep' ? 'Manual Log' : 'Wearable Sensor',
  }))
  const band = findDecline(values, cfg.lowerIsWorse)
  const current = values[values.length - 1]
  const first = values[0]
  const weekPct = Math.round(((current - first) / first) * 100)
  const variance = +(current - cfg.baseline).toFixed(1)
  const adverse = cfg.lowerIsWorse ? variance < 0 : variance > 0
  const significant = Math.abs(variance) / cfg.baseline > 0.05

  const exportCsv = () => {
    const rows = ['date,metric,value,unit,source', ...points.map((p) => `"${p.date}",${cfg.name},${p.value},${cfg.unit},${p.source}`)]
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `astrocare-${metric}-${range.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Module 03 · Trends"
        title="Health Analytics"
        actions={
          <button type="button" className="btn btn-outline-cyan" onClick={exportCsv}>
            <Download size={18} aria-hidden="true" />
            Export Telemetry CSV
          </button>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="chipbar flex-1" role="tablist" aria-label="Metric">
          {(Object.keys(METRICS) as MetricKey[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={metric === k} onClick={() => setMetric(k)}>
              {METRICS[k].label}
            </button>
          ))}
        </div>
        <RangeTabs options={RANGES} value={range} onChange={setRange} label="Time range" large />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="tile">
          <span className="k">Current {cfg.name}</span>
          <span className="val">
            {current}
            <small>{cfg.unit}</small>
          </span>
          <span className={`foot flex items-center gap-1 ${adverse ? 'text-amber-300' : 'text-emerald-300'}`}>
            <TrendingDown size={14} aria-hidden="true" className={weekPct >= 0 ? 'rotate-180 scale-x-[-1]' : ''} />
            {`${weekPct > 0 ? '+' : ''}${weekPct}% this ${range === 'Last 24 Hours' ? 'day' : range === 'Last 7 Days' ? 'week' : 'month'}`}
          </span>
        </div>
        <div className="tile">
          <span className="k">Personal Baseline</span>
          <span className="val">
            {cfg.baseline}
            <small>{cfg.unit}</small>
          </span>
          <span className="foot flex items-center gap-2">
            <svg width="28" height="4" aria-hidden="true">
              <line x1="0" x2="28" y1="2" y2="2" stroke="#F59E0B" strokeWidth="2" strokeDasharray="5 4" />
            </svg>
            Dotted line reference · pre-flight
          </span>
        </div>
        <div className={`tile ${adverse && significant ? '!border-amber-500/60' : ''}`}>
          <span className="k flex items-center gap-2">
            Variance
            {adverse && significant && <span className="st warn ml-auto">DEVIATION</span>}
          </span>
          <span className={`val ${adverse && significant ? 'text-amber-300' : ''}`}>
            {variance > 0 ? '+' : ''}
            {variance}
            <small>{cfg.unit}</small>
          </span>
          <span className="foot">{`${Math.abs(Math.round((variance / cfg.baseline) * 100))}% ${variance < 0 ? 'below' : 'above'} personal baseline`}</span>
        </div>
      </div>

      <Panel
        title={`${cfg.name} · ${range}`}
        aside={
          <div className="legend">
            <span>
              <i style={{ background: '#0EA5E9' }} />
              Recorded
            </span>
            <span>
              <i style={{ background: 'repeating-linear-gradient(90deg,#F59E0B 0 5px,transparent 5px 8px)' }} />
              Baseline
            </span>
            {band && (
              <span>
                <i style={{ background: 'rgba(245,158,11,0.4)', height: 8 }} />
                Trend window
              </span>
            )}
          </div>
        }
      >
        <TrendChart key={`${metric}-${range}`} points={points} cfg={cfg} band={band} />
      </Panel>

      {band ? (
        <div className="banner warn items-center">
          <TriangleAlert size={20} className="flex-none" aria-hidden="true" />
          <span className="flex-1">
            <strong className="font-semibold">Trend Flagged:</strong>{' '}
            {metric === 'hrv'
              ? `Continuous HRV decline detected over ${band.end - band.start + 1} days. Correlating with -1.5h reduced sleep duration.`
              : `Continuous adverse ${cfg.name} trend detected over ${band.end - band.start + 1} consecutive points.`}
          </span>
          <button type="button" className="btn btn-outline-cyan" onClick={() => onNavigate('ai')}>
            Open Root Cause in AI Health Assessment
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="banner info">
          <span>No sustained adverse trend detected for {cfg.name} in this range.</span>
        </div>
      )}

      <Panel title="Historical Comparison">
        <table className="dt">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Current Week</th>
              <th scope="col">Mission Average</th>
              <th scope="col">Pre-flight Baseline</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((r) => (
              <tr key={r.metric}>
                <th scope="row" className="!text-[13px] !tracking-normal !normal-case !text-slate-100 !font-medium">
                  {r.metric} <span className="text-slate-400 font-mono text-xs">({r.unit})</span>
                </th>
                <td className={`font-mono font-semibold ${r.status === 'warn' ? 'text-amber-300' : ''}`}>{r.current}</td>
                <td className="font-mono">{r.mission}</td>
                <td className="font-mono text-slate-300">{r.base}</td>
                <td>
                  <span className={`st ${r.status}`}>{r.status === 'warn' ? 'ATTENTION' : 'NORMAL'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
