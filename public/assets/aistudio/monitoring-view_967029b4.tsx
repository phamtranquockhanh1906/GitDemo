'use client'

import {
  Armchair,
  Brain,
  Check,
  Clock,
  Droplet,
  Droplets,
  Eye,
  Gauge,
  Hand,
  HeartPulse,
  Moon,
  Ruler,
  Thermometer,
  TriangleAlert,
  CircleAlert,
  Timer,
  Hourglass,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Notify } from '../app-shell'
import { PageHeader, Panel } from '../ui'

type MetricId = 'hr' | 'bp' | 'spo2' | 'temp' | 'glu' | 'sleep' | 'mood'
type SourceId = 'Sensor' | 'Manual' | 'Simulated' | 'External'

type FieldDef = { key: string; label: string; unit: string; normal: [number, number]; plausible: [number, number]; step?: number; initial: string }

type MetricDef = {
  id: MetricId
  label: string
  icon: LucideIcon
  title: string
  fields: FieldDef[]
  guidance: { icon: LucideIcon; text: string }[]
  format: (v: Record<string, string>) => string
}

const METRICS: MetricDef[] = [
  {
    id: 'hr',
    label: 'Heart Rate',
    icon: HeartPulse,
    title: 'Log Heart Rate Measurement',
    fields: [{ key: 'hr', label: 'Heart Rate', unit: 'BPM', normal: [55, 100], plausible: [25, 230], initial: '74' }],
    guidance: [
      { icon: Armchair, text: 'Rest seated or restrained for 5 minutes.' },
      { icon: Hand, text: 'Place fingertip sensor or chest strap firmly.' },
      { icon: Hourglass, text: 'Hold still for a 30-second capture window.' },
      { icon: Ruler, text: 'Confirm reading is in BPM.' },
    ],
    format: (v) => `${v.hr} BPM`,
  },
  {
    id: 'bp',
    label: 'Blood Pressure',
    icon: Gauge,
    title: 'Log Blood Pressure Measurement',
    fields: [
      { key: 'sys', label: 'Systolic', unit: 'mmHg', normal: [90, 135], plausible: [60, 260], initial: '142' },
      { key: 'dia', label: 'Diastolic', unit: 'mmHg', normal: [60, 85], plausible: [30, 160], initial: '91' },
      { key: 'pulse', label: 'Pulse', unit: 'BPM', normal: [55, 100], plausible: [25, 230], initial: '78' },
    ],
    guidance: [
      { icon: Armchair, text: 'Rest seated for 5 minutes prior to measurement.' },
      { icon: HeartPulse, text: 'Fasten cuff securely at heart level.' },
      { icon: Hand, text: 'Maintain stillness during reading.' },
      { icon: Ruler, text: 'Verify mmHg unit calibration.' },
    ],
    format: (v) => `${v.sys}/${v.dia} mmHg · ${v.pulse} BPM`,
  },
  {
    id: 'spo2',
    label: 'SpO₂',
    icon: Droplets,
    title: 'Log SpO₂ Measurement',
    fields: [{ key: 'spo2', label: 'Oxygen Saturation', unit: '%', normal: [95, 100], plausible: [60, 100], initial: '98' }],
    guidance: [
      { icon: Hand, text: 'Warm fingertip and remove any coatings.' },
      { icon: Armchair, text: 'Rest hand at heart level.' },
      { icon: Hourglass, text: 'Wait for a stable waveform (10 s).' },
      { icon: Eye, text: 'Check perfusion index ≥ 1.0.' },
    ],
    format: (v) => `${v.spo2}%`,
  },
  {
    id: 'temp',
    label: 'Body Temp',
    icon: Thermometer,
    title: 'Log Body Temperature',
    fields: [{ key: 'temp', label: 'Core Temperature', unit: '°C', normal: [36.1, 37.5], plausible: [32, 43], step: 0.1, initial: '36.8' }],
    guidance: [
      { icon: Clock, text: 'Avoid exercise or meals for 20 minutes.' },
      { icon: Thermometer, text: 'Place probe sublingually or use tympanic mode.' },
      { icon: Hand, text: 'Keep mouth closed until the tone.' },
      { icon: Ruler, text: 'Verify unit is °C.' },
    ],
    format: (v) => `${v.temp} °C`,
  },
  {
    id: 'glu',
    label: 'Blood Glucose',
    icon: Droplet,
    title: 'Log Blood Glucose',
    fields: [{ key: 'glu', label: 'Glucose', unit: 'mg/dL', normal: [70, 140], plausible: [20, 600], initial: '96' }],
    guidance: [
      { icon: Hand, text: 'Clean fingertip with an alcohol wipe.' },
      { icon: Droplet, text: 'Use a contained lancet capture pouch.' },
      { icon: Timer, text: 'Note time since last meal.' },
      { icon: Ruler, text: 'Verify meter is set to mg/dL.' },
    ],
    format: (v) => `${v.glu} mg/dL`,
  },
  {
    id: 'sleep',
    label: 'Sleep',
    icon: Moon,
    title: 'Log Sleep Period',
    fields: [
      { key: 'hrs', label: 'Duration', unit: 'hrs', normal: [6.5, 9.5], plausible: [0, 16], step: 0.1, initial: '5.9' },
      { key: 'wake', label: 'Awakenings', unit: 'count', normal: [0, 3], plausible: [0, 30], initial: '2' },
    ],
    guidance: [
      { icon: Clock, text: 'Log within 30 minutes of waking.' },
      { icon: Moon, text: 'Count only time inside the crew quarters bag.' },
      { icon: Eye, text: 'Include awakenings longer than 5 minutes.' },
      { icon: Wind, text: 'Note CO₂ or noise disturbances in comments.' },
    ],
    format: (v) => `${v.hrs} h · ${v.wake} wakes`,
  },
  {
    id: 'mood',
    label: 'Mood & Stress',
    icon: Brain,
    title: 'Log Mood & Stress Self-Assessment',
    fields: [
      { key: 'mood', label: 'Mood (1–10)', unit: '/10', normal: [5, 10], plausible: [1, 10], initial: '7' },
      { key: 'stress', label: 'Stress (1–10)', unit: '/10', normal: [1, 6], plausible: [1, 10], initial: '5' },
    ],
    guidance: [
      { icon: Armchair, text: 'Find a quiet module, 2 minutes alone.' },
      { icon: Wind, text: 'Take three slow breaths before rating.' },
      { icon: Brain, text: 'Rate how you feel now, not today overall.' },
      { icon: Eye, text: 'Answers are confidential to the Flight Surgeon.' },
    ],
    format: (v) => `Mood ${v.mood} · Stress ${v.stress}`,
  },
]

const SOURCES: SourceId[] = ['Sensor', 'Manual', 'Simulated', 'External']
const SOURCE_LABEL: Record<SourceId, string> = { Sensor: 'Sensor Data', Manual: 'Manual Input', Simulated: 'Simulated Data', External: 'External Dataset' }
const SOURCE_PILL: Record<SourceId, string> = { Sensor: 'cyan', Manual: 'indigo', Simulated: 'slate', External: 'slate' }

type Row = { id: number; time: string; metric: MetricId; value: string; source: SourceId; quality: 'Valid' | 'Verified' | 'Flagged' }

const INITIAL_ROWS: Row[] = [
  { id: 5, time: '2026-11-06 08:12', metric: 'bp', value: '124/80 mmHg · 76 BPM', source: 'Sensor', quality: 'Verified' },
  { id: 4, time: '2026-11-06 07:40', metric: 'spo2', value: '98%', source: 'Sensor', quality: 'Verified' },
  { id: 3, time: '2026-11-06 07:05', metric: 'sleep', value: '5.7 h · 3 wakes', source: 'Manual', quality: 'Valid' },
  { id: 2, time: '2026-11-05 21:30', metric: 'mood', value: 'Mood 6 · Stress 6', source: 'Manual', quality: 'Valid' },
  { id: 1, time: '2026-11-05 18:02', metric: 'hr', value: '82 BPM', source: 'Simulated', quality: 'Valid' },
]

function classify(f: FieldDef, raw: string): 'ok' | 'warn' | 'crit' | 'empty' {
  if (raw.trim() === '') return 'empty'
  const v = Number(raw)
  if (Number.isNaN(v) || v < f.plausible[0] || v > f.plausible[1]) return 'crit'
  if (v < f.normal[0] || v > f.normal[1]) return 'warn'
  return 'ok'
}

const initialValues = (m: MetricDef) => Object.fromEntries(m.fields.map((f) => [f.key, f.initial]))

export function MonitoringView({ notify }: { notify: Notify }) {
  const [metricId, setMetricId] = useState<MetricId>('bp')
  const metric = METRICS.find((m) => m.id === metricId)!
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(metric))
  const [source, setSource] = useState<SourceId>('Manual')
  const [timeMode, setTimeMode] = useState<'auto' | 'custom'>('auto')
  const [customTime, setCustomTime] = useState('08:30')
  const [confirmAbnormal, setConfirmAbnormal] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [rows, setRows] = useState<Row[]>(INITIAL_ROWS)
  const [filter, setFilter] = useState<'all' | SourceId>('all')
  const [detail, setDetail] = useState<Row | null>(null)

  const switchMetric = (id: MetricId) => {
    const m = METRICS.find((x) => x.id === id)!
    setMetricId(id)
    setValues(initialValues(m))
    setConfirmAbnormal(false)
  }

  const states = metric.fields.map((f) => classify(f, values[f.key] ?? ''))
  const hasInvalid = states.some((s) => s === 'crit' || s === 'empty')
  const hasAbnormal = states.includes('warn')
  const canReview = !hasInvalid && (!hasAbnormal || confirmAbnormal)

  const visibleRows = useMemo(() => rows.filter((r) => filter === 'all' || r.source === filter).slice(0, 5), [rows, filter])

  const save = () => {
    const stamp = timeMode === 'auto' ? new Date().toISOString().slice(0, 16).replace('T', ' ') : `2026-11-06 ${customTime}`
    setRows((r) => [{ id: Date.now(), time: stamp, metric: metricId, value: metric.format(values), source, quality: hasAbnormal ? 'Flagged' : source === 'Sensor' ? 'Verified' : 'Valid' }, ...r])
    setReviewing(false)
    setConfirmAbnormal(false)
    setValues(initialValues(metric))
    notify(`${metric.label} measurement saved to local cache`)
  }

  const reset = () => {
    setValues(initialValues(metric))
    setConfirmAbnormal(false)
    setTimeMode('auto')
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Module 02 · Data Input" title="Health Monitoring" />

      <div className="chipbar" role="tablist" aria-label="Select metric">
        {METRICS.map((m) => {
          const Icon = m.icon
          return (
            <button key={m.id} type="button" role="tab" aria-selected={metricId === m.id} onClick={() => switchMetric(m.id)}>
              <Icon size={16} aria-hidden="true" />
              {m.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Panel title={metric.title} aside={<span className="pill indigo ml-auto">{SOURCE_LABEL[source]}</span>}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (canReview) setReviewing(true)
            }}
          >
            <div className={`grid gap-3 ${metric.fields.length === 3 ? 'grid-cols-3' : metric.fields.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {metric.fields.map((f, i) => {
                const st = states[i]
                const id = `f-${metric.id}-${f.key}`
                return (
                  <div key={f.key} className="field">
                    <label htmlFor={id}>{f.label}</label>
                    <div className={`input-wrap ${st === 'warn' ? 'warn' : st === 'crit' ? 'crit' : ''}`}>
                      <input
                        id={id}
                        inputMode="decimal"
                        type="number"
                        step={f.step ?? 1}
                        value={values[f.key] ?? ''}
                        aria-invalid={st === 'crit'}
                        aria-describedby={`${id}-r`}
                        onChange={(e) => {
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                          setConfirmAbnormal(false)
                        }}
                      />
                      <span className="unit">{f.unit}</span>
                    </div>
                    <span id={`${id}-r`} className={`text-[11px] font-mono ${st === 'crit' ? 'text-red-300' : 'text-slate-400'}`}>
                      {st === 'crit' ? `Out of plausible range ${f.plausible[0]}–${f.plausible[1]}` : `Normal ${f.normal[0]}–${f.normal[1]}`}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="field">
              <label htmlFor="time-mode">Measurement Time</label>
              <div className="flex gap-2">
                <div className="input-wrap flex-1">
                  <Clock size={16} className="text-slate-400" aria-hidden="true" />
                  <select id="time-mode" value={timeMode} onChange={(e) => setTimeMode(e.target.value as 'auto' | 'custom')}>
                    <option value="auto">Current Time (Auto)</option>
                    <option value="custom">Set custom time</option>
                  </select>
                </div>
                {timeMode === 'custom' && (
                  <div className="input-wrap w-36">
                    <input type="time" aria-label="Custom time (UTC)" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="!text-base" />
                  </div>
                )}
              </div>
            </div>

            <div className="field">
              <span className="lbl" id="src-lbl">
                Data Source
              </span>
              <div className="seg" role="radiogroup" aria-labelledby="src-lbl">
                {SOURCES.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={source === s} onClick={() => setSource(s)}>
                    <span className="rd" aria-hidden="true" />
                    {SOURCE_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {hasInvalid && states.includes('crit') && (
              <div className="banner crit" role="alert">
                <CircleAlert size={18} className="flex-none mt-px" aria-hidden="true" />
                <span>One or more values are outside physiologically plausible limits. Please re-measure or correct the entry.</span>
              </div>
            )}
            {!states.includes('crit') && hasAbnormal && (
              <div className="banner warn" role="status">
                <TriangleAlert size={18} className="flex-none mt-px" aria-hidden="true" />
                <div className="flex flex-col gap-2 flex-1">
                  <span>Values exceed normal range. Please confirm this reading is accurate.</span>
                  <button type="button" role="checkbox" aria-checked={confirmAbnormal} onClick={() => setConfirmAbnormal((c) => !c)} className="flex items-center gap-3 min-h-12 text-left font-semibold">
                    <span className="check">
                      <Check size={16} strokeWidth={3} aria-hidden="true" />
                    </span>
                    I confirm this reading is accurate
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button type="button" className="btn" onClick={reset}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary flex-1 max-w-72 disabled:opacity-40 disabled:cursor-not-allowed" disabled={!canReview}>
                Review &amp; Save Measurement
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Measurement Guidance" aside={<span className="pill cyan ml-auto">{metric.label}</span>}>
          <ol className="steps">
            {metric.guidance.map((g, i) => {
              const Icon = g.icon
              return (
                <li key={g.text}>
                  <span className="n">{i + 1}</span>
                  <span className="flex-1">{g.text}</span>
                  <span className="mi">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                </li>
              )
            })}
          </ol>
          <div className="banner neu mt-3">
            <Eye size={16} className="flex-none mt-px" aria-hidden="true" />
            <span>Readings are stored locally first and synced to ground when the downlink is available.</span>
          </div>
        </Panel>
      </div>

      <Panel
        title="Measurement History"
        aside={
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="hist-filter" className="text-xs text-slate-400">
              Source
            </label>
            <div className="input-wrap !min-h-10 w-44">
              <select id="hist-filter" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | SourceId)} className="!h-10">
                <option value="all">All sources</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        <table className="dt">
          <thead>
            <tr>
              <th scope="col">Date / Time (UTC)</th>
              <th scope="col">Metric</th>
              <th scope="col">Value</th>
              <th scope="col">Source</th>
              <th scope="col">Quality</th>
              <th scope="col" className="w-14">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-slate-300">{r.time}</td>
                <td>{METRICS.find((m) => m.id === r.metric)?.label}</td>
                <td className="font-mono font-semibold">{r.value}</td>
                <td>
                  <span className={`pill ${SOURCE_PILL[r.source]}`}>{r.source}</span>
                </td>
                <td>
                  <span className={`st ${r.quality === 'Verified' ? 'ok' : r.quality === 'Flagged' ? 'warn' : 'neu'}`}>{r.quality.toUpperCase()}</span>
                </td>
                <td>
                  <button type="button" className="icon-btn" aria-label={`View details for ${r.time}`} onClick={() => setDetail(r)}>
                    <Eye size={18} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-6">
                  No records for this source.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {reviewing && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="review-h">
          <div className="sheet">
            <div className="sheet-h">
              <h3 id="review-h">Review Measurement</h3>
              {hasAbnormal && <span className="st warn">ABOVE RANGE</span>}
            </div>
            <dl className="kv !text-sm">
              <dt>Metric</dt>
              <dd>{metric.label}</dd>
              <dt>Value</dt>
              <dd className="font-mono font-semibold">{metric.format(values)}</dd>
              <dt>Time</dt>
              <dd className="font-mono">{timeMode === 'auto' ? 'Current Time (Auto)' : `${customTime} UTC`}</dd>
              <dt>Source</dt>
              <dd>{SOURCE_LABEL[source]}</dd>
            </dl>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn" onClick={() => setReviewing(false)}>
                Back to Edit
              </button>
              <button type="button" className="btn btn-primary" onClick={save} autoFocus>
                Confirm &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="detail-h" onClick={() => setDetail(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-h">
              <h3 id="detail-h">Record Details</h3>
              <span className={`pill ${SOURCE_PILL[detail.source]}`}>{detail.source}</span>
            </div>
            <dl className="kv !text-sm">
              <dt>Recorded</dt>
              <dd className="font-mono">{detail.time} UTC</dd>
              <dt>Metric</dt>
              <dd>{METRICS.find((m) => m.id === detail.metric)?.label}</dd>
              <dt>Value</dt>
              <dd className="font-mono font-semibold">{detail.value}</dd>
              <dt>Quality</dt>
              <dd>{detail.quality}</dd>
              <dt>Record ID</dt>
              <dd className="font-mono text-slate-400">REC-{String(detail.id).slice(-6)}</dd>
            </dl>
            <div className="flex justify-end">
              <button type="button" className="btn" onClick={() => setDetail(null)} autoFocus>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
