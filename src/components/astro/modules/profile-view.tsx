import { Database, Lock, RefreshCw, RotateCcw, ShieldCheck, Wifi } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_UNIT_PREFS, type Lang, type UnitPrefs } from '@/lib/astro-data'
import type { Notify } from '../app-shell'
import { Panel } from '../ui'

type Tab = 'baselines' | 'history' | 'units' | 'sync'
const TABS: { id: Tab; labelEn: string; labelVi: string }[] = [
  { id: 'baselines', labelEn: 'Personal Baselines', labelVi: 'Chuẩn Cá nhân' },
  { id: 'history', labelEn: 'Medical History', labelVi: 'Tiền sử Y khoa' },
  { id: 'units', labelEn: 'Unit Settings', labelVi: 'Đơn vị Đo lường' },
  { id: 'sync', labelEn: 'Offline Sync Preferences', labelVi: 'Đồng bộ Ngoại tuyến' },
]

const BASELINES = [
  ['Resting Heart Rate', 'Nhịp tim nghỉ', '68', 'BPM'],
  ['Heart Rate Variability (HRV)', 'Biến thiên Nhịp tim (HRV)', '56', 'ms'],
  ['Baseline SpO₂', 'Độ bão hòa SpO₂ chuẩn', '98 – 99', '%'],
  ['Blood Pressure Baseline', 'Huyết áp chuẩn', '118/76', 'mmHg'],
  ['Target Sleep Duration', 'Thời lượng ngủ mục tiêu', '7.5', 'Hours'],
  ['Normal Body Temp', 'Thân nhiệt chuẩn', '36.6 – 37.1', '°C'],
]

const HISTORY = [
  {
    date: '2025-03',
    itemEn: 'Pre-flight long-duration medical certification',
    itemVi: 'Chứng nhận y tế dài hạn trước chuyến bay',
    tagEn: 'Cleared',
    tagVi: 'Đạt chuẩn',
    tone: 'ok',
  },
  {
    date: '2024-09',
    itemEn: 'Mild seasonal allergic rhinitis · managed',
    itemVi: 'Viêm mũi dị ứng nhẹ theo mùa · đã kiểm soát',
    tagEn: 'Monitored',
    tagVi: 'Theo dõi',
    tone: 'neu',
  },
  {
    date: '2023-06',
    itemEn: 'Right ankle sprain (Grade I) · fully resolved',
    itemVi: 'Giãn dây chằng cổ chân phải (Độ I) · đã hồi phục hoàn toàn',
    tagEn: 'Resolved',
    tagVi: 'Đã khỏi',
    tone: 'ok',
  },
  {
    date: '—',
    itemEn: 'No known drug allergies',
    itemVi: 'Không có tiền sử dị ứng thuốc',
    tagEn: 'NKDA',
    tagVi: 'Không dị ứng',
    tone: 'neu',
  },
]

const PROFILE = [
  ['Mission', 'Sứ mệnh', 'Artemis Orbital Research – Station Alpha'],
  ['Mission Phase', 'Giai đoạn', 'Orbital Science Phase 2'],
  ['Role', 'Vai trò', 'Payload Specialist / Flight Engineer'],
]

function Toggle({
  label,
  desc,
  on,
  onChange,
}: {
  label: string
  desc?: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="row-item w-full text-left !min-h-16 hover:border-slate-500"
    >
      <span className="flex-1 flex flex-col gap-0.5">
        <span className="t">{label}</span>
        {desc && <span className="s">{desc}</span>}
      </span>
      <span className="switch" />
    </button>
  )
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="row-item !min-h-16">
      <span className="t flex-1">{label}</span>
      <div className="tabs lg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            aria-selected={value === o}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ProfileView({
  lang = 'EN',
  unitPrefs = DEFAULT_UNIT_PREFS,
  onChangeUnitPrefs,
  onResetDemoData,
  notify,
}: {
  lang?: Lang
  unitPrefs?: UnitPrefs
  onChangeUnitPrefs?: (prefs: UnitPrefs) => void
  onResetDemoData?: () => void
  notify: Notify
}) {
  const [tab, setTab] = useState<Tab>('baselines')
  const [autoSync, setAutoSync] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('08:14 UTC')
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
      notify(
        lang === 'EN'
          ? 'Local cache synced with ground server'
          : 'Đã đồng bộ bộ nhớ cục bộ với máy chủ mặt đất',
      )
    }, 600)
  }

  return (
    <div className="page !flex-row !items-start gap-3">
      <aside className="w-[35%] flex-none flex flex-col gap-3" aria-label="Astronaut profile">
        <section className="panel !p-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl grid place-items-center bg-gradient-to-br from-sky-500 to-indigo-500 text-xl font-bold text-white flex-none">
              AV
            </div>
            <div className="min-w-0">
              <span className="pill cyan font-mono">ASTRO-001</span>
              <h1 className="text-xl font-bold mt-1.5">Cmdr. Alex Vance</h1>
            </div>
          </div>
          <dl className="flex flex-col gap-3">
            {PROFILE.map(([kEn, kVi, v]) => (
              <div key={kEn}>
                <dt className="eyebrow">{lang === 'EN' ? kEn : kVi}</dt>
                <dd className="text-sm mt-0.5 text-slate-100">{v}</dd>
              </div>
            ))}
            <div>
              <dt className="eyebrow">{lang === 'EN' ? 'Current Day' : 'Ngày Sứ mệnh'}</dt>
              <dd className="mt-1">
                <span className="font-mono text-lg font-semibold">
                  {lang === 'EN' ? 'Day 24' : 'Ngày 24'}
                </span>
                <span className="text-sm text-slate-400">
                  {lang === 'EN' ? ' of 180' : ' / 180 ngày'}
                </span>
                <div className="bar-track mt-2">
                  <div className="bar-fill bg-sky-500" style={{ width: `${(24 / 180) * 100}%` }} />
                </div>
              </dd>
            </div>
          </dl>
          <div className="banner warn items-center !py-2">
            <Lock size={16} className="flex-none" aria-hidden="true" />
            <span className="font-semibold text-xs tracking-wide">
              {lang === 'EN'
                ? 'Class 1 Medical Data Restricted'
                : 'Dữ liệu Y tế Hạng 1 · Bảo mật Nội bộ'}
            </span>
          </div>
        </section>

        <Panel
          title={lang === 'EN' ? 'Offline & Edge Data Sync' : 'Đồng bộ Dữ liệu Cục bộ & Mặt đất'}
          aside={<span className="st ok ml-auto">LINK UP</span>}
        >
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <Database size={16} className="text-sky-400" aria-hidden="true" />
                <span className="flex-1">
                  {lang === 'EN' ? 'Local Storage Persistence' : 'Bộ nhớ Lưu trữ Trình duyệt'}
                </span>
                <span className="font-mono text-xs">
                  {used} MB / {cap} MB
                </span>
              </div>
              <div
                className="bar-track mt-2"
                role="progressbar"
                aria-label="Local cache usage"
                aria-valuenow={used}
                aria-valuemin={0}
                aria-valuemax={cap}
              >
                <div className="bar-fill bg-sky-500" style={{ width: `${Math.max((used / cap) * 100, 2)}%` }} />
              </div>
            </div>
            <Toggle
              label={
                lang === 'EN'
                  ? 'Auto-sync with ground server'
                  : 'Tự động đồng bộ với trạm mặt đất'
              }
              desc={lang === 'EN' ? 'When link bandwidth > 256 kbps' : 'Khi băng thông > 256 kbps'}
              on={autoSync}
              onChange={setAutoSync}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn btn-outline-cyan w-full"
                onClick={syncNow}
                disabled={syncing}
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
                {syncing
                  ? lang === 'EN'
                    ? 'Syncing…'
                    : 'Đang đồng bộ…'
                  : lang === 'EN'
                    ? 'Sync Now'
                    : 'Đồng bộ ngay'}
              </button>
              {onResetDemoData && (
                <button
                  type="button"
                  className="btn w-full"
                  onClick={onResetDemoData}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  {lang === 'EN' ? 'Reset Default' : 'Khôi phục gốc'}
                </button>
              )}
            </div>
            <span className="text-xs text-slate-400 font-mono text-center">
              {lang === 'EN' ? 'Last sync' : 'Đồng bộ lúc'} {lastSync}
            </span>
          </div>
        </Panel>
      </aside>

      <section className="panel flex-1 !p-4 gap-4" aria-label="Profile settings">
        <div className="chipbar" role="tablist" aria-label="Profile sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tp-${t.id}`}
              onClick={() => setTab(t.id)}
            >
              {lang === 'EN' ? t.labelEn : t.labelVi}
            </button>
          ))}
        </div>

        {tab === 'baselines' && (
          <div id="tp-baselines" role="tabpanel" className="flex flex-col gap-3">
            <table className="dt">
              <thead>
                <tr>
                  <th scope="col">{lang === 'EN' ? 'Parameter' : 'Thông số Sinh trắc'}</th>
                  <th scope="col" className="!text-right">
                    {lang === 'EN' ? 'Baseline' : 'Giá trị Chuẩn'}
                  </th>
                  <th scope="col">{lang === 'EN' ? 'Unit' : 'Đơn vị'}</th>
                </tr>
              </thead>
              <tbody>
                {BASELINES.map(([kEn, kVi, v, u]) => (
                  <tr key={kEn}>
                    <th
                      scope="row"
                      className="!text-sm !tracking-normal !normal-case !text-slate-100 !font-medium !py-3.5"
                    >
                      {lang === 'EN' ? kEn : kVi}
                    </th>
                    <td className="font-mono text-lg font-semibold text-right text-sky-200">{v}</td>
                    <td className="text-slate-400 font-mono text-xs">{u}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="banner info items-center !px-4">
              <ShieldCheck size={16} className="flex-none" aria-hidden="true" />
              <span className="text-xs">
                {lang === 'EN'
                  ? 'Baseline derived from 30-day pre-flight astronaut physical baseline. Read-only.'
                  : 'Chuẩn cơ sở được thiết lập từ 30 ngày đo kiểm trước chuyến bay của phi hành gia.'}
              </span>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <ul id="tp-history" role="tabpanel" className="flex flex-col gap-2">
            {HISTORY.map((h) => (
              <li key={h.itemEn} className="row-item">
                <span className="font-mono text-xs text-slate-400 w-16 flex-none">{h.date}</span>
                <span className="flex-1 text-sm">{lang === 'EN' ? h.itemEn : h.itemVi}</span>
                <span className={`st ${h.tone}`}>
                  {(lang === 'EN' ? h.tagEn : h.tagVi).toUpperCase()}
                </span>
              </li>
            ))}
            <li className="text-xs text-slate-400 mt-1">
              {lang === 'EN'
                ? 'Full record held by Flight Surgeon. Edits require ground medical authorization.'
                : 'Hồ sơ đầy đủ được lưu giữ bởi Bác sĩ Vũ trụ trưởng.'}
            </li>
          </ul>
        )}

        {tab === 'units' && (
          <div id="tp-units" role="tabpanel" className="flex flex-col gap-2">
            <Segmented
              label={lang === 'EN' ? 'Temperature (Live Synced)' : 'Nhiệt độ cơ thể (Đồng bộ toàn cục)'}
              options={['°C', '°F']}
              value={unitPrefs.tempUnit}
              onChange={(tempUnit) => {
                onChangeUnitPrefs?.({ ...unitPrefs, tempUnit })
                notify(
                  lang === 'EN'
                    ? `Temperature unit switched to ${tempUnit} across Dashboard`
                    : `Đã chuyển đơn vị nhiệt độ sang ${tempUnit} trên toàn hệ thống`,
                )
              }}
            />
            <Segmented
              label={lang === 'EN' ? 'Blood Glucose (Live Synced)' : 'Đường huyết (Đồng bộ toàn cục)'}
              options={['mg/dL', 'mmol/L']}
              value={unitPrefs.gluUnit}
              onChange={(gluUnit) => {
                onChangeUnitPrefs?.({ ...unitPrefs, gluUnit })
                notify(
                  lang === 'EN'
                    ? `Blood glucose unit switched to ${gluUnit} across Dashboard`
                    : `Đã chuyển đơn vị đường huyết sang ${gluUnit} trên toàn hệ thống`,
                )
              }}
            />
            <Segmented
              label={lang === 'EN' ? 'UTC Clock Format (Header)' : 'Định dạng Đồng hồ UTC (Header)'}
              options={['24h', '12h']}
              value={unitPrefs.clockFormat}
              onChange={(clockFormat) => {
                onChangeUnitPrefs?.({ ...unitPrefs, clockFormat })
                notify(
                  lang === 'EN'
                    ? `Mission clock switched to ${clockFormat} format`
                    : `Đã chuyển đồng hồ sang định dạng ${clockFormat}`,
                )
              }}
            />
            <div className="row-item !min-h-16">
              <span className="t flex-1">
                {lang === 'EN' ? 'Blood Pressure' : 'Huyết áp động mạch'}
              </span>
              <span className="font-mono text-sm text-slate-300">mmHg (NASA Standard)</span>
            </div>
          </div>
        )}

        {tab === 'sync' && (
          <div id="tp-sync" role="tabpanel" className="flex flex-col gap-2">
            <Toggle
              label={
                lang === 'EN'
                  ? 'Auto-sync when bandwidth > 256 kbps'
                  : 'Tự động đồng bộ khi băng thông > 256 kbps'
              }
              desc={lang === 'EN' ? 'Uses Ku-band downlink windows' : 'Sử dụng cửa sổ truyền Ku-band'}
              on={autoSync}
              onChange={setAutoSync}
            />
            <Toggle
              label={
                lang === 'EN'
                  ? 'Sync only over station Wi-Fi'
                  : 'Chỉ đồng bộ qua mạng Wi-Fi trạm vũ trụ'
              }
              desc={
                lang === 'EN'
                  ? 'Defer large uploads off the S-band link'
                  : 'Tránh nghẽn băng tần liên lạc S-band'
              }
              on={wifiOnly}
              onChange={setWifiOnly}
            />
            <Toggle
              label={
                lang === 'EN'
                  ? 'Compress telemetry before upload'
                  : 'Nén dữ liệu sinh trắc trước khi tải lên'
              }
              desc={lang === 'EN' ? 'Reduces payload ~68%' : 'Giảm ~68% dung lượng gói tin'}
              on={compress}
              onChange={setCompress}
            />
            <Segmented
              label={lang === 'EN' ? 'Local cache retention' : 'Thời gian lưu trữ cục bộ'}
              options={['30 d', '90 d', '180 d']}
              value={retention}
              onChange={setRetention}
            />
            <div className="banner neu items-center mt-1">
              <Wifi size={16} className="flex-none" aria-hidden="true" />
              <span className="text-xs">
                {lang === 'EN'
                  ? 'All vital changes and logs are persisted automatically in browser storage.'
                  : 'Mọi thay đổi chỉ số sinh tồn và lịch sử đo đều được tự động lưu bền vững trên trình duyệt.'}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
