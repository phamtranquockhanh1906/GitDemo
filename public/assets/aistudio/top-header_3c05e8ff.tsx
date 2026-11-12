'use client'

import { Bell, Cloud, Cpu, Satellite } from 'lucide-react'
import { useEffect, useState } from 'react'

const MISSION_OFFSET_MS = ((23 * 24 + 14) * 3600 + 32 * 60) * 1000

function formatMet(ms: number) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${String(d).padStart(3, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function useUtcClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function TopHeader({ now }: { now: Date | null }) {
  const [start] = useState(() => Date.now() - MISSION_OFFSET_MS)
  const utc = now ? now.toISOString().slice(11, 19) : '--:--:--'
  const met = now ? formatMet(now.getTime() - start) : '---:--:--'

  return (
    <header className="hdr">
      <div className="chip">
        <span className="avatar" aria-hidden="true">
          AV
        </span>
        <div>
          <div className="id mono">ASTRO-001</div>
          <div className="name">Cmdr. Alex Vance</div>
        </div>
      </div>
      <div className="mission">
        <Satellite size={14} className="text-[var(--indigo)]" aria-hidden="true" />
        ISS Research Mission · <span className="mono">Day 24</span>
      </div>

      <div className="clock">
        <div className="t mono">{utc}</div>
        <div className="s">
          UTC · MET <span className="mono">{met}</span>
        </div>
      </div>

      <div className="hdr-right">
        <div className="sys-group" aria-label="System connectivity (not health status)">
          <span className="tag">SYS</span>
          <span className="sys">
            <Cpu size={14} className="text-[var(--text-3)]" aria-hidden="true" />
            EDGE: <b>ONLINE</b>
            <span className="dot" aria-hidden="true" />
          </span>
          <span className="sys">
            <Cloud size={14} className="text-[var(--text-3)]" aria-hidden="true" />
            CLOUD: <b>CONNECTED</b>
            <span className="dot" aria-hidden="true" />
          </span>
        </div>
        <button type="button" className="icon-btn" aria-label="Notifications, 3 unread">
          <Bell size={20} />
          <span className="badge-count">3</span>
        </button>
      </div>
    </header>
  )
}
