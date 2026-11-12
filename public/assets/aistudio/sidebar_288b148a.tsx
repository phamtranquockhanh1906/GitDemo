'use client'

import { ChartLine, LayoutDashboard, MonitorDot, Orbit, Rocket, Siren, Sparkles, UserRound, type LucideIcon } from 'lucide-react'

export type ModuleId = 'dashboard' | 'monitoring' | 'analytics' | 'ai' | 'missions' | 'profile'

export const MODULES: { id: ModuleId; label: string; icon: LucideIcon; badge?: number }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Monitoring', icon: MonitorDot },
  { id: 'analytics', label: 'Analytics', icon: ChartLine },
  { id: 'ai', label: 'AI Assessment', icon: Sparkles, badge: 1 },
  { id: 'missions', label: 'Missions', icon: Rocket },
  { id: 'profile', label: 'Profile', icon: UserRound },
]

type SidebarProps = {
  active: ModuleId
  onSelect: (id: ModuleId) => void
  onEmergency: () => void
}

export function Sidebar({ active, onSelect, onEmergency }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sb-logo">
        <span className="logo-mark" aria-hidden="true">
          <Orbit size={22} />
        </span>
        <span>ASTROCARE</span>
      </div>
      <nav className="sb-nav" aria-label="Modules">
        {MODULES.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            className="sb-item"
            aria-current={active === id ? 'page' : undefined}
            onClick={() => onSelect(id)}
          >
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
            {badge ? (
              <span className="sb-badge" aria-label={`${badge} warning`}>
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      <button type="button" className="sb-sos" onClick={onEmergency} aria-label="Emergency: contact flight surgeon">
        <Siren size={20} aria-hidden="true" />
        SOS
      </button>
    </aside>
  )
}
