'use client'

import { Activity, Bot, Brain, CircleCheck, Droplets, FlaskConical, Gauge, HeartPulse, Moon, Pencil, Radio, ScanHeart, Sparkles, Thermometer, TrendingDown, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { STATUS_COLOR, STATUS_LABEL, TREND_DATA, VITALS, type TrendRange, type Vital, type VitalId } from '@/lib/astro-data'
import type { Notify } from '../app-shell'
import { LineChart, Sparkline } from '../charts'
import type { ModuleId } from '../sidebar'
import { RangeTabs, StatusBadge } from '../ui'

const ICONS: Record<VitalId, LucideIcon> = {
  hr: HeartPulse,
  bp: Gauge,
  spo2: Droplets,
  temp: Thermometer,
  sleep: Moon,
  hrv: Activity,
  stress: Brain,
  glu: FlaskConical,
}

function VitalCard({ vital, onOpen }: { vital: Vital; onOpen: () => void }) {
  const Icon = ICONS[vital.id]
  const color = vital.status === 'ok' ? '#0EA5E9' : STATUS_COLOR[vital.status]
  return (
    <button
      type="button"
      className={`card ${vital.status === 'warn' ? 'warn' : ''}`}
      onClick={onOpen}
      aria-label={`${vital.title}: ${vital.value} ${vital.unit}, ${STATUS_LABEL[vital.status]}. Open detail`}
    >
      <div className="card-top">
        <span className={`mi ${vital.status === 'warn' ? 'warn' : ''}`}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <span className="card-title">{vital.title}</span>
        <StatusBadge status={vital.status} />
      </div>
      <div className="card-mid">
        <span className="val">
          {vital.value}
          <small>{vital.unit}</small>
        </span>
        <Sparkline data={vital.series} color={color} />
      </div>
      <div className="card-foot">
        <span className="src">
          {vital.source === 'Sensor' ? <Radio size={11} aria-hidden="true" /> : <Pencil size={11} aria-hidden="true" />}
          {vital.source.toUpperCase()}
        </span>
        <span className="ts">{vital.updated}</span>
      </div>
    </button>
  )
}

function VitalDetail({ vital, onClose }: { vital: Vital; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const Icon = ICONS[vital.id]
  const nums = vital.series
  const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
  const mn = Math.min(...nums, vital.baseline)
  const mx = Math.max(...nums, vital.baseline)
  const pad = (mx - mn) * 0.3 || 1

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="vital-detail-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-h">
          <span className={`mi ${vital.status === 'warn' ? 'warn' : ''}`}>
            <Icon size={15} aria-hidden="true" />
          </span>
          <h3 id="vital-detail-title">{vital.title}</h3>
          <StatusBadge status={vital.status} />
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close detail" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="k">Current</div>
            <div className="v">
              {vital.value} <small className="text-xs text-[var(--text-3)]">{vital.unit}</small>
            </div>
          </div>
          <div className="stat">
            <div className="k">7-Day Avg</div>
            <div className="v">{vital.id === 'bp' ? '124/81' : avg}</div>
          </div>
          <div className="stat">
            <div className="k">Source · Updated</div>
            <div className="v text-sm" style={{ fontSize: 14, marginTop: 8 }}>
              {vital.source} · {vital.updated}
            </div>
          </div>
        </div>
        <div style={{ height: 180, display: 'flex' }}>
          <LineChart
            series={[{ data: nums, color: vital.status === 'ok' ? '#0EA5E9' : STATUS_COLOR[vital.status], fill: true }]}
            labels={TREND_DATA['7D'].labels}
            baseline={vital.baseline}
            yMin={+(mn - pad).toFixed(1)}
            yMax={+(mx + pad).toFixed(1)}
            ariaLabel={`${vital.title} 7-day trend`}
          />
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--text-2)]">
          {vital.range}
          {vital.status === 'warn' ? ' · Trend flagged by edge model; review recommended.' : ' · Within personal baseline band.'}
        </p>
      </div>
    </div>
  )
}

type DashboardProps = { notify: Notify; utc: string; onNavigate: (id: ModuleId) => void }

export function DashboardView({ notify, utc, onNavigate }: DashboardProps) {
  const [range, setRange] = useState<TrendRange>('7D')
  const [openId, setOpenId] = useState<VitalId | null>(null)
  const trend = TREND_DATA[range]
  const openVital = VITALS.find((v) => v.id === openId)

  return (
    <div className="dash">
      <section className="hero" aria-labelledby="risk-title">
        <div className="level" role="status">
          <span className="k">HEALTH RISK</span>
          <span className="v">
            <TriangleAlert size={22} aria-hidden="true" />
            WARNING
          </span>
        </div>
        <div className="flex-1">
          <div className="eyebrow" id="risk-title">
            AI Proactive Assessment · updated 15m ago
          </div>
          <p>
            <strong>HRV has decreased</strong> compared with personal baseline over the past 5 days. <strong>Sleep duration</strong> is below personal target.
          </p>
        </div>
        <div className="delta">
          <TrendingDown size={16} aria-hidden="true" />
          <span>
            HRV: <span className="mono">-14%</span> vs Baseline
          </span>
        </div>
      </section>

      <section aria-label="Vital signs overview" className="vital-grid">
        {VITALS.map((v) => (
          <VitalCard key={v.id} vital={v} onOpen={() => setOpenId(v.id)} />
        ))}
      </section>

      <div className="split">
        <section className="panel" aria-labelledby="trend-h">
          <div className="panel-h">
            <h2 id="trend-h">Health Trends Preview</h2>
            <div className="legend">
              <span>
                <i style={{ background: 'var(--cyan)' }} />
                HRV (ms)
              </span>
              <span>
                <i style={{ background: 'var(--indigo)' }} />
                Heart Rate (bpm)
              </span>
              <span>
                <i style={{ background: 'repeating-linear-gradient(90deg,var(--text-3) 0 3px,transparent 3px 6px)' }} />
                Personal Baseline
              </span>
            </div>
            <RangeTabs options={['24H', '7D', '30D'] as TrendRange[]} value={range} onChange={setRange} label="Range" />
          </div>
          <LineChart
            series={[
              { data: trend.hrv, color: '#0EA5E9', fill: true },
              { data: trend.hr, color: '#6366F1', axis: 2 },
            ]}
            labels={trend.labels}
            baseline={49}
            yMin={30}
            yMax={60}
            y2={{ min: 55, max: 85 }}
            ariaLabel={`HRV and heart rate trend, ${range}`}
          />
        </section>

        <section className="panel" aria-labelledby="alert-h">
          <div className="panel-h">
            <h2 id="alert-h">Active Health Alerts</h2>
            <span className="cnt">1</span>
          </div>
          <article className="alert">
            <div className="alert-h">
              <span className="ai">
                <Activity size={17} aria-hidden="true" />
              </span>
              <h3>Declining HRV Pattern</h3>
              <StatusBadge status="warn" />
            </div>
            <dl className="kv">
              <dt>Severity</dt>
              <dd>Warning · 5-day trend</dd>
              <dt>Action</dt>
              <dd>Review sleep routine</dd>
            </dl>
            <button type="button" className="btn btn-indigo w-full" onClick={() => onNavigate('ai')}>
              <Sparkles size={18} aria-hidden="true" />
              View AI Assessment
            </button>
          </article>
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="mini">
              <StatusBadge status="neu" label="INFO" />
              Sleep 6.2 h · target 7.5 h<span className="ts">06:10</span>
            </div>
          </div>
        </section>
      </div>

      <nav className="dock" aria-label="Quick actions">
        <button type="button" className="btn btn-primary" onClick={() => notify('Sensor measurement started · hold still 30s')}>
          <ScanHeart size={18} aria-hidden="true" />
          Start Measurement
        </button>
        <button type="button" className="btn btn-indigo" onClick={() => notify('ASTRO AI assessment queued on Edge')}>
          <Bot size={18} aria-hidden="true" />
          Ask ASTRO AI
        </button>
        <button type="button" className="btn btn-ok" onClick={() => notify(`Daily check-in logged · ${utc} UTC`)}>
          <CircleCheck size={18} aria-hidden="true" />
          Daily Check-in Complete
        </button>
      </nav>

      {openVital && <VitalDetail vital={openVital} onClose={() => setOpenId(null)} />}
    </div>
  )
}
