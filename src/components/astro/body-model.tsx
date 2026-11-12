import {
  Activity,
  ArrowRight,
  Brain,
  Droplets,
  FlaskConical,
  Gauge,
  HeartPulse,
  Moon,
  ScanFace,
  Thermometer,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ANATOMY_REGIONS,
  DEFAULT_UNIT_PREFS,
  computeHeartBeatDurationSec,
  computeRegionStatus,
  formatVitalDisplay,
  getRegionVitals,
  type AnatomyRegion,
  type AnatomyRegionId,
  type Lang,
  type Status,
  type UnitPrefs,
  type Vital,
  type VitalId,
} from '@/lib/astro-data'

const VITAL_ICONS: Record<VitalId, LucideIcon> = {
  hr: HeartPulse,
  bp: Gauge,
  spo2: Droplets,
  temp: Thermometer,
  sleep: Moon,
  hrv: Activity,
  stress: Brain,
  glu: FlaskConical,
}

type BodyModelProps = {
  lang: Lang
  vitals: Vital[]
  unitPrefs?: UnitPrefs
  selectedRegion: AnatomyRegionId
  focusedVitalId?: VitalId
  pulsingVitals?: VitalId[]
  inspectorOpen: boolean
  onSelectRegion: (id: AnatomyRegionId, preferredVitalId?: VitalId) => void
  onRequestOpticalScan: () => void
  filterMode?: 'all' | 'warn'
  onFilterModeChange?: (mode: 'all' | 'warn') => void
  showFloatingScanButton?: boolean
}

type LeaderLineCoords = {
  startX: number
  startY: number
  elbowX: number
  elbowY: number
  endX: number
  endY: number
}

const DEFAULT_LINES: Record<AnatomyRegionId, LeaderLineCoords> = {
  brain: { startX: 252, startY: 90, elbowX: 286, elbowY: 90, endX: 480, endY: 82 },
  lungs: { startX: 252, startY: 330, elbowX: 286, elbowY: 330, endX: 454, endY: 192 },
  heart: { startX: 708, startY: 110, elbowX: 674, elbowY: 110, endX: 492, endY: 202 },
  circulatory: { startX: 708, startY: 345, elbowX: 674, elbowY: 345, endX: 480, endY: 288 },
}

export function InteractiveBodyModel({
  lang,
  vitals,
  unitPrefs = DEFAULT_UNIT_PREFS,
  selectedRegion,
  focusedVitalId,
  pulsingVitals = [],
  inspectorOpen,
  onSelectRegion,
  onRequestOpticalScan,
  showFloatingScanButton = false,
}: BodyModelProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const podRefs = useRef<Record<AnatomyRegionId, HTMLDivElement | null>>({
    brain: null,
    lungs: null,
    heart: null,
    circulatory: null,
  })
  const organAnchorRefs = useRef<Record<AnatomyRegionId, SVGCircleElement | null>>({
    brain: null,
    lungs: null,
    heart: null,
    circulatory: null,
  })

  const [leaderLines, setLeaderLines] = useState<Record<AnatomyRegionId, LeaderLineCoords>>(DEFAULT_LINES)

  const getStatus = (id: AnatomyRegionId): Status => computeRegionStatus(vitals, id)

  const brainStatus = getStatus('brain')
  const heartStatus = getStatus('heart')
  const lungsStatus = getStatus('lungs')
  const circStatus = getStatus('circulatory')

  const hrVital = vitals.find((v) => v.id === 'hr')
  const heartBeatSec = computeHeartBeatDurationSec(hrVital?.value ?? 75)

  const brainReg = ANATOMY_REGIONS.find((r) => r.id === 'brain')!
  const heartReg = ANATOMY_REGIONS.find((r) => r.id === 'heart')!
  const lungsReg = ANATOMY_REGIONS.find((r) => r.id === 'lungs')!
  const circReg = ANATOMY_REGIONS.find((r) => r.id === 'circulatory')!

  const isRegActive = (id: AnatomyRegionId) => inspectorOpen && selectedRegion === id

  const strokeFor = (st: Status, isSelected: boolean) => {
    if (st === 'crit') return '#EF4444'
    if (st === 'warn') return '#F59E0B'
    if (isSelected) return '#38BDF8'
    return '#10B981'
  }

  const filterAttrFor = (st: Status, isSelected: boolean) => {
    if (st === 'crit') return 'url(#organ-glow-crit)'
    if (st === 'warn') return 'url(#organ-glow-warn)'
    if (isSelected) return 'url(#organ-glow-cyan)'
    return 'url(#organ-glow-ok)'
  }

  /**
   * Computes exact pixel coordinates so all 4 HUD Leader Lines start flush at the inner border edge
   * of each telemetry pod and connect via a 32px horizontal HUD elbow directly to the 3D organ center.
   */
  const recomputeLeaderLines = useCallback(() => {
    const stageEl = stageRef.current
    if (!stageEl) return
    const stageRect = stageEl.getBoundingClientRect()
    if (stageRect.width < 100 || stageRect.height < 100) return

    const next: Record<AnatomyRegionId, LeaderLineCoords> = { ...DEFAULT_LINES }
    const regions: Array<{ id: AnatomyRegionId; side: 'left' | 'right' }> = [
      { id: 'brain', side: 'left' },
      { id: 'lungs', side: 'left' },
      { id: 'heart', side: 'right' },
      { id: 'circulatory', side: 'right' },
    ]

    for (const { id, side } of regions) {
      const podEl = podRefs.current[id]
      const organEl = organAnchorRefs.current[id]
      if (!podEl || !organEl) continue

      const podRect = podEl.getBoundingClientRect()
      const organRect = organEl.getBoundingClientRect()

      // Exact inner border of the card
      const startX =
        side === 'left'
          ? Math.round(podRect.right - stageRect.left)
          : Math.round(podRect.left - stageRect.left)
      const startY = Math.round(podRect.top - stageRect.top + podRect.height * 0.46)
      const elbowX = side === 'left' ? startX + 32 : startX - 32
      const elbowY = startY
      const endX = Math.round(organRect.left - stageRect.left + organRect.width / 2)
      const endY = Math.round(organRect.top - stageRect.top + organRect.height / 2)

      next[id] = { startX, startY, elbowX, elbowY, endX, endY }
    }

    setLeaderLines(next)
  }, [])

  useLayoutEffect(() => {
    recomputeLeaderLines()
    const t1 = setTimeout(recomputeLeaderLines, 90)
    const t2 = setTimeout(recomputeLeaderLines, 320)
    const t3 = setTimeout(recomputeLeaderLines, 550)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [recomputeLeaderLines, inspectorOpen, vitals, lang])

  useEffect(() => {
    const stageEl = stageRef.current
    if (!stageEl || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      recomputeLeaderLines()
    })
    ro.observe(stageEl)
    window.addEventListener('resize', recomputeLeaderLines)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recomputeLeaderLines)
    }
  }, [recomputeLeaderLines])

  const renderShockwaveRipples = (cx: number, cy: number, status: Status) => {
    if (status === 'ok') return null
    const color = status === 'crit' ? '#EF4444' : '#F59E0B'
    return (
      <g pointerEvents="none">
        {[0, 0.9, 1.8].map((delay, idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r="8"
            fill="none"
            stroke={color}
            strokeWidth={status === 'crit' ? '1.8' : '1.3'}
          >
            <animate
              attributeName="r"
              values="8;38"
              dur={status === 'crit' ? '2.1s' : '2.7s'}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.85;0"
              dur={status === 'crit' ? '2.1s' : '2.7s'}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>
    )
  }

  const renderRegionPod = (
    reg: AnatomyRegion,
    regStatus: Status,
    positionClass: string,
  ) => {
    const regVitals = getRegionVitals(vitals, reg.id)
    const active = isRegActive(reg.id)
    const isAbnormal = regStatus !== 'ok'

    const podBorder =
      regStatus === 'crit'
        ? 'border-rose-500/80 bg-[#1a0f14]/95 shadow-[0_0_24px_rgba(244,63,94,0.22)] hover:border-rose-400'
        : regStatus === 'warn'
          ? 'tag-pulse-warn border-amber-400/80 bg-[#181510]/95 hover:border-amber-300'
          : 'border-emerald-500/45 bg-[#0b1524]/95 hover:border-emerald-400/80 hover:shadow-[0_0_20px_rgba(16,185,129,0.16)]'

    return (
      <div
        key={reg.id}
        ref={(el) => {
          podRefs.current[reg.id] = el
        }}
        onClick={() => onSelectRegion(reg.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectRegion(reg.id)
          }
        }}
        className={`group absolute ${positionClass} z-20 w-[238px] rounded-xl border p-2.5 backdrop-blur-md transition-all duration-300 flex flex-col gap-1.5 cursor-pointer ${podBorder} ${
          active ? 'ring-2 ring-sky-400' : ''
        }`}
      >
        {/* Region Header */}
        <div className="flex items-center justify-between gap-1.5 text-left w-full border-b border-slate-800/90 pb-1.5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-100 truncate">
            <span>{regStatus === 'crit' ? '🚨' : regStatus === 'warn' ? '⚠️' : '🟢'}</span>
            <span className="truncate">{lang === 'EN' ? reg.shortLabel : reg.viShortLabel}</span>
          </span>
          <span
            className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
              regStatus === 'crit'
                ? 'bg-rose-500/20 text-rose-300'
                : regStatus === 'warn'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/15 text-emerald-300'
            }`}
          >
            {regStatus === 'crit' ? 'CRIT' : regStatus === 'warn' ? 'WARN' : 'OK'}
          </span>
        </div>

        {/* Integrated Vital Signs Cards for this Anatomical Region */}
        <div className="flex flex-col gap-1">
          {regVitals.map((v) => {
            const Icon = VITAL_ICONS[v.id]
            const fv = formatVitalDisplay(v, unitPrefs)
            const isVitalFocused = inspectorOpen && focusedVitalId === v.id
            const isPulsing = pulsingVitals.includes(v.id)
            const pulseClass = isPulsing
              ? v.status === 'crit'
                ? 'vital-pulse-crit'
                : v.status === 'warn'
                  ? 'vital-pulse-warn'
                  : 'vital-pulse-ok'
              : ''

            return (
              <button
                key={v.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectRegion(reg.id, v.id)
                }}
                aria-pressed={isVitalFocused}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border text-left transition-all ${pulseClass} ${
                  isVitalFocused
                    ? 'bg-sky-500/20 border-sky-400 text-sky-100'
                    : v.status === 'crit'
                      ? 'bg-rose-950/40 border-rose-500/60 hover:border-rose-400'
                      : v.status === 'warn'
                        ? 'bg-amber-950/25 border-amber-500/45 hover:border-amber-400'
                        : 'bg-[#0f1b2e]/90 border-slate-700/70 hover:border-sky-400/60'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-200 truncate">
                  <Icon
                    size={12}
                    className={
                      v.status === 'crit'
                        ? 'text-rose-400 flex-none'
                        : v.status === 'warn'
                          ? 'text-amber-400 flex-none'
                          : 'text-emerald-400 flex-none'
                    }
                    aria-hidden="true"
                  />
                  <span className="truncate">{lang === 'EN' ? v.title : v.viTitle}</span>
                </span>

                <span className="flex items-center gap-1.5 flex-none">
                  <span
                    className={`font-mono text-xs font-bold tabular-nums ${
                      v.status === 'crit'
                        ? 'text-rose-300'
                        : v.status === 'warn'
                          ? 'text-amber-300'
                          : 'text-slate-100'
                    }`}
                  >
                    {fv.displayValue}{' '}
                    <span className="text-[10px] font-normal text-slate-400">{fv.displayUnit}</span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Click Affordance Footer: Always visible on WARN/CRIT cards, smoothly revealed on hover for OK cards */}
        <div
          className={`flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80 text-[10px] font-mono font-semibold transition-all duration-200 ${
            isAbnormal
              ? regStatus === 'crit'
                ? 'opacity-100 text-rose-300'
                : 'opacity-100 text-amber-300'
              : active
                ? 'opacity-100 text-sky-300'
                : 'opacity-0 max-h-0 pt-0 border-t-0 overflow-hidden group-hover:opacity-100 group-hover:max-h-6 group-hover:pt-1 group-hover:border-t text-emerald-300'
          }`}
        >
          <span>
            {lang === 'EN'
              ? 'View 7-Day Chart & Protocol'
              : 'Xem biểu đồ 7 ngày & Phác đồ'}
          </span>
          <ArrowRight
            size={11}
            className="transition-transform duration-200 group-hover:translate-x-0.5 flex-none"
            aria-hidden="true"
          />
        </div>
      </div>
    )
  }

  return (
    <section
      className="panel !p-2 flex-1 relative overflow-hidden flex flex-col justify-between min-h-0 transition-all duration-500 ease-in-out"
      aria-label="Interactive 3D Bio-Telemetry Hologram"
    >
      {/* Full-Height 3D Volumetric Hologram Stage (Zero Duplicate Titles / Filter Tabs) */}
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 pb-14 flex items-center justify-center select-none rounded-xl bg-[#070b14] border border-slate-800/90 overflow-hidden"
      >
        {/* Optional floating Optical Scan button when top alert banner is hidden (all vitals OK) */}
        {showFloatingScanButton && (
          <button
            type="button"
            onClick={onRequestOpticalScan}
            className="absolute top-3 right-3 z-30 btn btn-outline-cyan !min-h-8 !px-3 !text-xs"
          >
            <ScanFace size={14} className="text-sky-400" aria-hidden="true" />
            <span>{lang === 'EN' ? 'Optical Biometric Scan' : 'Quét Sinh Trắc Học'}</span>
          </button>
        )}

        {/* Exact-Border SVG HUD Leader Lines Overlay (0.0px Gap from Pod Borders to 3D Organ Centers) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          aria-hidden="true"
        >
          <defs>
            <filter id="hud-line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {(
            [
              { id: 'brain' as const, status: brainStatus },
              { id: 'lungs' as const, status: lungsStatus },
              { id: 'heart' as const, status: heartStatus },
              { id: 'circulatory' as const, status: circStatus },
            ]
          ).map(({ id, status }) => {
            const coords = leaderLines[id]
            const color = strokeFor(status, isRegActive(id))
            return (
              <g key={id} filter="url(#hud-line-glow)">
                <polyline
                  points={`${coords.startX},${coords.startY} ${coords.elbowX},${coords.elbowY} ${coords.endX},${coords.endY}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={isRegActive(id) ? '2.2' : '1.75'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Animated energy pulse traveling from organ to telemetry pod */}
                <polyline
                  points={`${coords.endX},${coords.endY} ${coords.elbowX},${coords.elbowY} ${coords.startX},${coords.startY}`}
                  fill="none"
                  stroke="#E0F2FE"
                  strokeWidth="1.5"
                  strokeDasharray="5 22"
                  strokeLinecap="round"
                  opacity="0.75"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="27"
                    to="0"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </polyline>
                {/* Border-Docked Anchor Terminal (Flush against card edge) */}
                <circle
                  cx={coords.startX}
                  cy={coords.startY}
                  r="4"
                  fill={color}
                  stroke="#070b14"
                  strokeWidth="1.5"
                />
                <circle cx={coords.elbowX} cy={coords.elbowY} r="2.2" fill={color} />
              </g>
            )
          })}
        </svg>

        {/* Central 3D X-Ray Volumetric Hologram Figure + Holo-Pedestal */}
        <div className="relative w-full h-full max-w-[960px] flex items-center justify-center">
          <svg
            viewBox="0 0 680 440"
            className="w-full h-full block"
            role="img"
            aria-label="3D volumetric anatomical hologram with real-time beating heart, breathing lungs, neural-vascular energy flow, and interactive organ zones"
          >
            <defs>
              <pattern id="holo-space-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#1e293b" strokeWidth="0.55" opacity="0.45" />
              </pattern>

              <radialGradient id="holo-stage-aura" cx="50%" cy="46%" r="52%">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.22" />
                <stop offset="45%" stopColor="#0369a1" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#050811" stopOpacity="0.98" />
              </radialGradient>

              {/* True Luminance-to-Alpha Key Filter: Converts pure black background of the 3D X-Ray into 100% alpha transparency */}
              <filter id="xray-transparent-key" colorInterpolationFilters="sRGB">
                <feColorMatrix
                  type="matrix"
                  values="
                    1.15 0    0    0 0
                    0    1.18 0    0 0
                    0    0    1.28 0 0
                    0.25 0.70 1.00 0 -0.03
                  "
                />
              </filter>

              {/* Upward Hologram Projection Beam Gradient */}
              <linearGradient id="holo-pedestal-beam" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                <stop offset="35%" stopColor="#0ea5e9" stopOpacity="0.09" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
              </linearGradient>

              <radialGradient id="pedestal-floor-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.58" />
                <stop offset="55%" stopColor="#0284c7" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#050811" stopOpacity="0" />
              </radialGradient>

              {/* Subtle Organ Bioluminescent Radial Gradients (Preserves 100% of 3D X-Ray detail underneath) */}
              <radialGradient id="organ-aura-ok" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                <stop offset="65%" stopColor="#059669" stopOpacity="0.07" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="organ-aura-warn" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
                <stop offset="65%" stopColor="#d97706" stopOpacity="0.09" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="organ-aura-crit" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.36" />
                <stop offset="65%" stopColor="#dc2626" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="organ-aura-cyan" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
                <stop offset="65%" stopColor="#0284c7" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </radialGradient>

              <filter id="organ-glow-ok" x="-35%" y="-35%" width="170%" height="170%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="organ-glow-warn" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="organ-glow-crit" x="-55%" y="-55%" width="210%" height="210%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="organ-glow-cyan" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background Space Telemetry Grid & Radial Hologram Aura */}
            <rect width="680" height="440" fill="#04070f" />
            <rect width="680" height="440" fill="url(#holo-space-grid)" />
            <rect width="680" height="440" fill="url(#holo-stage-aura)" />

            {/* Subtle Orbital Calibration Rings */}
            <circle cx="340" cy="204" r="182" fill="none" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="3 7" opacity="0.55" />
            <circle cx="340" cy="204" r="132" fill="none" stroke="#0ea5e9" strokeWidth="0.55" strokeOpacity="0.18" />

            {/* ====================================================================
                3D PERSPECTIVE HOLO-PEDESTAL (Under Astronaut's Feet + Upward Projection Cone)
               ==================================================================== */}
            <g transform="translate(340, 405)" pointerEvents="none">
              {/* Upward Volumetric Light Cone projecting from pedestal to 3D X-Ray body */}
              <polygon
                points="-112,6 112,6 76,-360 -76,-360"
                fill="url(#holo-pedestal-beam)"
              />

              {/* Radial Floor Glow */}
              <ellipse cx="0" cy="4" rx="125" ry="25" fill="url(#pedestal-floor-glow)" />

              {/* Outer 3D Perspective Radar Ring */}
              <ellipse
                cx="0"
                cy="4"
                rx="108"
                ry="20"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.4"
                strokeOpacity="0.62"
                strokeDasharray="14 8 4 8"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="68"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </ellipse>

              {/* Middle Rotating 3D Elliptical Ring */}
              <ellipse
                cx="0"
                cy="4"
                rx="78"
                ry="14"
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="1.2"
                strokeOpacity="0.78"
                strokeDasharray="22 10"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="64"
                  to="0"
                  dur="3.2s"
                  repeatCount="indefinite"
                />
              </ellipse>

              {/* Inner High-Intensity Emitter Ring */}
              <ellipse
                cx="0"
                cy="4"
                rx="44"
                ry="8"
                fill="rgba(56, 189, 248, 0.16)"
                stroke="#7dd3fc"
                strokeWidth="1.5"
              />
            </g>

            {/* ====================================================================
                HIGH-RESOLUTION 3D X-RAY TRANSLUCENT ANATOMICAL HOLOGRAM
                Uses /assets/aistudio/image_a3402877.png with true alpha transparency key
               ==================================================================== */}
            <g>
              {/* Soft Volumetric Outer Glow Behind the 3D X-Ray Body */}
              <image
                href="/assets/aistudio/image_a3402877.png"
                x="181"
                y="2"
                width="318"
                height="424"
                preserveAspectRatio="xMidYMid meet"
                filter="url(#xray-transparent-key)"
                opacity="0.28"
                style={{
                  filter: 'blur(5px) brightness(1.3)',
                }}
                pointerEvents="none"
              >
                <animate
                  attributeName="opacity"
                  values="0.20;0.36;0.20"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </image>

              {/* Crisp High-Detail 3D X-Ray Anatomical Hologram */}
              <image
                href="/assets/aistudio/image_a3402877.png"
                x="181"
                y="2"
                width="318"
                height="424"
                preserveAspectRatio="xMidYMid meet"
                filter="url(#xray-transparent-key)"
                className="cursor-pointer"
                onClick={() => onSelectRegion('circulatory')}
              />
            </g>

            {/* ====================================================================
                REAL-TIME NEURAL & VASCULAR ENERGY IMPULSES OVER 3D X-RAY BODY
               ==================================================================== */}
            <g pointerEvents="none" opacity="0.65">
              <g
                stroke="#bae6fd"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="3 22"
              >
                {/* Carotid Neural Pathways: Heart (346,131) -> Brain (340,49) */}
                <path d="M342 126 C337 104 336 82 336 52">
                  <animate attributeName="stroke-dashoffset" from="50" to="0" dur="1.2s" repeatCount="indefinite" />
                </path>
                <path d="M348 126 C346 104 345 82 344 52">
                  <animate attributeName="stroke-dashoffset" from="50" to="0" dur="1.4s" repeatCount="indefinite" />
                </path>
                {/* Descending Aorta & Femoral Pathways: Heart -> Viscera (340,178) -> Legs */}
                <path d="M345 140 C342 162 340 178 340 208 L322 288 L316 368">
                  <animate attributeName="stroke-dashoffset" from="75" to="0" dur="1.65s" repeatCount="indefinite" />
                </path>
                <path d="M340 208 L358 288 L364 368">
                  <animate attributeName="stroke-dashoffset" from="75" to="0" dur="1.65s" repeatCount="indefinite" />
                </path>
                {/* Subclavian / Brachial Pathways into Arms */}
                <path d="M332 114 C304 114 288 142 268 198">
                  <animate attributeName="stroke-dashoffset" from="50" to="0" dur="1.5s" repeatCount="indefinite" />
                </path>
                <path d="M348 114 C376 114 392 142 412 198">
                  <animate attributeName="stroke-dashoffset" from="50" to="0" dur="1.5s" repeatCount="indefinite" />
                </path>
              </g>
            </g>

            {/* ====================================================================
                INTERACTIVE 3D ORGAN ZONES ALIGNED TO THE 3D X-RAY ANATOMY
                (Refined translucent HUD reticles so 100% of internal X-Ray anatomy stays sharp)
               ==================================================================== */}

            {/* ORGAN 4: SYSTEMIC / METABOLIC CORE (Liver, Stomach & Abdominal Viscera at 340, 178) */}
            {renderShockwaveRipples(340, 178, circStatus)}
            <g
              onClick={() => onSelectRegion('circulatory')}
              className="cursor-pointer"
              filter={filterAttrFor(circStatus, isRegActive('circulatory'))}
            >
              <ellipse
                cx="340"
                cy="178"
                rx="26"
                ry="18"
                fill={
                  circStatus === 'crit'
                    ? 'url(#organ-aura-crit)'
                    : circStatus === 'warn'
                      ? 'url(#organ-aura-warn)'
                      : isRegActive('circulatory')
                        ? 'url(#organ-aura-cyan)'
                        : 'url(#organ-aura-ok)'
                }
              />
              <circle
                cx="340"
                cy="178"
                r="10"
                fill="none"
                stroke={strokeFor(circStatus, isRegActive('circulatory'))}
                strokeWidth={isRegActive('circulatory') ? '1.6' : '1.1'}
                strokeDasharray="3 3"
                opacity="0.85"
              />
              <circle
                ref={(el) => {
                  organAnchorRefs.current.circulatory = el
                }}
                cx="340"
                cy="178"
                r={isRegActive('circulatory') ? '4.8' : '3.8'}
                fill={circStatus === 'ok' ? '#10B981' : circStatus === 'crit' ? '#EF4444' : '#F59E0B'}
                stroke="#04070f"
                strokeWidth="1.4"
              />
            </g>

            {/* ORGAN 3: 3D PULMONARY / LUNGS (4.0s Respiratory Breathing Glow at 324, 125 & 356, 125) */}
            {renderShockwaveRipples(324, 125, lungsStatus)}
            <g
              onClick={() => onSelectRegion('lungs')}
              className="cursor-pointer"
              filter={filterAttrFor(lungsStatus, isRegActive('lungs'))}
            >
              <g
                style={{
                  transformOrigin: '340px 125px',
                  animation: 'holoLungBreathe 4s ease-in-out infinite',
                }}
              >
                <ellipse
                  cx="324"
                  cy="125"
                  rx="14"
                  ry="22"
                  fill={
                    lungsStatus === 'crit'
                      ? 'url(#organ-aura-crit)'
                      : lungsStatus === 'warn'
                        ? 'url(#organ-aura-warn)'
                        : isRegActive('lungs')
                          ? 'url(#organ-aura-cyan)'
                          : 'url(#organ-aura-ok)'
                  }
                />
                <ellipse
                  cx="356"
                  cy="125"
                  rx="14"
                  ry="22"
                  fill={
                    lungsStatus === 'crit'
                      ? 'url(#organ-aura-crit)'
                      : lungsStatus === 'warn'
                        ? 'url(#organ-aura-warn)'
                        : isRegActive('lungs')
                          ? 'url(#organ-aura-cyan)'
                          : 'url(#organ-aura-ok)'
                  }
                />
                <circle
                  cx="324"
                  cy="125"
                  r="9.5"
                  fill="none"
                  stroke={strokeFor(lungsStatus, isRegActive('lungs'))}
                  strokeWidth={isRegActive('lungs') ? '1.6' : '1.1'}
                  strokeDasharray="3 3"
                  opacity="0.82"
                />
              </g>

              <circle
                ref={(el) => {
                  organAnchorRefs.current.lungs = el
                }}
                cx="324"
                cy="125"
                r={isRegActive('lungs') ? '4.8' : '3.8'}
                fill={lungsStatus === 'ok' ? '#10B981' : lungsStatus === 'crit' ? '#EF4444' : '#F59E0B'}
                stroke="#04070f"
                strokeWidth="1.4"
              />
            </g>

            {/* ORGAN 2: 3D CARDIAC HEART (Beats at exact real-time BPM: 60/HR sec at 346, 131) */}
            {renderShockwaveRipples(346, 131, heartStatus)}
            <g
              onClick={() => onSelectRegion('heart')}
              className="cursor-pointer"
              filter={filterAttrFor(heartStatus, isRegActive('heart'))}
            >
              <g
                data-testid="holo-3d-heart"
                data-beat-duration={`${heartBeatSec}s`}
                style={{
                  transformOrigin: '346px 131px',
                  animation: `holoHeartBeat ${heartBeatSec}s cubic-bezier(0.25, 1, 0.5, 1) infinite`,
                }}
              >
                <circle
                  cx="346"
                  cy="131"
                  r="15"
                  fill={
                    heartStatus === 'crit'
                      ? 'url(#organ-aura-crit)'
                      : heartStatus === 'warn'
                        ? 'url(#organ-aura-warn)'
                        : 'url(#organ-aura-ok)'
                  }
                />
                <circle
                  cx="346"
                  cy="131"
                  r="9.5"
                  fill="none"
                  stroke={strokeFor(heartStatus, isRegActive('heart'))}
                  strokeWidth={isRegActive('heart') ? '1.8' : '1.3'}
                  strokeDasharray="4 2"
                />
              </g>

              <circle
                ref={(el) => {
                  organAnchorRefs.current.heart = el
                }}
                cx="346"
                cy="131"
                r="3.8"
                fill={heartStatus === 'ok' ? '#10B981' : heartStatus === 'crit' ? '#EF4444' : '#FCD34D'}
                stroke="#04070f"
                strokeWidth="1.3"
              />
            </g>

            {/* ORGAN 1: 3D NEURO / BRAIN CORTEX (At Cranium Center 340, 49) */}
            {renderShockwaveRipples(340, 49, brainStatus)}
            <g
              onClick={() => onSelectRegion('brain')}
              className="cursor-pointer"
              filter={filterAttrFor(brainStatus, isRegActive('brain'))}
            >
              <circle
                cx="340"
                cy="49"
                r="16"
                fill={
                  brainStatus === 'crit'
                    ? 'url(#organ-aura-crit)'
                    : brainStatus === 'warn'
                      ? 'url(#organ-aura-warn)'
                      : isRegActive('brain')
                        ? 'url(#organ-aura-cyan)'
                        : 'url(#organ-aura-ok)'
                }
              />
              <circle
                cx="340"
                cy="49"
                r="10"
                fill="none"
                stroke={strokeFor(brainStatus, isRegActive('brain'))}
                strokeWidth={isRegActive('brain') ? '1.8' : '1.3'}
                strokeDasharray="4 2"
                opacity="0.88"
              />
              <circle
                ref={(el) => {
                  organAnchorRefs.current.brain = el
                }}
                cx="340"
                cy="49"
                r="3.8"
                fill={brainStatus === 'ok' ? '#10B981' : brainStatus === 'crit' ? '#EF4444' : '#FCD34D'}
                stroke="#04070f"
                strokeWidth="1.3"
              />
            </g>
          </svg>

          {/* 4 Integrated Anatomical Telemetry Pods (Housing all 8 Vital Signs + Click Affordance) */}
          {renderRegionPod(brainReg, brainStatus, 'left-3 top-3')}
          {renderRegionPod(lungsReg, lungsStatus, 'left-3 top-[54%]')}
          {renderRegionPod(heartReg, heartStatus, 'right-3 top-3')}
          {renderRegionPod(circReg, circStatus, 'right-3 top-[54%]')}
        </div>
      </div>
    </section>
  )
}
