import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  Cloud,
  Cpu,
  Globe,
  Radio,
  Satellite,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Lang, UnitPrefs, Vital } from '@/lib/astro-data'
import type { ModuleId } from './sidebar'

const MISSION_OFFSET_MS = ((23 * 24 + 14) * 3600 + 32 * 60) * 1000

type SpaceEnvId = 'iss' | 'artemis' | 'mars' | 'eva'

type SpaceEnvOption = {
  id: SpaceEnvId
  labelEn: string
  labelVi: string
  dayEn: string
  dayVi: string
  detailEn: string
  detailVi: string
  delayBadgeEn: string
  delayBadgeVi: string
  cloudStatusEn: string
  cloudStatusVi: string
  tone: 'emerald' | 'sky' | 'amber' | 'rose'
}

const SPACE_ENVIRONMENTS: SpaceEnvOption[] = [
  {
    id: 'iss',
    labelEn: 'ISS Research Mission',
    labelVi: 'Sứ mệnh Nghiên cứu ISS',
    dayEn: 'Day 24',
    dayVi: 'Ngày 24',
    detailEn: 'Comms Delay: Real-time · Gravity: 0G Microgravity',
    detailVi: 'Trễ tín hiệu: Real-time · Trọng lực: 0G Vi trọng lực',
    delayBadgeEn: 'DELAY: REAL-TIME',
    delayBadgeVi: 'TRỄ: REAL-TIME',
    cloudStatusEn: 'CONNECTED',
    cloudStatusVi: 'ĐÃ KẾT NỐI',
    tone: 'emerald',
  },
  {
    id: 'artemis',
    labelEn: 'Artemis Lunar Base',
    labelVi: 'Căn cứ Mặt Trăng Artemis',
    dayEn: 'Day 12',
    dayVi: 'Ngày 12',
    detailEn: 'Gravity: 0.16G · Priority: Lunar Dust & Physical Load',
    detailVi: 'Trọng lực: 0.16G · Ưu tiên: Bụi Mặt Trăng & Thể lực',
    delayBadgeEn: 'DELAY: 1.3s LUNAR',
    delayBadgeVi: 'TRỄ TĐ: 1.3s',
    cloudStatusEn: 'DSN RELAY',
    cloudStatusVi: 'TRẠM DSN',
    tone: 'sky',
  },
  {
    id: 'mars',
    labelEn: 'Mars Transit Deep Space',
    labelVi: 'Hành trình Sao Hỏa Deep Space',
    dayEn: 'Day 140',
    dayVi: 'Ngày 140',
    detailEn: 'Comms Delay: 14m 20s · Mode: Autonomous Offline AI',
    detailVi: 'Trễ tín hiệu: 14m 20s · Chế độ: AI Tự hành Offline',
    delayBadgeEn: 'DELAY: 14m 20s',
    delayBadgeVi: 'TRỄ TĐ: 14m 20s',
    cloudStatusEn: 'AUTONOMOUS AI',
    cloudStatusVi: 'AI TỰ HÀNH',
    tone: 'amber',
  },
  {
    id: 'eva',
    labelEn: 'EVA Spacewalk / Rover',
    labelVi: 'Đi bộ Không gian EVA / Rover',
    dayEn: '02:15h',
    dayVi: '02:15h',
    detailEn: 'Priority: SpO₂, Thermal Regulation & Radiation',
    detailVi: 'Ưu tiên: SpO2, Nhiệt độ & Bức xạ',
    delayBadgeEn: 'DELAY: 2.4s EVA',
    delayBadgeVi: 'TRỄ TĐ: 2.4s EVA',
    cloudStatusEn: 'SUIT TELEMETRY',
    cloudStatusVi: 'ĐỒ BẢO HỘ EVA',
    tone: 'rose',
  },
]

function formatMet(ms: number) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${String(d).padStart(3, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatUtcClock(now: Date | null, clockFormat: '24h' | '12h' = '24h') {
  if (!now) return '--:--:--'
  if (clockFormat === '24h') {
    return now.toISOString().slice(11, 19)
  }
  const h24 = now.getUTCHours()
  const m = String(now.getUTCMinutes()).padStart(2, '0')
  const s = String(now.getUTCSeconds()).padStart(2, '0')
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 || 12
  return `${String(h12).padStart(2, '0')}:${m}:${s} ${suffix}`
}

export function useUtcClock() {
  const [now, setNow] = useState<Date | null>(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function TopHeader({
  now,
  lang = 'EN',
  vitals = [],
  unitPrefs,
  handsFreeSlot,
  onLangChange,
  onNavigate,
}: {
  now: Date | null
  lang?: Lang
  vitals?: Vital[]
  unitPrefs?: UnitPrefs
  handsFreeSlot?: React.ReactNode
  onLangChange?: (lang: Lang) => void
  onNavigate?: (id: ModuleId) => void
}) {
  const [start] = useState(() => Date.now() - MISSION_OFFSET_MS)
  const [openAlerts, setOpenAlerts] = useState(false)
  const [openEnvMenu, setOpenEnvMenu] = useState(false)
  const [selectedEnvId, setSelectedEnvId] = useState<SpaceEnvId>('iss')
  const [readIds, setReadIds] = useState<string[]>([])

  const activeEnv =
    SPACE_ENVIRONMENTS.find((e) => e.id === selectedEnvId) ?? SPACE_ENVIRONMENTS[0]

  const utc = formatUtcClock(now, unitPrefs?.clockFormat ?? '24h')
  const met = now ? formatMet(now.getTime() - start) : '---:--:--'

  // Build live notifications dynamically from current vitals state
  const dynamicNotices = vitals
    .filter((v) => v.status !== 'ok')
    .map((v) => ({
      id: `vital-${v.id}-${v.value}`,
      titleEn: `${v.title} Alert (${v.value} ${v.unit})`,
      titleVi: `Cảnh báo ${v.viTitle} (${v.value} ${v.unit})`,
      detailEn: `Outside personal baseline (${v.baseline} ${v.unit}). Tap to inspect in AI Health Assessment.`,
      detailVi: `Lệch khỏi chuẩn cá nhân (${v.baseline} ${v.unit}). Chạm để mở Chẩn đoán AI.`,
      time: v.updated,
      module: 'ai' as ModuleId,
      tone: 'warn' as const,
    }))

  const allNotices = [
    ...dynamicNotices,
    {
      id: 'mission-reminder',
      titleEn: 'Daily Wellness Missions Active',
      titleVi: 'Nhiệm vụ Sức khỏe Hàng ngày',
      detailEn: 'Complete scheduled telemetry check-ins to earn +HP and maintain your streak.',
      detailVi: 'Hoàn thành kiểm tra sinh trắc học định kỳ để nhận +HP và duy trì chuỗi ngày.',
      time: lang === 'EN' ? 'Today' : 'Hôm nay',
      module: 'missions' as ModuleId,
      tone: 'info' as const,
    },
  ]

  const unreadCount = allNotices.filter((n) => !readIds.includes(n.id)).length

  const markAllRead = () => {
    setReadIds(allNotices.map((n) => n.id))
  }

  const delayBadgeColors =
    activeEnv.tone === 'amber'
      ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
      : activeEnv.tone === 'rose'
        ? 'bg-rose-500/20 border-rose-400/60 text-rose-300'
        : activeEnv.tone === 'sky'
          ? 'bg-sky-500/20 border-sky-400/60 text-sky-300'
          : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'

  const compactNetLabelVi =
    activeEnv.id === 'iss'
      ? 'Trực tuyến · Real-time'
      : `Trực tuyến · ${activeEnv.delayBadgeVi.replace('TRỄ TĐ: ', '').replace('TRỄ: ', '')}`
  const compactNetLabelEn =
    activeEnv.id === 'iss'
      ? 'Online · Real-time'
      : `Online · ${activeEnv.delayBadgeEn.replace('DELAY: ', '')}`

  const tooltipDetailText =
    lang === 'EN'
      ? `EDGE: ONLINE · CLOUD: ${activeEnv.cloudStatusEn} · ${activeEnv.detailEn}`
      : `EDGE: TRỰC TUYẾN · CLOUD: ${activeEnv.cloudStatusVi} · ${activeEnv.detailVi}`

  return (
    <header className="hdr">
      <button
        type="button"
        className="chip hover:border-sky-500/50 transition-colors text-left"
        onClick={() => onNavigate?.('profile')}
        aria-label="Astronaut profile: Cmdr. Alex Vance"
      >
        <span className="avatar" aria-hidden="true">
          AV
        </span>
        <div className="name font-semibold text-slate-100 whitespace-nowrap">Cmdr. Alex Vance</div>
      </button>

      {/* Interactive Space Environment Context Switcher */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpenEnvMenu((prev) => !prev)
            setOpenAlerts(false)
          }}
          aria-expanded={openEnvMenu}
          aria-haspopup="listbox"
          aria-label={
            lang === 'EN'
              ? `Space Environment: ${activeEnv.labelEn} · ${activeEnv.dayEn}`
              : `Môi trường Vũ trụ: ${activeEnv.labelVi} · ${activeEnv.dayVi}`
          }
          className="mission hover:border-sky-400/70 hover:bg-[#19253d] transition-all cursor-pointer"
        >
          <Satellite size={14} className="text-[var(--indigo)] flex-none" aria-hidden="true" />
          <span className="truncate">
            {lang === 'EN' ? `${activeEnv.labelEn} ·` : `${activeEnv.labelVi} ·`}{' '}
            <span className="mono">{lang === 'EN' ? activeEnv.dayEn : activeEnv.dayVi}</span>
          </span>
          <ChevronDown
            size={13}
            className={`text-slate-400 transition-transform duration-200 ${
              openEnvMenu ? 'rotate-180 text-sky-300' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {openEnvMenu && (
          <div
            role="listbox"
            aria-label={lang === 'EN' ? 'Select Space Mission Environment' : 'Chọn Môi trường Sứ mệnh Vũ trụ'}
            className="absolute left-0 top-13 w-[380px] rounded-xl border border-sky-500/50 bg-[#0e1628]/98 backdrop-blur-xl p-2.5 shadow-[0_20px_50px_rgba(2,8,23,0.95)] z-50 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
                {lang === 'EN'
                  ? 'NASA ENVIRONMENT CONTEXT SWITCHER'
                  : 'BỘ CHỌN MÔI TRƯỜNG VŨ TRỤ NASA'}
              </span>
              <button
                type="button"
                onClick={() => setOpenEnvMenu(false)}
                className="text-slate-400 hover:text-slate-100 p-0.5 rounded"
                aria-label="Close environment switcher"
              >
                <X size={13} />
              </button>
            </div>

            {SPACE_ENVIRONMENTS.map((env) => {
              const isSelected = env.id === selectedEnvId
              return (
                <button
                  key={env.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelectedEnvId(env.id)
                    setOpenEnvMenu(false)
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-sky-500/20 border-sky-400 text-slate-100'
                      : 'bg-[#131d33]/90 border-slate-800 hover:border-slate-600 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span>{lang === 'EN' ? env.labelEn : env.labelVi}</span>
                      <span className="font-mono text-sky-300">
                        · {lang === 'EN' ? env.dayEn : env.dayVi}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-slate-300">
                        {lang === 'EN' ? env.delayBadgeEn : env.delayBadgeVi}
                      </span>
                      {isSelected && <Check size={13} className="text-sky-400" />}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {lang === 'EN' ? env.detailEn : env.detailVi}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="clock">
        <div className="t mono">{utc}</div>
        <div className="s">
          UTC · MET <span className="mono">{met}</span>
        </div>
      </div>

      <div className="hdr-right">
        {/* Single Consolidated Network Status Badge with Hover Tooltip */}
        <div className="relative group">
          <div
            data-testid="consolidated-network-badge"
            title={tooltipDetailText}
            aria-label={tooltipDetailText}
            className={`inline-flex items-center gap-1.5 h-[34px] px-3 rounded-full border text-xs font-mono font-semibold whitespace-nowrap cursor-default transition-colors ${delayBadgeColors}`}
          >
            <span aria-hidden="true">🟢</span>
            <span>{lang === 'EN' ? compactNetLabelEn : compactNetLabelVi}</span>
          </div>

          {/* Rich Hover Tooltip for Edge / Cloud / Comms Delay Details */}
          <div
            role="tooltip"
            className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute right-0 top-11 w-72 rounded-xl border border-sky-500/45 bg-[#0c1425]/98 backdrop-blur-xl p-2.5 shadow-2xl z-50 text-[11px] font-mono text-slate-200 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-[10px] text-sky-400 font-bold uppercase">
              <span>{lang === 'EN' ? 'TELEMETRY LINK STATUS' : 'CHI TIẾT KẾT NỐI TRẠM'}</span>
              <span>{lang === 'EN' ? activeEnv.delayBadgeEn : activeEnv.delayBadgeVi}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Cpu size={12} className="text-emerald-400" aria-hidden="true" />
                EDGE AI:
              </span>
              <span className="text-emerald-300 font-semibold">
                {lang === 'EN' ? 'ONLINE (LOCAL DSP)' : 'TRỰC TUYẾN (LOCAL DSP)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Cloud size={12} className="text-sky-400" aria-hidden="true" />
                CLOUD SYNC:
              </span>
              <span className="text-sky-300 font-semibold">
                {lang === 'EN' ? activeEnv.cloudStatusEn : activeEnv.cloudStatusVi}
              </span>
            </div>
            <div className="flex items-center justify-between pt-0.5 border-t border-slate-800/80 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Radio size={11} className="text-emerald-400" aria-hidden="true" />
                {lang === 'EN' ? activeEnv.detailEn : activeEnv.detailVi}
              </span>
            </div>
          </div>
        </div>

        {/* Headless Root-Level Global Hands-Free Voice Controller */}
        {handsFreeSlot}

        {/* Language Toggle EN | VI */}
        <div className="tabs" role="group" aria-label="Language switch">
          <button
            type="button"
            aria-pressed={lang === 'EN'}
            aria-selected={lang === 'EN'}
            onClick={() => onLangChange?.('EN')}
            className="flex items-center gap-1 !min-w-[44px] !h-8 !px-2.5"
          >
            <Globe size={12} aria-hidden="true" />
            EN
          </button>
          <button
            type="button"
            aria-pressed={lang === 'VI'}
            aria-selected={lang === 'VI'}
            onClick={() => onLangChange?.('VI')}
            className="!min-w-[38px] !h-8 !px-2.5"
          >
            VI
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            className="icon-btn hover:border-slate-500 transition-colors"
            aria-label={`Notifications, ${unreadCount} unread`}
            aria-expanded={openAlerts}
            onClick={() => {
              setOpenAlerts((v) => !v)
              setOpenEnvMenu(false)
            }}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="badge-count">{unreadCount}</span>}
          </button>

          {openAlerts && (
            <div
              role="dialog"
              aria-label="Crew telemetry notifications"
              className="absolute right-0 top-14 w-96 rounded-xl border border-slate-600 bg-[#131c2e] p-3 shadow-2xl z-50 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {lang === 'EN'
                    ? `Telemetry Notifications (${unreadCount} unread)`
                    : `Thông báo Sinh trắc học (${unreadCount} chưa đọc)`}
                </span>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 px-2 py-1 rounded"
                    >
                      <CheckCheck size={14} aria-hidden="true" />
                      {lang === 'EN' ? 'Mark read' : 'Đã đọc hết'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenAlerts(false)}
                    aria-label="Close notifications"
                    className="p-1 text-slate-400 hover:text-slate-200 rounded"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
              <ul className="flex flex-col gap-1.5">
                {allNotices.map((n) => {
                  const isRead = readIds.includes(n.id)
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setReadIds((prev) => (prev.includes(n.id) ? prev : [...prev, n.id]))
                          setOpenAlerts(false)
                          onNavigate?.(n.module)
                        }}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors flex flex-col gap-1 ${
                          isRead
                            ? 'border-slate-800 bg-slate-900/50 opacity-75'
                            : n.tone === 'warn'
                              ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15'
                              : 'border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/15'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-100">
                            {lang === 'EN' ? n.titleEn : n.titleVi}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">{n.time}</span>
                        </div>
                        <span className="text-xs text-slate-300 leading-snug">
                          {lang === 'EN' ? n.detailEn : n.detailVi}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
