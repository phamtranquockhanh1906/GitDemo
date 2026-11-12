import { ChartLine, LayoutDashboard, MonitorDot, Orbit, Rocket, Siren, Sparkles, UserRound, type LucideIcon } from 'lucide-react'
import type { Lang } from '@/lib/astro-data'

export type ModuleId = 'dashboard' | 'monitoring' | 'analytics' | 'ai' | 'missions' | 'profile'

export const MODULES: { id: ModuleId; labelEn: string; labelVi: string; icon: LucideIcon }[] = [
  { id: 'dashboard', labelEn: 'Dashboard', labelVi: 'Bảng điều khiển', icon: LayoutDashboard },
  { id: 'monitoring', labelEn: 'Monitoring', labelVi: 'Nhập chỉ số', icon: MonitorDot },
  { id: 'analytics', labelEn: 'Analytics', labelVi: 'Phân tích xu hướng', icon: ChartLine },
  { id: 'ai', labelEn: 'AI Assessment', labelVi: 'Chẩn đoán AI', icon: Sparkles },
  { id: 'missions', labelEn: 'Missions', labelVi: 'Nhiệm vụ & Điểm', icon: Rocket },
  { id: 'profile', labelEn: 'Profile', labelVi: 'Hồ sơ phi hành gia', icon: UserRound },
]

type SidebarProps = {
  active: ModuleId
  lang?: Lang
  anomalyCount?: number
  onSelect: (id: ModuleId) => void
  onEmergency: () => void
}

export function Sidebar({
  active,
  lang = 'EN',
  anomalyCount = 0,
  onSelect,
  onEmergency,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sb-logo">
        <span className="logo-mark" aria-hidden="true">
          <Orbit size={22} />
        </span>
        <span>ASTROCARE</span>
      </div>
      <nav className="sb-nav" aria-label={lang === 'EN' ? 'Modules' : 'Danh mục hệ thống'}>
        {MODULES.map(({ id, labelEn, labelVi, icon: Icon }) => {
          const badge = id === 'ai' && anomalyCount > 0 ? anomalyCount : undefined
          return (
            <button
              key={id}
              type="button"
              className="sb-item"
              aria-current={active === id ? 'page' : undefined}
              onClick={() => onSelect(id)}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{lang === 'EN' ? labelEn : labelVi}</span>
              {badge ? (
                <span className="sb-badge" aria-label={`${badge} warning`}>
                  {badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>
      <button
        type="button"
        className="sb-sos"
        onClick={onEmergency}
        aria-label={
          lang === 'EN'
            ? 'Emergency: contact flight surgeon'
            : 'Khẩn cấp: Liên hệ bác sĩ phẫu thuật vũ trụ'
        }
      >
        <Siren size={20} aria-hidden="true" />
        SOS
      </button>
    </aside>
  )
}
