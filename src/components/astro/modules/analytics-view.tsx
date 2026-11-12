import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  Info,
  Layers,
  ListOrdered,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { VITALS, type Lang, type Vital } from '@/lib/astro-data'
import {
  evaluateRuleBasedAnalytics,
  type AnalyticsMetricId,
  type AnalyticsRuleOutput,
  type AnalyticsStatus,
} from '@/lib/rule-based-analytics'
import { useElementSize } from '../charts'
import type { ModuleId } from '../sidebar'
import { PageHeader, Panel, RangeTabs } from '../ui'

type MetricKey = 'hrv' | 'hr' | 'bp' | 'spo2' | 'sleep'
type Range = 'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days'

type Point = { label: string; date: string; value: number; source: string }

type MetricCfg = {
  label: string
  viLabel: string
  name: string
  viName: string
  unit: string
  baseline: number
  cautionLimit: number
  lowerIsWorse: boolean
  min: number
  max: number
  series: Record<Range, number[]>
}

const DAYS_7 = ['Oct 31', 'Nov 01', 'Nov 02', 'Nov 03', 'Nov 04', 'Nov 05', 'Nov 06']
const HOURS_24 = ['08:00', '12:00', '16:00', '20:00', '00:00', '04:00', 'Now']
const DAYS_30 = Array.from({ length: 10 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 9 + i * 3))
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })
})

const BASE_METRICS: Record<MetricKey, MetricCfg> = {
  hrv: {
    label: 'HRV (RMSSD)',
    viLabel: 'Biến thiên HRV',
    name: 'HRV (RMSSD)',
    viName: 'Biến thiên khoảng R-R (HRV)',
    unit: 'ms',
    baseline: 56,
    cautionLimit: 46,
    lowerIsWorse: true,
    min: 25,
    max: 75,
    series: {
      'Last 24 Hours': [45, 43, 41, 44, 46, 43, 42],
      'Last 7 Days': [57, 58, 54, 51, 47, 44, 42],
      'Last 30 Days': [55, 57, 56, 58, 55, 57, 54, 50, 46, 42],
    },
  },
  hr: {
    label: 'Heart Rate',
    viLabel: 'Nhịp tim',
    name: 'Resting Heart Rate',
    viName: 'Nhịp tim nghỉ',
    unit: 'BPM',
    baseline: 68,
    cautionLimit: 95,
    lowerIsWorse: false,
    min: 45,
    max: 120,
    series: {
      'Last 24 Hours': [74, 77, 79, 76, 70, 72, 75],
      'Last 7 Days': [68, 67, 70, 71, 73, 74, 75],
      'Last 30 Days': [67, 68, 69, 67, 68, 69, 70, 72, 74, 75],
    },
  },
  bp: {
    label: 'Blood Pressure',
    viLabel: 'Huyết áp',
    name: 'Systolic Arterial Pressure',
    viName: 'Huyết áp Động mạch (Tâm thu)',
    unit: 'mmHg',
    baseline: 118,
    cautionLimit: 125,
    lowerIsWorse: false,
    min: 90,
    max: 155,
    series: {
      'Last 24 Hours': [122, 125, 127, 123, 118, 121, 125],
      'Last 7 Days': [117, 119, 118, 121, 122, 123, 125],
      'Last 30 Days': [118, 117, 119, 118, 120, 119, 121, 122, 123, 125],
    },
  },
  spo2: {
    label: 'SpO₂',
    viLabel: 'Độ bão hòa SpO₂',
    name: 'Alveolar SpO₂ Saturation',
    viName: 'Bão hòa Oxy Phế nang (SpO₂)',
    unit: '%',
    baseline: 98.5,
    cautionLimit: 95,
    lowerIsWorse: true,
    min: 90,
    max: 100,
    series: {
      'Last 24 Hours': [98, 98, 97, 98, 97, 98, 98],
      'Last 7 Days': [99, 98, 98, 98, 97, 98, 98],
      'Last 30 Days': [99, 98, 99, 98, 98, 99, 98, 98, 97, 98],
    },
  },
  sleep: {
    label: 'Sleep Duration',
    viLabel: 'Thời lượng ngủ',
    name: 'Sleep Duration',
    viName: 'Thời lượng Giấc ngủ',
    unit: 'h',
    baseline: 7.5,
    cautionLimit: 6.5,
    lowerIsWorse: true,
    min: 4,
    max: 10,
    series: {
      'Last 24 Hours': [6.2, 6.2, 6.2, 6.2, 6.2, 6.2, 6.2],
      'Last 7 Days': [7.4, 7.1, 6.8, 6.5, 6.6, 6.3, 6.2],
      'Last 30 Days': [7.6, 7.4, 7.5, 7.3, 7.6, 7.2, 6.8, 6.5, 6.3, 6.2],
    },
  },
}

const RANGES: Range[] = ['Last 24 Hours', 'Last 7 Days', 'Last 30 Days']

function labelsFor(range: Range) {
  return range === 'Last 24 Hours' ? HOURS_24 : range === 'Last 7 Days' ? DAYS_7 : DAYS_30
}

function TrendChart({
  points,
  cfg,
  band,
  lang,
}: {
  points: Point[]
  cfg: MetricCfg
  band: { start: number; end: number; length: number } | null
  lang: Lang
}) {
  const { ref, w, h } = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number>(points.length - 1)
  const W = w || 700
  const H = h || 280
  const pl = 44
  const pr = 16
  const pt = 22
  const pb = 28
  const iw = W - pl - pr
  const ih = H - pt - pb
  const x = (i: number) => pl + i * (iw / (points.length - 1))
  const y = (v: number) => {
    const clamped = Math.max(cfg.min, Math.min(cfg.max, v))
    return pt + ih - ((clamped - cfg.min) / (cfg.max - cfg.min)) * ih
  }

  const path = points
    .map((p, i) => {
      if (i === 0) return `M${x(0)},${y(p.value)}`
      const px = x(i - 1)
      const py = y(points[i - 1].value)
      const cx = (px + x(i)) / 2
      return `C${cx},${py} ${cx},${y(p.value)} ${x(i)},${y(p.value)}`
    })
    .join(' ')

  const hp = points[Math.min(hover, points.length - 1)]
  const hx = x(Math.min(hover, points.length - 1))
  const below = cfg.lowerIsWorse ? hp.value < cfg.baseline : hp.value > cfg.baseline
  const tipW = 210
  const tipX = Math.min(Math.max(hx - tipW / 2, pl), W - pr - tipW)

  return (
    <div ref={ref} className="chart relative" style={{ minHeight: 280 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${cfg.name} trend with personal baseline ${cfg.baseline} ${cfg.unit}`}
      >
        {/* Trend Window Shaded Band for Detected Streaks */}
        {band && (
          <g>
            <rect
              x={x(band.start) - 10}
              y={pt}
              width={x(band.end) - x(band.start) + 20}
              height={ih}
              fill="rgba(245,158,11,0.08)"
              stroke="rgba(245,158,11,0.4)"
              strokeDasharray="4 3"
              rx="6"
            />
            <text
              x={x(band.start) - 2}
              y={pt + 13}
              fill="#FCD34D"
              fontSize="11"
              fontWeight="600"
              fontFamily="var(--sans)"
            >
              {lang === 'EN'
                ? `Adverse Trend Streak (${band.length} Points)`
                : `Chuỗi xu hướng giảm (${band.length} lần đo)`}
            </text>
          </g>
        )}

        {/* Horizontal Grid lines and Y-axis values */}
        {[0, 1, 2, 3, 4].map((k) => {
          const yy = pt + (k * ih) / 4
          const v = cfg.max - (k * (cfg.max - cfg.min)) / 4
          return (
            <g key={k}>
              <line x1={pl} x2={W - pr} y1={yy} y2={yy} stroke="#1E293B" />
              <text
                x={pl - 8}
                y={yy + 4}
                fill="#94A3B8"
                fontSize="11"
                textAnchor="end"
                fontFamily="var(--mono)"
              >
                {Number.isInteger(v) ? v : v.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* X-axis time labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            fill={i === hover ? '#E0F2FE' : '#94A3B8'}
            fontSize="11"
            textAnchor="middle"
            fontFamily="var(--mono)"
          >
            {p.label}
          </text>
        ))}

        {/* NASA Caution Limit Line (Upper or Lower threshold) */}
        {cfg.cautionLimit && (
          <g>
            <line
              x1={pl}
              x2={W - pr}
              y1={y(cfg.cautionLimit)}
              y2={y(cfg.cautionLimit)}
              stroke="#EA580C"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
            <text
              x={pl + 4}
              y={y(cfg.cautionLimit) - 5}
              fill="#FB923C"
              fontSize="10"
              fontFamily="var(--mono)"
              fontWeight="600"
            >
              {lang === 'EN' ? `CAUTION LIMIT (${cfg.cautionLimit})` : `GIỚI HẠN CHÚ Ý (${cfg.cautionLimit})`}
            </text>
          </g>
        )}

        {/* Astronaut Pre-flight Baseline Line */}
        <line
          x1={pl}
          x2={W - pr}
          y1={y(cfg.baseline)}
          y2={y(cfg.baseline)}
          stroke="#F59E0B"
          strokeWidth="1.6"
          strokeDasharray="6 5"
        />
        <text
          x={W - pr - 4}
          y={y(cfg.baseline) - 6}
          fill="#FCD34D"
          fontSize="11"
          textAnchor="end"
          fontFamily="var(--sans)"
          fontWeight="600"
        >
          {lang === 'EN'
            ? `Astronaut Personal Baseline (${cfg.baseline} ${cfg.unit})`
            : `Chuẩn cá nhân trước chuyến bay (${cfg.baseline} ${cfg.unit})`}
        </text>

        {/* Line Fill and Smooth Path */}
        <path d={`${path} L${x(points.length - 1)},${pt + ih} L${pl},${pt + ih} Z`} fill="rgba(56,189,248,0.08)" />
        <path d={path} fill="none" stroke="#38BDF8" strokeWidth="2.75" strokeLinecap="round" />

        {/* Hover hairline */}
        <line x1={hx} x2={hx} y1={pt} y2={pt + ih} stroke="#475569" strokeDasharray="2 3" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={i === hover ? 6 : 3.5}
            fill={i === hover ? '#38BDF8' : '#131C2E'}
            stroke="#38BDF8"
            strokeWidth="2"
          />
        ))}

        {/* Invisible hit targets for mouse hover/touch */}
        {points.map((p, i) => {
          const half = iw / (points.length - 1) / 2
          return (
            <rect
              key={`hit-${i}`}
              x={x(i) - half}
              y={pt}
              width={half * 2}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
              tabIndex={0}
              onFocus={() => setHover(i)}
              aria-label={`${p.date}: ${p.value} ${cfg.unit}`}
              role="button"
            />
          )
        })}
      </svg>

      {/* Hover Floating Tooltip */}
      <div
        className="absolute pointer-events-none rounded-xl border border-slate-700 bg-[#0B0F19]/95 backdrop-blur-md px-3.5 py-2.5 text-xs shadow-2xl z-20"
        style={{ left: tipX, top: Math.max(y(hp.value) - 118, 4), width: tipW }}
        aria-live="polite"
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-slate-400">{lang === 'EN' ? 'Date' : 'Thời điểm'}</dt>
          <dd className="font-mono text-slate-200">{hp.date}</dd>
          <dt className="text-slate-400">{lang === 'EN' ? 'Value' : 'Giá trị'}</dt>
          <dd className="font-mono font-bold text-sky-300">
            {hp.value} {cfg.unit}
          </dd>
          <dt className="text-slate-400">{lang === 'EN' ? 'Source' : 'Nguồn'}</dt>
          <dd className="text-slate-300">{hp.source}</dd>
          <dt className="text-slate-400">{lang === 'EN' ? 'Status' : 'Trạng thái'}</dt>
          <dd className={below ? 'text-amber-300 font-semibold' : 'text-emerald-300 font-semibold'}>
            {below
              ? cfg.lowerIsWorse
                ? lang === 'EN'
                  ? 'Below Baseline'
                  : 'Dưới ngưỡng chuẩn'
                : lang === 'EN'
                  ? 'Above Baseline'
                  : 'Cao hơn chuẩn'
              : lang === 'EN'
                ? 'Within Baseline'
                : 'Đạt chuẩn'}
          </dd>
        </dl>
      </div>
    </div>
  )
}

export function AnalyticsView({
  lang = 'EN',
  vitals = VITALS,
  onNavigate,
}: {
  lang?: Lang
  vitals?: Vital[]
  onNavigate: (id: ModuleId, metricId?: any) => void
}) {
  const [metric, setMetric] = useState<MetricKey>('hrv')
  const [range, setRange] = useState<Range>('Last 7 Days')

  const baseCfg = BASE_METRICS[metric]
  const liveVital = vitals.find((v) => v.id === metric)
  const liveNumeric =
    liveVital
      ? metric === 'bp'
        ? Number(liveVital.value.split('/')[0])
        : Number(liveVital.value)
      : undefined

  // Merge live vital series and latest value into the selected range
  const rawSeries = baseCfg.series[range]
  const values =
    liveVital && range === 'Last 7 Days' && liveVital.series.length === 7
      ? liveVital.series
      : liveNumeric !== undefined && Number.isFinite(liveNumeric)
        ? [...rawSeries.slice(0, -1), liveNumeric]
        : rawSeries

  const dynamicMax = Math.max(baseCfg.max, ...values)
  const dynamicMin = Math.min(baseCfg.min, ...values)
  const cfg: MetricCfg = {
    ...baseCfg,
    min: dynamicMin,
    max: dynamicMax,
  }

  const current = values[values.length - 1]
  const first = values[0]
  const weekPct = Math.round(((current - first) / first) * 100)

  // EXECUTE RULE-BASED ASSESSMENT ENGINE (4-STEP PIPELINE)
  const ruleOutput: AnalyticsRuleOutput = evaluateRuleBasedAnalytics({
    metricId: metric,
    currentValue: current,
    baselineValue: cfg.baseline,
    seriesValues: values,
    unit: cfg.unit,
    lowerIsWorse: cfg.lowerIsWorse,
    lang,
  })

  const labels = labelsFor(range)
  const points: Point[] = values.map((v, i) => ({
    label: labels[i],
    date: range === 'Last 24 Hours' ? `Nov 06, ${labels[i]}` : `${labels[i]}, 2026`,
    value: v,
    source: liveVital?.source === 'Manual' ? 'Manual / Voice Sync' : 'Wearable Sensor',
  }))

  const band = ruleOutput.insight.trendDetected
    ? {
        start: Math.max(0, values.length - 4),
        end: values.length - 1,
        length: 4,
      }
    : null

  // Dynamic Historical Comparison synced with live vitals
  const hrvV = vitals.find((v) => v.id === 'hrv') ?? VITALS[5]
  const hrV = vitals.find((v) => v.id === 'hr') ?? VITALS[0]
  const bpV = vitals.find((v) => v.id === 'bp') ?? VITALS[1]
  const spo2V = vitals.find((v) => v.id === 'spo2') ?? VITALS[2]
  const sleepV = vitals.find((v) => v.id === 'sleep') ?? VITALS[4]

  const comparisonRows = [
    {
      metric: lang === 'EN' ? 'Heart Rate Variability' : 'Biến thiên Nhịp tim (HRV)',
      unit: 'ms',
      current: hrvV.value,
      mission: '51',
      base: '56',
      status: hrvV.status,
    },
    {
      metric: lang === 'EN' ? 'Resting Heart Rate' : 'Nhịp tim nghỉ (HR)',
      unit: 'BPM',
      current: hrV.value,
      mission: '70',
      base: '68',
      status: hrV.status,
    },
    {
      metric: lang === 'EN' ? 'Blood Pressure' : 'Huyết áp động mạch (BP)',
      unit: 'mmHg',
      current: bpV.value,
      mission: '120/78',
      base: '118/76',
      status: bpV.status,
    },
    {
      metric: lang === 'EN' ? 'SpO₂ Oxygen Saturation' : 'Độ bão hòa Oxy (SpO₂)',
      unit: '%',
      current: spo2V.value,
      mission: '98.1',
      base: '98–99',
      status: spo2V.status,
    },
    {
      metric: lang === 'EN' ? 'Sleep Duration' : 'Thời lượng Giấc ngủ',
      unit: 'h/night',
      current: sleepV.value,
      mission: '6.6',
      base: '7.5',
      status: sleepV.status,
    },
  ]

  const exportCsv = () => {
    const rows = [
      'date,metric,value,unit,source',
      ...points.map((p) => `"${p.date}",${cfg.name},${p.value},${cfg.unit},${p.source}`),
    ]
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `astrocare-${metric}-${range.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Visual tones for Assessment status
  const assessmentToneClass =
    ruleOutput.assessment.status === 'MEDICAL_ATTENTION'
      ? 'border-red-500/70 bg-red-950/20 text-red-300'
      : ruleOutput.assessment.status === 'MONITORING'
        ? 'border-amber-500/60 bg-amber-950/20 text-amber-300'
        : 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'

  return (
    <div className="page space-y-4">
      {/* 1. Header with NASA-compliant Export CSV button */}
      <PageHeader
        eyebrow={
          lang === 'EN'
            ? 'NASA HRP Clinical Analytics Engine'
            : 'Động cơ Phân tích Xu hướng Chuẩn NASA HRP'
        }
        title={lang === 'EN' ? 'Health Analytics' : 'Phân tích Xu hướng Sức khỏe'}
        actions={
          <button
            type="button"
            className="btn border border-sky-400/50 bg-sky-950/30 hover:bg-sky-500/20 text-sky-200 transition-colors"
            onClick={exportCsv}
          >
            <Download size={16} aria-hidden="true" />
            <span>{lang === 'EN' ? 'Export Telemetry CSV' : 'Xuất dữ liệu CSV'}</span>
          </button>
        }
      />

      {/* 2. Metric and Time Range Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="chipbar flex-1" role="tablist" aria-label="Metric">
          {(Object.keys(BASE_METRICS) as MetricKey[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={metric === k}
              onClick={() => setMetric(k)}
              className="transition-colors"
            >
              {lang === 'EN' ? BASE_METRICS[k].label : BASE_METRICS[k].viLabel}
            </button>
          ))}
        </div>
        <RangeTabs options={RANGES} value={range} onChange={setRange} label="Time range" large />
      </div>

      {/* 3. 4-Step Operational Pipeline Banner */}
      <div className="rounded-xl border border-slate-800 bg-[#0c1424] px-4 py-2 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
        <div className="flex items-center gap-2 font-mono text-sky-400 font-semibold">
          <Compass size={14} aria-hidden="true" />
          <span>{lang === 'EN' ? 'RULE PIPELINE:' : 'LUỒNG QUY TẮC:'}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400 flex-wrap">
          <span className="text-slate-200">1. {lang === 'EN' ? 'Data Check' : 'Kiểm tra dữ liệu'}</span>
          <span>→</span>
          <span className="text-slate-200">2. {lang === 'EN' ? 'Thresholds' : 'Đối chiếu ngưỡng'}</span>
          <span>→</span>
          <span className="text-slate-200">3. {lang === 'EN' ? 'Baseline Comparison' : 'So sánh Baseline'}</span>
          <span>→</span>
          <span className="text-sky-300 font-semibold">4. {lang === 'EN' ? 'Trend Analysis' : 'Phân tích xu hướng'}</span>
        </div>
      </div>

      {/* 4. Telemetry Graph */}
      <Panel
        title={`${lang === 'EN' ? cfg.name : cfg.viName} · ${range}`}
        aside={
          <div className="legend">
            <span>
              <i style={{ background: '#38BDF8' }} />
              {lang === 'EN' ? 'Recorded Telemetry' : 'Thực đo (Live)'}
            </span>
            <span>
              <i style={{ background: 'repeating-linear-gradient(90deg,#F59E0B 0 5px,transparent 5px 8px)' }} />
              {lang === 'EN' ? 'Personal Baseline' : 'Chuẩn trước bay'}
            </span>
            <span>
              <i style={{ background: 'repeating-linear-gradient(90deg,#EA580C 0 3px,transparent 3px 6px)' }} />
              {lang === 'EN' ? 'Caution Limit' : 'Giới hạn chú ý'}
            </span>
            {band && (
              <span>
                <i style={{ background: 'rgba(245,158,11,0.4)', height: 8 }} />
                {lang === 'EN' ? 'Adverse Window' : 'Vùng chuỗi giảm'}
              </span>
            )}
          </div>
        }
      >
        <TrendChart key={`${metric}-${range}-${current}`} points={points} cfg={cfg} band={band} lang={lang} />
      </Panel>

      {/* 5. CORE RULE-BASED OUTPUT: 3-PILLAR A-I-A ARCHITECTURE (Assessment - Insight - Action) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* COMPONENT 1: ASSESSMENT – ĐÁNH GIÁ (Tình trạng hiện tại như thế nào?) */}
        <section
          className={`rounded-2xl border p-4.5 flex flex-col justify-between gap-3 bg-[#0d1629]/90 shadow-xl transition-all ${assessmentToneClass}`}
          aria-labelledby="aia-assess-title"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold opacity-80 flex items-center gap-1.5">
                <ShieldAlert size={14} aria-hidden="true" />
                <span>{lang === 'EN' ? '1. ASSESSMENT' : '1. ĐÁNH GIÁ LÂM SÀNG'}</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-current font-bold">
                {lang === 'EN' ? 'QUESTION: STATUS?' : 'CÂU HỎI: TÌNH TRẠNG?'}
              </span>
            </div>

            <h3 id="aia-assess-title" className="text-base font-bold text-slate-100 leading-snug">
              {lang === 'EN' ? ruleOutput.assessment.statusLabelEn : ruleOutput.assessment.statusLabelVi}
            </h3>

            <div className="mt-3.5 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">{lang === 'EN' ? 'Current Value:' : 'Giá trị Thực đo:'}</span>
                <span className="font-bold text-sky-300 text-sm">{ruleOutput.assessment.currentValueFormatted}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-400">{lang === 'EN' ? 'Personal Baseline:' : 'Chuẩn trước bay:'}</span>
                <span className="text-slate-200">{ruleOutput.assessment.baselineFormatted}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">{lang === 'EN' ? 'Deviation vs Baseline:' : 'Độ lệch chuẩn:'}</span>
                <span className={ruleOutput.assessment.isAdverse ? 'text-amber-300 font-semibold' : 'text-emerald-300 font-semibold'}>
                  {ruleOutput.assessment.varianceFormatted}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[11px]">
            <span className="text-slate-400">{lang === 'EN' ? 'Trend Direction:' : 'Chiều biến thiên:'}</span>
            <span className="font-mono text-slate-200">
              {weekPct >= 0 ? `+${weekPct}%` : `${weekPct}%`} {lang === 'EN' ? 'in period' : 'trong kỳ theo dõi'}
            </span>
          </div>
        </section>

        {/* COMPONENT 2: INSIGHT – NHẬN XÉT (Điều gì đang xảy ra và tại sao cần chú ý?) */}
        <section
          className="rounded-2xl border border-sky-500/40 bg-[#0b1526]/90 p-4.5 flex flex-col justify-between gap-3 shadow-xl"
          aria-labelledby="aia-insight-title"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-sky-400 flex items-center gap-1.5">
                <Stethoscope size={14} aria-hidden="true" />
                <span>{lang === 'EN' ? '2. CLINICAL INSIGHT' : '2. NHẬN XÉT CƠ CHẾ'}</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-400/40 text-sky-300 font-bold">
                {lang === 'EN' ? 'QUESTION: WHY?' : 'CÂU HỎI: TẠI SAO?'}
              </span>
            </div>

            <h3 id="aia-insight-title" className="text-xs font-semibold text-slate-200 leading-relaxed">
              {lang === 'EN' ? ruleOutput.insight.summaryEn : ruleOutput.insight.summaryVi}
            </h3>

            {/* Physiological Mechanism */}
            <div className="mt-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] leading-relaxed text-slate-300 space-y-1.5">
              <div className="font-semibold text-sky-300 flex items-center gap-1">
                <Info size={12} aria-hidden="true" />
                <span>{lang === 'EN' ? 'Physiological Mechanism:' : 'Cơ chế sinh lý học vũ trụ:'}</span>
              </div>
              <p>{lang === 'EN' ? ruleOutput.insight.mechanismEn : ruleOutput.insight.mechanismVi}</p>
            </div>
          </div>

          {/* NASA HRP Spaceflight Hazard Tag */}
          <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-amber-300/90 flex items-start gap-1.5">
            <span className="font-bold flex-none">⚡</span>
            <span>{lang === 'EN' ? ruleOutput.insight.spaceHazardEn : ruleOutput.insight.spaceHazardVi}</span>
          </div>
        </section>

        {/* COMPONENT 3: ACTION – HÀNH ĐỘNG (Người dùng nên làm gì tiếp theo?) */}
        <section
          className="rounded-2xl border border-emerald-500/40 bg-[#091522]/90 p-4.5 flex flex-col justify-between gap-3 shadow-xl"
          aria-labelledby="aia-action-title"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1.5">
                <Zap size={14} aria-hidden="true" />
                <span>{lang === 'EN' ? '3. RECOMMENDED ACTION' : '3. HÀNH ĐỘNG TIẾP THEO'}</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-400/40 text-emerald-300 font-bold">
                {lang === 'EN' ? 'QUESTION: NEXT?' : 'CÂU HỎI: LÀM GÌ?'}
              </span>
            </div>

            <div className="text-xs font-bold text-emerald-300 mb-2">
              {lang === 'EN' ? ruleOutput.action.urgencyLevelEn : ruleOutput.action.urgencyLevelVi}
            </div>

            {/* Action Checklist Steps */}
            <ol className="space-y-2 text-xs text-slate-200">
              {(lang === 'EN' ? ruleOutput.action.stepsEn : ruleOutput.action.stepsVi).map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[10px] font-mono font-bold flex items-center justify-center flex-none mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-snug flex-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Interactive CTA to execute next step directly */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                if (ruleOutput.action.targetModule) {
                  onNavigate(ruleOutput.action.targetModule, ruleOutput.action.targetMetricId)
                }
              }}
              className="w-full btn bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs py-2 px-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>{lang === 'EN' ? ruleOutput.action.ctaLabelEn : ruleOutput.action.ctaLabelVi}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      {/* 6. Historical 3-Way Comparison Table (Live vs Mission vs Baseline) */}
      <Panel
        title={
          lang === 'EN'
            ? 'Longitudinal Mission Comparison Table (Live Synced)'
            : 'Bảng Đối chiếu Dữ liệu Đa Chiều (Đồng bộ Trực tiếp)'
        }
      >
        <table className="dt">
          <thead>
            <tr>
              <th scope="col">{lang === 'EN' ? 'Metric' : 'Chỉ số'}</th>
              <th scope="col">{lang === 'EN' ? 'Current Live' : 'Hiện tại (Live)'}</th>
              <th scope="col">{lang === 'EN' ? 'Mission Average' : 'Trung bình Sứ mệnh'}</th>
              <th scope="col">{lang === 'EN' ? 'Pre-flight Baseline' : 'Chuẩn trước bay'}</th>
              <th scope="col">{lang === 'EN' ? 'Status' : 'Trạng thái'}</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((r) => (
              <tr key={r.metric}>
                <th scope="row" className="!text-[13px] !tracking-normal !normal-case !text-slate-100 !font-medium">
                  {r.metric} <span className="text-slate-400 font-mono text-xs">({r.unit})</span>
                </th>
                <td className={`font-mono font-semibold ${r.status !== 'ok' ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {r.current}
                </td>
                <td className="font-mono text-slate-300">{r.mission}</td>
                <td className="font-mono text-slate-300">{r.base}</td>
                <td>
                  <span className={`st ${r.status}`}>
                    {r.status === 'crit'
                      ? lang === 'EN'
                        ? 'CRITICAL'
                        : 'NGUY CẤP'
                      : r.status === 'warn'
                        ? lang === 'EN'
                          ? 'ATTENTION'
                          : 'CHÚ Ý'
                        : lang === 'EN'
                          ? 'NORMAL'
                          : 'ỔN ĐỊNH'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
