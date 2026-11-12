'use client'

import { Database, Lock, RefreshCw, ShieldCheck, Wifi } from 'lucide-react'
import { useState } from 'react'
import type { Notify } from '../app-shell'
import { Panel } from '../ui'

type Tab = 'baselines' | 'history' | 'units' | 'sync'
const TABS: { id: Tab; label: string }[] = [
  { id: 'baselines', label: 'Personal Baselines' },
  { id: 'history', label: 'Medical History' },
  { id: 'units', label: 'Unit Settings' },
  { id: 'sync', label: 'Offline Sync Preferences' },
]

const BASELINES = [
  ['Resting Heart Rate', '68', 'BPM'],
  ['Heart Rate Variability (HRV)', '56', 'ms'],
  ['Baseline SpO₂', '98 – 99', '%'],
  ['Blood Pressure Baseline', '118/76', 'mmHg'],
  ['Target Sleep Duration', '7.5', 'Hours'],
  ['Normal Body Temp', '36.6 – 37.1', '°C'],
]

const HISTORY = [
  { date: '2025-03', item: 'Pre-flight long-duration medical certification', tag: 'Cleared', tone: 'ok' },
  { date: '2024-09', item: 'Mild seasonal allergic rhinitis · managed', tag: 'Monitored', tone: 'neu' },
  { date: '2023-06', item: 'Right ankle sprain (Grade I) · fully resolved', tag: 'Resolved', tone: 'ok' },
  { date: '—', item: 'No known drug allergies', tag: 'NKDA', tone: 'neu' },
]

const PROFILE = [
  ['Mission', 'Artemis Orbital Research – Station Alpha'],
  ['Mission Phase', 'Orbital Science Phase 2'],
  ['Role', 'Payload Specialist / Flight Engineer'],
]

function Toggle({ label, desc, on, onChange }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="row-item w-full text-left !min-h-16 hover:border-slate-500">
      <span className="flex-1 flex flex-col gap-0.5">
        <span className="t">{label}</span>
        {desc && <span className="s">{desc}</span>}
      </span>
      <span className="switch" />
    </button>
  )
}

function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="row-item !min-h-16">
      <span className="t flex-1">{label}</span>
      <div className="tabs lg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} aria-selected={value === o} onClick={() => onChange(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ProfileView({ notify }: { notify: Notify }) {
  const [tab, setTab] = useState<Tab>('baselines')
  const [autoSync, setAutoSync] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('08:14 UTC')
  const [temp, setTemp] = useState<'°C' | '°F'>('°C')
  const [glu, setGlu] = useState<'mg/dL' | 'mmol/L'>('mg/dL')
  const [clock, setClock] = useState<'24h' | '12h'>('24h')
  const [wifiOnly, setWifiOnly] = useState(false)
  const [compress, setCompress] = useState(true)
  const [retention, setRetention] = useState<'30 d' | '90 d' | '180 d'>('180 d')
  const used = 24.8
  const cap = 500

  const syncNow = () => {
    setSyncing(true)
    setTimeout(() => {
      setSyncing(false)
      setLastSync(new Date().toISOString().slice(11, 16) + ' UTC')
      notify('Local cache synced with ground server')
    }, 1200)
  }

  return (
    <div className="page !flex-row !items-start gap-3">
      <aside className="w-[35%] flex-none flex flex-col gap-3" aria-label="Astronaut profile">
        <section className="panel !p-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl grid place-items-center bg-gradient-to-br from-sky-500 to-indigo-500 text-xl font-bold text-white flex-none">AV</div>
            <div className="min-w-0">
              <span className="pill cyan font-mono">ASTRO-001</span>
              <h1 className="text-xl font-bold mt-1.5">Dr. Alex Vance</h1>
            </div>
          </div>
          <dl className="flex flex-col gap-3">
            {PROFILE.map(([k, v]) => (
              <div key={k}>
                <dt className="eyebrow">{k}</dt>
                <dd className="text-sm mt-0.5 text-slate-100">{v}</dd>
              </div>
            ))}
            <div>
              <dt className="eyebrow">Current Day</dt>
              <dd className="mt-1">
                <span className="font-mono text-lg font-semibold">Day 24</span>
                <span className="text-sm text-slate-400"> of 180</span>
                <div className="bar-track mt-2">
                  <div className="bar-fill bg-sky-500" style={{ width: `${(24 / 180) * 100}%` }} />
                </div>
              </dd>
            </div>
          </dl>
          <div className="banner warn items-center !py-2">
            <Lock size={16} className="flex-none" aria-hidden="true" />
            <span className="font-semibold text-xs tracking-wide">Class 1 Medical Data Restricted</span>
          </div>
        </section>

        <Panel title="Offline & Edge Data Sync" aside={<span className="st ok ml-auto">LINK UP</span>}>
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <Database size={16} className="text-sky-400" aria-hidden="true" />
                <span className="flex-1">IndexedDB Local Cache</span>
                <span className="font-mono text-xs">
                  {used} MB / {cap} MB
                </span>
              </div>
              <div className="bar-track mt-2" role="progressbar" aria-label="Local cache usage" aria-valuenow={used} aria-valuemin={0} aria-valuemax={cap}>
                <div className="bar-fill bg-sky-500" style={{ width: `${Math.max((used / cap) * 100, 2)}%` }} />
              </div>
            </div>
            <Toggle label="Auto-sync with ground server" desc="When link bandwidth > 256 kbps" on={autoSync} onChange={setAutoSync} />
            <button type="button" className="btn btn-outline-cyan w-full" onClick={syncNow} disabled={syncing}>
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            <span className="text-xs text-slate-400 font-mono text-center">Last sync {lastSync}</span>
          </div>
        </Panel>
      </aside>

      <section className="panel flex-1 !p-4 gap-4" aria-label="Profile settings">
        <div className="chipbar" role="tablist" aria-label="Profile sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`tp-${t.id}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'baselines' && (
          <div id="tp-baselines" role="tabpanel" className="flex flex-col gap-3">
            <table className="dt">
              <thead>
                <tr>
                  <th scope="col">Parameter</th>
                  <th scope="col" className="!text-right">
                    Baseline
                  </th>
                  <th scope="col">Unit</th>
                </tr>
              </thead>
              <tbody>
                {BASELINES.map(([k, v, u]) => (
                  <tr key={k}>
                    <th scope="row" className="!text-sm !tracking-normal !normal-case !text-slate-100 !font-medium !py-3.5">
                      {k}
                    </th>
                    <td className="font-mono text-lg font-semibold text-right text-sky-200">{v}</td>
                    <td className="text-slate-400 font-mono text-xs">{u}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="banner info items-center !rounded-full !px-4">
              <ShieldCheck size={16} className="flex-none" aria-hidden="true" />
              <span className="text-xs">Baseline derived from 30-day pre-flight astronaut physical baseline. Read-only.</span>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <ul id="tp-history" role="tabpanel" className="flex flex-col gap-2">
            {HISTORY.map((h) => (
              <li key={h.item} className="row-item">
                <span className="font-mono text-xs text-slate-400 w-16 flex-none">{h.date}</span>
                <span className="flex-1 text-sm">{h.item}</span>
                <span className={`st ${h.tone}`}>{h.tag.toUpperCase()}</span>
              </li>
            ))}
            <li className="text-xs text-slate-400 mt-1">Full record held by Flight Surgeon. Edits require ground medical authorization.</li>
          </ul>
        )}

        {tab === 'units' && (
          <div id="tp-units" role="tabpanel" className="flex flex-col gap-2">
            <Segmented label="Temperature" options={['°C', '°F']} value={temp} onChange={setTemp} />
            <Segmented label="Blood Glucose" options={['mg/dL', 'mmol/L']} value={glu} onChange={setGlu} />
            <Segmented label="Time Format" options={['24h', '12h']} value={clock} onChange={setClock} />
            <div className="row-item !min-h-16">
              <span className="t flex-1">Blood Pressure</span>
              <span className="font-mono text-sm text-slate-300">mmHg (fixed)</span>
            </div>
          </div>
        )}

        {tab === 'sync' && (
          <div id="tp-sync" role="tabpanel" className="flex flex-col gap-2">
            <Toggle label="Auto-sync when bandwidth > 256 kbps" desc="Uses Ku-band downlink windows" on={autoSync} onChange={setAutoSync} />
            <Toggle label="Sync only over station Wi-Fi" desc="Defer large uploads off the S-band link" on={wifiOnly} onChange={setWifiOnly} />
            <Toggle label="Compress telemetry before upload" desc="Reduces payload ~68%" on={compress} onChange={setCompress} />
            <Segmented label="Local cache retention" options={['30 d', '90 d', '180 d']} value={retention} onChange={setRetention} />
            <div className="banner neu items-center mt-1">
              <Wifi size={16} className="flex-none" aria-hidden="true" />
              <span className="text-xs">Data is always written locally first. Conflicts resolve in favour of the most recent on-board record.</span>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
