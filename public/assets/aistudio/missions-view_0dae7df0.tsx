'use client'

import { ArrowRight, Bike, Brain, CircleCheck, Flame, HeartPulse, Lock, Medal, Moon, Rocket, Satellite, Star, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { Notify } from '../app-shell'
import { PageHeader, Panel } from '../ui'

type Mission = { id: string; title: string; pts: number; icon: LucideIcon; done: boolean }

const INITIAL: Mission[] = [
  { id: 'telemetry', title: 'Morning Health Telemetry Check', pts: 10, icon: HeartPulse, done: true },
  { id: 'mood', title: 'Log Daily Mood & Stress Self-Assessment', pts: 10, icon: Brain, done: true },
  { id: 'cycle', title: 'Complete Scheduled Physical Countermeasure (Cycle Ergometer)', pts: 20, icon: Bike, done: true },
  { id: 'sleep', title: 'Log Sleep & Rest Schedule', pts: 15, icon: Moon, done: false },
]

const BADGES: { name: string; desc: string; icon: LucideIcon; unlocked: boolean; progress?: number }[] = [
  { name: 'Health Monitoring Champion', desc: 'Logged 14 consecutive days', icon: Satellite, unlocked: true },
  { name: 'Sleep Routine Keeper', desc: 'Met target bedtime 5 days in a row', icon: Moon, unlocked: true },
  { name: 'Consistency Pioneer', desc: '30-day streak badge', icon: Rocket, unlocked: false, progress: 60 },
  { name: 'Mission Wellness Achievement', desc: 'Complete all phase wellness goals', icon: Medal, unlocked: false },
]

const BASE_HP = 420

function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const pct = value / total
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true" className="flex-none">
      <circle cx="42" cy="42" r={r} fill="none" stroke="#1E293B" strokeWidth="8" />
      <circle cx="42" cy="42" r={r} fill="none" stroke={pct === 1 ? '#10B981' : '#0EA5E9'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 42 42)" className="transition-all duration-500" />
      <text x="42" y="47" textAnchor="middle" fill="#F1F5F9" fontSize="16" fontWeight="700" fontFamily="var(--mono)">
        {`${Math.round(pct * 100)}%`}
      </text>
    </svg>
  )
}

function HexBadge({ badge }: { badge: (typeof BADGES)[number] }) {
  const Icon = badge.unlocked ? badge.icon : Lock
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <div className={`tile items-center text-center !gap-2 ${badge.unlocked ? '' : 'opacity-90'}`}>
      <div className="relative grid place-items-center w-24 h-24">
        {badge.progress !== undefined && (
          <svg className="absolute inset-0" viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r={r + 4} fill="none" stroke="#1E293B" strokeWidth="4" />
            <circle cx="48" cy="48" r={r + 4} fill="none" stroke="#6366F1" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${((2 * Math.PI * (r + 4)) * badge.progress) / 100} ${c * 2}`} transform="rotate(-90 48 48)" />
          </svg>
        )}
        <div className="hex !w-[64px] !h-[72px]" style={{ background: badge.unlocked ? 'linear-gradient(160deg,#0EA5E9,#6366F1)' : '#334155' }}>
          <div className="hex-inner !w-[58px] !h-[66px]" style={{ background: badge.unlocked ? '#0F1A33' : '#131C2E' }}>
            <Icon size={26} className={badge.unlocked ? 'text-sky-300' : 'text-slate-500'} aria-hidden="true" />
          </div>
        </div>
      </div>
      <span className="text-sm font-semibold leading-tight">{badge.name}</span>
      <span className="text-xs text-slate-400 leading-snug">{badge.desc}</span>
      <span className={`st mt-auto ${badge.unlocked ? 'ok' : badge.progress ? 'info' : 'neu'}`}>{badge.unlocked ? 'UNLOCKED' : badge.progress ? `LOCKED · ${badge.progress}%` : 'LOCKED'}</span>
    </div>
  )
}

export function MissionsView({ notify }: { notify: Notify }) {
  const [missions, setMissions] = useState(INITIAL)
  const done = missions.filter((m) => m.done).length
  const hp = BASE_HP + missions.filter((m) => m.done && !INITIAL.find((i) => i.id === m.id)?.done).reduce((s, m) => s + m.pts, 0)

  const toggle = (m: Mission) => {
    setMissions((all) => all.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)))
    if (!m.done) notify(`Mission complete · +${m.pts} HP`)
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Module 05 · Wellness Engagement" title="Missions & Rewards" />

      <div className="grid grid-cols-3 gap-3">
        <div className="tile !flex-row items-center gap-4">
          <ProgressRing value={done} total={missions.length} />
          <div>
            <div className="k">Daily Mission Progress</div>
            <div className="val mt-1">
              {done}/{missions.length}
              <small>Completed</small>
            </div>
          </div>
        </div>
        <div className="tile glow-hp !flex-row items-center gap-4">
          <span className="grid place-items-center w-14 h-14 rounded-xl bg-indigo-500/20 border border-indigo-400/50 text-indigo-200 flex-none">
            <Star size={26} fill="currentColor" aria-hidden="true" />
          </span>
          <div>
            <div className="k">Total Health Points</div>
            <div className="val mt-1 text-indigo-100">
              {hp}
              <small>HP</small>
            </div>
          </div>
        </div>
        <div className="tile !flex-row items-center gap-4">
          <span className="grid place-items-center w-14 h-14 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-400 flex-none">
            <Flame size={26} aria-hidden="true" />
          </span>
          <div>
            <div className="k">Consistency Streak</div>
            <div className="val mt-1">
              7-Day<small>Streak</small>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 -mt-1">Points reward adherence and routine tracking, not physiological metrics.</p>

      <Panel title="Daily Health Missions" aside={<span className="ml-auto font-mono text-xs text-slate-400">Resets 00:00 UTC</span>}>
        <ul className="grid grid-cols-2 gap-2">
          {missions.map((m) => {
            const Icon = m.icon
            return (
              <li key={m.id} className={`row-item !min-h-[84px] ${m.done ? '!border-emerald-500/40' : '!border-sky-500/50'}`}>
                <span className={`mi !w-11 !h-11 !rounded-xl ${m.done ? 'ok' : ''}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="t leading-snug">{m.title}</span>
                  <span className="pill indigo self-start font-mono">+{m.pts} pts</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(m)}
                  aria-pressed={m.done}
                  aria-label={m.done ? `${m.title}: completed. Tap to undo` : `Start mission: ${m.title}`}
                  className={`btn !min-h-14 flex-none ${m.done ? 'btn-ok' : 'btn-primary'}`}
                >
                  {m.done ? (
                    <>
                      <CircleCheck size={18} aria-hidden="true" />
                      Completed
                    </>
                  ) : (
                    <>
                      Start Mission
                      <ArrowRight size={18} aria-hidden="true" />
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title="Badges & Achievements" aside={<span className="ml-auto font-mono text-xs text-slate-400">2 / 4 unlocked</span>}>
        <div className="grid grid-cols-4 gap-3">
          {BADGES.map((b) => (
            <HexBadge key={b.name} badge={b} />
          ))}
        </div>
      </Panel>

      <div className="banner info items-center">
        <Moon size={18} className="flex-none" aria-hidden="true" />
        <span>Missed a check-in? Rest comes first. Streaks pause gracefully during emergency operations.</span>
      </div>
    </div>
  )
}
