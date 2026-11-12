import {
  ArrowRight,
  Bike,
  Brain,
  CircleCheck,
  Flame,
  HeartPulse,
  Lock,
  Medal,
  Moon,
  Rocket,
  Satellite,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { Lang, Vital } from '@/lib/astro-data'
import type { Notify } from '../app-shell'
import { PageHeader, Panel } from '../ui'

export type MissionItem = {
  id: string
  titleEn: string
  titleVi: string
  pts: number
  icon: LucideIcon
  done: boolean
}

export const INITIAL_MISSIONS: MissionItem[] = [
  {
    id: 'telemetry',
    titleEn: 'Morning Health Telemetry Check',
    titleVi: 'Kiểm tra Sinh trắc học Buổi sáng',
    pts: 10,
    icon: HeartPulse,
    done: true,
  },
  {
    id: 'mood',
    titleEn: 'Log Daily Mood & Stress Self-Assessment',
    titleVi: 'Đánh giá Tâm trạng & Mức căng thẳng Hàng ngày',
    pts: 10,
    icon: Brain,
    done: true,
  },
  {
    id: 'cycle',
    titleEn: 'Complete Scheduled Physical Countermeasure (Cycle Ergometer)',
    titleVi: 'Hoàn thành Bài tập Thể lực Định kỳ (Xe đạp CEVIS)',
    pts: 20,
    icon: Bike,
    done: true,
  },
  {
    id: 'sleep',
    titleEn: 'Log Sleep & Rest Schedule (Target ≥ 7.0h)',
    titleVi: 'Ghi nhận Lịch Ngủ & Nghỉ ngơi (Mục tiêu ≥ 7.0h)',
    pts: 15,
    icon: Moon,
    done: false,
  },
]

const BADGES: {
  nameEn: string
  nameVi: string
  descEn: string
  descVi: string
  icon: LucideIcon
  unlocked: boolean
  progress?: number
}[] = [
  {
    nameEn: 'Health Monitoring Champion',
    nameVi: 'Chuyên gia Theo dõi Sinh trắc',
    descEn: 'Logged 14 consecutive days',
    descVi: 'Ghi nhận 14 ngày liên tiếp',
    icon: Satellite,
    unlocked: true,
  },
  {
    nameEn: 'Sleep Routine Keeper',
    nameVi: 'Duy trì Nhịp Sinh học',
    descEn: 'Met target bedtime 5 days in a row',
    descVi: 'Đúng giờ ngủ mục tiêu 5 ngày liền',
    icon: Moon,
    unlocked: true,
  },
  {
    nameEn: 'Consistency Pioneer',
    nameVi: 'Tiên phong Bền bỉ',
    descEn: '30-day streak badge',
    descVi: 'Chuỗi 30 ngày tuân thủ liên tục',
    icon: Rocket,
    unlocked: false,
    progress: 60,
  },
  {
    nameEn: 'Mission Wellness Achievement',
    nameVi: 'Thành tựu Sức khỏe Sứ mệnh',
    descEn: 'Complete all phase wellness goals',
    descVi: 'Hoàn thành mọi mục tiêu sức khỏe',
    icon: Medal,
    unlocked: false,
  },
]

const BASE_HP = 420

function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const pct = value / total
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true" className="flex-none">
      <circle cx="42" cy="42" r={r} fill="none" stroke="#1E293B" strokeWidth="8" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke={pct === 1 ? '#10B981' : '#0EA5E9'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 42 42)"
        className="transition-all duration-500"
      />
      <text x="42" y="47" textAnchor="middle" fill="#F1F5F9" fontSize="16" fontWeight="700" fontFamily="var(--mono)">
        {`${Math.round(pct * 100)}%`}
      </text>
    </svg>
  )
}

function HexBadge({ badge, lang }: { badge: (typeof BADGES)[number]; lang: Lang }) {
  const Icon = badge.unlocked ? badge.icon : Lock
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <div className={`tile items-center text-center !gap-2 ${badge.unlocked ? '' : 'opacity-90'}`}>
      <div className="relative grid place-items-center w-24 h-24">
        {badge.progress !== undefined && (
          <svg className="absolute inset-0" viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r={r + 4} fill="none" stroke="#1E293B" strokeWidth="4" />
            <circle
              cx="48"
              cy="48"
              r={r + 4}
              fill="none"
              stroke="#6366F1"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${((2 * Math.PI * (r + 4)) * badge.progress) / 100} ${c * 2}`}
              transform="rotate(-90 48 48)"
            />
          </svg>
        )}
        <div
          className="hex !w-[64px] !h-[72px]"
          style={{ background: badge.unlocked ? 'linear-gradient(160deg,#0EA5E9,#6366F1)' : '#334155' }}
        >
          <div
            className="hex-inner !w-[58px] !h-[66px]"
            style={{ background: badge.unlocked ? '#0F1A33' : '#131C2E' }}
          >
            <Icon size={26} className={badge.unlocked ? 'text-sky-300' : 'text-slate-500'} aria-hidden="true" />
          </div>
        </div>
      </div>
      <span className="text-sm font-semibold leading-tight">
        {lang === 'EN' ? badge.nameEn : badge.nameVi}
      </span>
      <span className="text-xs text-slate-400 leading-snug">
        {lang === 'EN' ? badge.descEn : badge.descVi}
      </span>
      <span className={`st mt-auto ${badge.unlocked ? 'ok' : badge.progress ? 'info' : 'neu'}`}>
        {badge.unlocked
          ? lang === 'EN'
            ? 'UNLOCKED'
            : 'ĐÃ MỞ KHÓA'
          : badge.progress
            ? `${lang === 'EN' ? 'LOCKED' : 'ĐANG MỞ'} · ${badge.progress}%`
            : lang === 'EN'
              ? 'LOCKED'
              : 'CHƯA MỞ'}
      </span>
    </div>
  )
}

export function MissionsView({
  lang = 'EN',
  vitals = [],
  completedIds: externalCompletedIds,
  onToggleMissionId,
  notify,
}: {
  lang?: Lang
  vitals?: Vital[]
  completedIds?: string[]
  onToggleMissionId?: (id: string) => void
  notify: Notify
}) {
  const [localDoneIds, setLocalDoneIds] = useState<string[]>(['telemetry', 'mood', 'cycle'])
  const sleepVital = vitals.find((v) => v.id === 'sleep')
  const sleepMetTarget = sleepVital ? Number(sleepVital.value) >= 7.0 : false

  const activeDoneIds = externalCompletedIds ?? localDoneIds
  const effectiveDoneIds =
    sleepMetTarget && !activeDoneIds.includes('sleep')
      ? [...activeDoneIds, 'sleep']
      : activeDoneIds

  const missions = INITIAL_MISSIONS.map((m) => ({
    ...m,
    done: effectiveDoneIds.includes(m.id),
  }))

  const done = missions.filter((m) => m.done).length
  const hp =
    BASE_HP +
    missions
      .filter((m) => m.done && !INITIAL_MISSIONS.find((i) => i.id === m.id)?.done)
      .reduce((s, m) => s + m.pts, 0)

  const toggle = (m: typeof missions[number]) => {
    if (onToggleMissionId) {
      onToggleMissionId(m.id)
    } else {
      setLocalDoneIds((prev) =>
        prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id],
      )
    }
    if (!m.done) {
      notify(
        lang === 'EN'
          ? `Mission complete · +${m.pts} HP`
          : `Hoàn thành nhiệm vụ · +${m.pts} HP`,
      )
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={lang === 'EN' ? 'Module 05 · Wellness Engagement' : 'Phân hệ 05 · Duy trì Sức khỏe'}
        title={lang === 'EN' ? 'Missions & Rewards' : 'Nhiệm vụ & Điểm thưởng Sức khỏe'}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="tile !flex-row items-center gap-4">
          <ProgressRing value={done} total={missions.length} />
          <div>
            <div className="k">{lang === 'EN' ? 'Daily Mission Progress' : 'Tiến độ Nhiệm vụ Ngày'}</div>
            <div className="val mt-1">
              {done}/{missions.length}
              <small>{lang === 'EN' ? 'Completed' : 'Hoàn thành'}</small>
            </div>
          </div>
        </div>
        <div className="tile glow-hp !flex-row items-center gap-4">
          <span className="grid place-items-center w-14 h-14 rounded-xl bg-indigo-500/20 border border-indigo-400/50 text-indigo-200 flex-none">
            <Star size={26} fill="currentColor" aria-hidden="true" />
          </span>
          <div>
            <div className="k">{lang === 'EN' ? 'Total Health Points' : 'Tổng Điểm Sức khỏe'}</div>
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
            <div className="k">{lang === 'EN' ? 'Consistency Streak' : 'Chuỗi ngày Liên tiếp'}</div>
            <div className="val mt-1">
              {lang === 'EN' ? '7-Day' : '7 Ngày'}
              <small>{lang === 'EN' ? 'Streak' : 'Liên tục'}</small>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 -mt-1">
        {lang === 'EN'
          ? 'Points reward adherence and routine tracking, automatically syncing when you log sleep or vitals.'
          : 'Điểm thưởng ghi nhận sự tuân thủ lịch trình và tự động hoàn thành khi bạn cập nhật giấc ngủ đạt chuẩn.'}
      </p>

      <Panel
        title={lang === 'EN' ? 'Daily Health Missions' : 'Nhiệm vụ Sức khỏe Hàng ngày'}
        aside={
          <span className="ml-auto font-mono text-xs text-slate-400">
            {lang === 'EN' ? 'Resets 00:00 UTC' : 'Làm mới lúc 00:00 UTC'}
          </span>
        }
      >
        <ul className="grid grid-cols-2 gap-2">
          {missions.map((m) => {
            const Icon = m.icon
            const title = lang === 'EN' ? m.titleEn : m.titleVi
            return (
              <li
                key={m.id}
                className={`row-item !min-h-[84px] ${m.done ? '!border-emerald-500/40' : '!border-sky-500/50'}`}
              >
                <span className={`mi !w-11 !h-11 !rounded-xl ${m.done ? 'ok' : ''}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="t leading-snug">{title}</span>
                  <span className="pill indigo self-start font-mono">+{m.pts} pts</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(m)}
                  aria-pressed={m.done}
                  aria-label={m.done ? `${title}: completed. Tap to undo` : `Start mission: ${title}`}
                  className={`btn !min-h-14 flex-none ${m.done ? 'btn-ok' : 'btn-primary'}`}
                >
                  {m.done ? (
                    <>
                      <CircleCheck size={18} aria-hidden="true" />
                      {lang === 'EN' ? 'Completed' : 'Đã xong'}
                    </>
                  ) : (
                    <>
                      {lang === 'EN' ? 'Complete' : 'Hoàn thành'}
                      <ArrowRight size={18} aria-hidden="true" />
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel
        title={lang === 'EN' ? 'Badges & Achievements' : 'Huy hiệu & Thành tựu'}
        aside={
          <span className="ml-auto font-mono text-xs text-slate-400">
            {done === missions.length ? '3 / 4' : '2 / 4'} {lang === 'EN' ? 'unlocked' : 'đã mở'}
          </span>
        }
      >
        <div className="grid grid-cols-4 gap-3">
          {BADGES.map((b, idx) => (
            <HexBadge
              key={b.nameEn}
              badge={idx === 3 && done === missions.length ? { ...b, unlocked: true } : b}
              lang={lang}
            />
          ))}
        </div>
      </Panel>

      <div className="banner info items-center">
        <Moon size={18} className="flex-none" aria-hidden="true" />
        <span>
          {lang === 'EN'
            ? 'Missed a check-in? Rest comes first. Streaks pause gracefully during emergency operations.'
            : 'Bỏ lỡ một lần đo? Giấc ngủ và an toàn luôn được ưu tiên. Chuỗi ngày sẽ tự bảo lưu khi có ca trực khẩn cấp.'}
        </span>
      </div>
    </div>
  )
}
