'use client'

import { Bot, Check, Info, Phone, ShieldAlert, Siren, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import type { Notify } from '../app-shell'
import { PageHeader, Panel } from '../ui'

const ANOMALIES = [
  { name: 'HRV', state: 'Below Baseline', detail: '42 ms vs 56 ms', sev: 'warn' },
  { name: 'Sleep Duration', state: 'Reduced', detail: '-1.8 hrs/night', sev: 'warn' },
  { name: 'Resting Heart Rate', state: 'Elevated', detail: '+7 BPM above baseline', sev: 'warn' },
] as const

const FACTORS = ['High operational workload (EVA training)', 'Circadian rhythm desynchronization', 'Decreased physiological recovery rate']

const ACTIONS = [
  'Prioritize 8-hour sleep block tonight.',
  'Execute guided breathing/relaxation protocol (15 min).',
  'Reschedule high-intensity physical mission tasks if approved by Flight Director.',
  'Re-assess vitals in 6 hours.',
]

const META = [
  ['Timestamp', '2026-11-06 08:30 UTC'],
  ['Model Version', 'BioAI-v2.4-Edge'],
  ['Source', 'Simulated Dataset'],
]

export function AiAssessmentView({ notify }: { notify: Notify }) {
  const [done, setDone] = useState<boolean[]>(ACTIONS.map(() => false))
  const [confirming, setConfirming] = useState(false)
  const [escalated, setEscalated] = useState(false)
  const completed = done.filter(Boolean).length

  const toggle = (i: number) => setDone((d) => d.map((v, j) => (j === i ? !v : v)))

  return (
    <div className="page">
      <PageHeader eyebrow="Module 04 · Health Insights" title="AI Health Assessment" />

      <section className="risk flex items-center gap-6" aria-label="Risk level">
        <div className="flex items-center gap-4">
          <span className="grid place-items-center w-14 h-14 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-400">
            <TriangleAlert size={28} aria-hidden="true" />
          </span>
          <div>
            <div className="eyebrow">Risk Level</div>
            <div className="lvl mt-1">WARNING</div>
          </div>
        </div>
        <div className="h-12 w-px bg-slate-700" aria-hidden="true" />
        <dl className="grid grid-cols-3 gap-6 flex-1">
          {META.map(([k, v]) => (
            <div key={k}>
              <dt className="eyebrow">{k}</dt>
              <dd className="font-mono text-sm mt-1 text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="banner neu">
        <Info size={16} className="flex-none mt-px text-slate-400" aria-hidden="true" />
        <span>This assessment is intended for health monitoring and decision support, not as a definitive medical diagnosis.</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Panel title="Detected Anomalies" aside={<span className="cnt ml-auto">{ANOMALIES.length}</span>}>
          <ul className="flex flex-col gap-2">
            {ANOMALIES.map((a) => (
              <li key={a.name} className="row-item !items-start">
                <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 flex-none shadow-[0_0_8px_rgba(245,158,11,0.8)]" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="t">
                    {a.name}: <span className="text-amber-300">{a.state}</span>
                  </span>
                  <span className="s font-mono">{a.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Correlated Risk Factors">
          <ul className="flex flex-col gap-2">
            {FACTORS.map((f) => (
              <li key={f} className="row-item">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-none" aria-hidden="true" />
                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="AI Explanation" aside={<span className="pill indigo ml-auto">BioAI</span>}>
          <div className="flex-1 rounded-[10px] border border-indigo-500/40 bg-indigo-500/[0.07] p-3 flex flex-col gap-3">
            <Bot size={20} className="text-indigo-300" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-slate-100">
              Recent measurements indicate a declining HRV trend over 5 consecutive days accompanied by cumulative sleep debt. These indicators point to{' '}
              <strong className="text-indigo-200 font-semibold">incomplete autonomic recovery</strong> rather than acute cardiac dysfunction.
            </p>
            <span className="mt-auto text-xs text-slate-400 font-mono">Confidence 0.82 · 5-day window</span>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <Panel
          title="Actionable Recommendations"
          aside={
            <span className="ml-auto font-mono text-xs text-slate-300">
              {completed}/{ACTIONS.length} complete
            </span>
          }
        >
          <div className="bar-track mb-3">
            <div className="bar-fill bg-emerald-500 transition-all" style={{ width: `${(completed / ACTIONS.length) * 100}%` }} />
          </div>
          <ul className="flex flex-col gap-2">
            {ACTIONS.map((a, i) => (
              <li key={a}>
                <button type="button" role="checkbox" aria-checked={done[i]} onClick={() => toggle(i)} className="row-item w-full text-left hover:border-slate-500">
                  <span className="check">
                    <Check size={16} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span className={`text-sm flex-1 ${done[i] ? 'text-slate-400 line-through' : 'text-slate-100'}`}>{a}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <section className="escalate flex flex-col gap-3" aria-labelledby="esc-h">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-lg bg-red-500/15 text-red-400">
              <ShieldAlert size={22} aria-hidden="true" />
            </span>
            <h2 id="esc-h" className="text-base font-semibold flex-1">
              Medical Escalation Criteria
            </h2>
            <span className="st crit">TRIGGERED</span>
          </div>
          <div className="rounded-[10px] border border-red-500/40 bg-[#0B0F19] p-3">
            <div className="eyebrow">Rules Triggered</div>
            <p className="text-sm mt-1 text-red-100">Persistent abnormal HRV ({'>'}72h) + Elevated resting HR</p>
          </div>
          <button type="button" className="btn btn-crit w-full mt-auto" onClick={() => setConfirming(true)} disabled={escalated}>
            <Siren size={20} aria-hidden="true" />
            {escalated ? 'Consultation Requested' : 'Initiate Ground Medical Team Consultation'}
          </button>
          <a href="tel:+18005550199" className="flex items-center justify-center gap-2 min-h-12 text-sm text-red-200 underline underline-offset-4 hover:text-red-100">
            <Phone size={16} aria-hidden="true" />
            Protocol Hotline · Flight Surgeon Loop A
          </a>
        </section>
      </div>

      {confirming && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="conf-h">
          <div className="sheet !border-red-500/60">
            <div className="sheet-h">
              <Siren size={22} className="text-red-400" aria-hidden="true" />
              <h3 id="conf-h">Initiate Ground Medical Consultation?</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              This opens a priority channel to the Flight Surgeon and shares the current assessment, last 7 days of telemetry, and triggered escalation rules.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn" onClick={() => setConfirming(false)} autoFocus>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-crit !min-h-12"
                onClick={() => {
                  setConfirming(false)
                  setEscalated(true)
                  notify('Ground medical consultation requested · Flight Surgeon notified', 'crit')
                }}
              >
                Confirm &amp; Notify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
