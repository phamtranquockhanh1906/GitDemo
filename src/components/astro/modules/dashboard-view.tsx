import {
  Activity,
  Brain,
  Droplets,
  FlaskConical,
  Gauge,
  HeartPulse,
  Moon,
  Pencil,
  ScanFace,
  Stethoscope,
  Thermometer,
  Volume2,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  ANATOMY_REGIONS,
  DEFAULT_UNIT_PREFS,
  STATUS_COLOR,
  TREND_DATA,
  applyAgentVitalsToState,
  applyVoiceVitalUpdate,
  buildSmartAiAlertBannerSummary,
  computeRegionStatus,
  formatVitalDisplay,
  getRegionVitals,
  vitalsToAgentPayload,
  type AnatomyRegionId,
  type AstroAgentResponse,
  type DynamicSurgeonNote,
  type Lang,
  type UiActionType,
  type UnitPrefs,
  type Vital,
  type VitalId,
} from '@/lib/astro-data'
import type { Notify } from '../app-shell'
import { InteractiveBodyModel } from '../body-model'
import { LineChart } from '../charts'
import {
  FloatingVoiceCommandDock,
  OpticalBiometricScanner,
  type FaceScanResult,
} from '../multimodal-ai-hub'
import type { ModuleId } from '../sidebar'
import { StatusBadge } from '../ui'

const ICONS: Record<VitalId, LucideIcon> = {
  hr: HeartPulse,
  bp: Gauge,
  spo2: Droplets,
  temp: Thermometer,
  sleep: Moon,
  hrv: Activity,
  stress: Brain,
  glu: FlaskConical,
}

const UI_ACTION_TO_REGION: Partial<Record<UiActionType, AnatomyRegionId>> = {
  OPEN_BRAIN: 'brain',
  OPEN_HEART: 'heart',
  OPEN_LUNGS: 'lungs',
  OPEN_SYSTEMIC: 'circulatory',
}

const UI_ACTION_TO_MODULE: Partial<Record<UiActionType, ModuleId>> = {
  NAV_DASHBOARD: 'dashboard',
  NAV_MONITORING: 'monitoring',
  NAV_ANALYTICS: 'analytics',
  NAV_AI_ASSESSMENT: 'ai',
  NAV_MISSIONS: 'missions',
  NAV_PROFILE: 'profile',
}

export type ExternalDashboardAction = {
  openInspectorRegion?: AnatomyRegionId | 'CLOSE' | 'NONE'
  triggerOpticalScan?: boolean
  seq: number
}

type DashboardProps = {
  lang: Lang
  vitals: Vital[]
  unitPrefs?: UnitPrefs
  dynamicNotes?: Partial<Record<AnatomyRegionId, DynamicSurgeonNote>>
  onUpdateDynamicNotes?: Dispatch<SetStateAction<Partial<Record<AnatomyRegionId, DynamicSurgeonNote>>>>
  onUpdateVitals: Dispatch<SetStateAction<Vital[]>>
  notify: Notify
  onNavigate: (id: ModuleId, metricId?: VitalId) => void
  onExecuteCountermeasure: (regionId: AnatomyRegionId) => void
  externalDashboardAction?: ExternalDashboardAction | null
}

export function DashboardView({
  lang,
  vitals,
  unitPrefs = DEFAULT_UNIT_PREFS,
  dynamicNotes = {},
  onUpdateDynamicNotes,
  onUpdateVitals,
  notify,
  onNavigate,
  onExecuteCountermeasure,
  externalDashboardAction,
}: DashboardProps) {
  // Progressive Disclosure: Inspector and On-Demand Optical Scanner are CLOSED by default
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<AnatomyRegionId>('heart')
  const [focusedVitalId, setFocusedVitalId] = useState<VitalId>('hrv')
  const [filterMode, setFilterMode] = useState<'all' | 'warn'>('all')
  const [speakingBriefing, setSpeakingBriefing] = useState(false)
  const [isProcessingAi, setIsProcessingAi] = useState(false)
  const [externalScanTrigger, setExternalScanTrigger] = useState(0)
  const [pulsingVitals, setPulsingVitals] = useState<VitalId[]>([])
  const [localNotes, setLocalNotes] = useState<Partial<Record<AnatomyRegionId, DynamicSurgeonNote>>>({})

  const effectiveNotes = Object.keys(dynamicNotes).length > 0 ? dynamicNotes : localNotes

  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const captureFrameRef = useRef<(() => string | null) | null>(null)

  const [lastSpokenCommand, setLastSpokenCommand] = useState<string>(
    lang === 'EN' ? 'Ready — Click Mic or "Voice Commands"' : 'Sẵn sàng — Bấm Mic hoặc "Gợi ý câu lệnh Voice"',
  )
  const [aiResponseText, setAiResponseText] = useState<string>(
    lang === 'EN'
      ? 'Say "Sleep 8 hours", "Heart rate 95", "Open brain", or describe symptoms.'
      : 'Hãy nói "Ngủ 8 tiếng", "Nhịp tim 95", "Mở vùng não", hoặc mô tả triệu chứng.',
  )

  useEffect(() => {
    setLastSpokenCommand((prev) => {
      if (prev.startsWith('Ready —') || prev.startsWith('Sẵn sàng —')) {
        return lang === 'EN'
          ? 'Ready — Click Mic or "Voice Commands"'
          : 'Sẵn sàng — Bấm Mic hoặc "Gợi ý câu lệnh Voice"'
      }
      return prev
    })
    setAiResponseText((prev) => {
      if (prev.startsWith('Say "Sleep 8 hours"') || prev.startsWith('Hãy nói "Ngủ 8 tiếng"')) {
        return lang === 'EN'
          ? 'Say "Sleep 8 hours", "Heart rate 95", "Open brain", or describe symptoms.'
          : 'Hãy nói "Ngủ 8 tiếng", "Nhịp tim 95", "Mở vùng não", hoặc mô tả triệu chứng.'
      }
      return prev
    })
  }, [lang])

  const registerFrameCapture = useCallback((fn: () => string | null) => {
    captureFrameRef.current = fn
  }, [])

  const triggerVitalPulse = useCallback((ids: VitalId[]) => {
    if (ids.length === 0) return
    setPulsingVitals(ids)
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    pulseTimerRef.current = setTimeout(() => {
      setPulsingVitals([])
    }, 2400)
  }, [])

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    }
  }, [])

  const speakSingleReply = useCallback(
    (replyText: string) => {
      setAiResponseText(replyText)
      setSpeakingBriefing(true)

      const isViText =
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
          replyText,
        ) || lang === 'VI'

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(replyText)
          utterance.lang = isViText ? 'vi-VN' : 'en-US'
          utterance.rate = 1.04
          utterance.onend = () => setSpeakingBriefing(false)
          utterance.onerror = () => setSpeakingBriefing(false)
          window.speechSynthesis.speak(utterance)
          setTimeout(() => setSpeakingBriefing(false), 3200)
          return
        } catch {
          // Fallback timer
        }
      }
      setTimeout(() => setSpeakingBriefing(false), 2600)
    },
    [lang],
  )

  const region = ANATOMY_REGIONS.find((r) => r.id === selectedRegion) ?? ANATOMY_REGIONS[1]
  const regionVitals = getRegionVitals(vitals, selectedRegion)
  const regionStatus = computeRegionStatus(vitals, selectedRegion)

  const focusedVital =
    regionVitals.find((v) => v.id === focusedVitalId) ??
    regionVitals[0] ??
    vitals[0]

  const handleOpenInspectorForRegion = useCallback(
    (regionId: AnatomyRegionId, preferredVitalId?: VitalId, sourceVitals: Vital[] = vitals) => {
      setSelectedRegion(regionId)
      setInspectorOpen(true)
      const rv = getRegionVitals(sourceVitals, regionId)
      if (preferredVitalId && rv.some((v) => v.id === preferredVitalId)) {
        setFocusedVitalId(preferredVitalId)
      } else {
        const warnVital = rv.find((v) => v.status !== 'ok')
        setFocusedVitalId((warnVital ?? rv[0])?.id ?? 'hrv')
      }
    },
    [vitals],
  )

  const handleRequestOpticalScan = useCallback(() => {
    setScannerOpen(true)
    setExternalScanTrigger((c) => c + 1)
  }, [])

  const handleFaceScanComplete = useCallback(
    (result: FaceScanResult) => {
      onUpdateVitals((prev) => {
        const step1 = applyVoiceVitalUpdate(prev, 'stress', result.stressLevel, false).vitals
        const step2 = result.estimatedHr
          ? applyVoiceVitalUpdate(step1, 'hr', String(result.estimatedHr), false).vitals
          : step1
        return step2
      })
      triggerVitalPulse(['stress', 'hr'])
      setLastSpokenCommand(lang === 'EN' ? '[Optical Biometric Scan]' : '[Quét Sinh Trắc Học Khuôn Mặt]')
      const msg =
        lang === 'EN'
          ? result.spokenSummaryEn ||
            `Optical scan complete: Blink rate ${result.blinkRate}/m, facial fatigue ${result.fatigueEn.toLowerCase()}, estimated HR ${result.estimatedHr} bpm. Stress level updated to ${result.stressLevel}/10.`
          : result.spokenSummaryVi ||
            `Hoàn tất quét khuôn mặt: Chớp mắt ${result.blinkRate} lần/phút, mệt mỏi cơ mặt ${result.fatigueVi.toLowerCase()}, nhịp tim ước tính ${result.estimatedHr} bpm. Đã cập nhật mức căng thẳng xuống ${result.stressLevel}/10.`
      speakSingleReply(msg)
    },
    [lang, onUpdateVitals, speakSingleReply, triggerVitalPulse],
  )

  const applyAstroAgentResponse = useCallback(
    (agentRes: AstroAgentResponse) => {
      let nextVitalsSnapshot = vitals
      let changedVitalIds: VitalId[] = []

      if (agentRes.updatedVitals) {
        const applied = applyAgentVitalsToState(vitals, agentRes.updatedVitals)
        nextVitalsSnapshot = applied.vitals
        changedVitalIds = applied.changedIds
        if (changedVitalIds.length > 0) {
          onUpdateVitals(applied.vitals)
          triggerVitalPulse(changedVitalIds)
          setFocusedVitalId(changedVitalIds[0])
        }
      }

      const targetModuleFromAction = UI_ACTION_TO_MODULE[agentRes.uiAction]
      const targetRegionFromAction = UI_ACTION_TO_REGION[agentRes.uiAction]
      const targetRegionForNote: AnatomyRegionId =
        targetRegionFromAction ??
        (changedVitalIds.length > 0
          ? nextVitalsSnapshot.find((v) => v.id === changedVitalIds[0])?.regionId ?? selectedRegion
          : selectedRegion)

      if (
        agentRes.dynamicSurgeonNote?.cause &&
        agentRes.dynamicSurgeonNote?.countermeasure
      ) {
        const updater = (prev: Partial<Record<AnatomyRegionId, DynamicSurgeonNote>>) => ({
          ...prev,
          [targetRegionForNote]: agentRes.dynamicSurgeonNote,
        })
        setLocalNotes(updater)
        onUpdateDynamicNotes?.(updater)
      }

      if (targetModuleFromAction && targetModuleFromAction !== 'dashboard') {
        onNavigate(targetModuleFromAction)
      } else if (targetRegionFromAction) {
        handleOpenInspectorForRegion(
          targetRegionFromAction,
          changedVitalIds[0],
          nextVitalsSnapshot,
        )
      } else if (agentRes.uiAction === 'CLOSE_PANEL') {
        setInspectorOpen(false)
      } else if (agentRes.uiAction === 'SCAN_FACE') {
        handleRequestOpticalScan()
      }

      if (agentRes.spokenReply) {
        speakSingleReply(agentRes.spokenReply)
        const hasDangerousChange = changedVitalIds.some((id) => {
          const st = nextVitalsSnapshot.find((v) => v.id === id)?.status
          return st === 'warn' || st === 'crit'
        })
        if (hasDangerousChange) {
          notify(agentRes.spokenReply, 'crit')
        }
      }
    },
    [
      handleOpenInspectorForRegion,
      handleRequestOpticalScan,
      notify,
      onNavigate,
      onUpdateDynamicNotes,
      onUpdateVitals,
      selectedRegion,
      speakSingleReply,
      triggerVitalPulse,
      vitals,
    ],
  )

  // Sync with Global Multimodal Audio AI when it opens an organ region or triggers optical scan
  useEffect(() => {
    if (!externalDashboardAction) return
    if (externalDashboardAction.triggerOpticalScan) {
      setScannerOpen(true)
      setExternalScanTrigger((c) => c + 1)
    }
    if (
      externalDashboardAction.openInspectorRegion &&
      externalDashboardAction.openInspectorRegion !== 'NONE'
    ) {
      if (externalDashboardAction.openInspectorRegion === 'CLOSE') {
        setInspectorOpen(false)
      } else {
        const regId = externalDashboardAction.openInspectorRegion
        const reg = ANATOMY_REGIONS.find((r) => r.id === regId)
        if (reg) {
          setSelectedRegion(regId)
          setFocusedVitalId(reg.metricIds[0])
          setInspectorOpen(true)
        }
      }
    }
  }, [externalDashboardAction])

  const handleExecuteVoiceCommand = useCallback(
    async (
      rawText: string,
      audioBase64?: string,
      mimeType?: 'audio/webm' | 'audio/mp4' | 'audio/ogg',
    ) => {
      setLastSpokenCommand(`"${rawText}"`)
      setIsProcessingAi(true)
      const webcamBase64 = captureFrameRef.current ? captureFrameRef.current() : null
      const currentVitalsPayload = vitalsToAgentPayload(vitals)

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000)
        const res = await fetch('/api/astro-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            transcript: rawText,
            audioBase64,
            mimeType,
            currentVitals: currentVitalsPayload,
            webcamBase64,
            lang,
          }),
        })
        clearTimeout(timeoutId)

        if (res.ok) {
          const data = (await res.json()) as AstroAgentResponse
          applyAstroAgentResponse(data)
        }
      } catch {
        // Ignore transient network errors
      } finally {
        setIsProcessingAi(false)
      }
    },
    [applyAstroAgentResponse, lang, vitals],
  )

  const abnormalVitals = vitals.filter((v) => v.status === 'warn' || v.status === 'crit')
  const hasCritical = abnormalVitals.some((v) => v.status === 'crit')
  const anyWarning = abnormalVitals.length > 0
  const smartAlert = buildSmartAiAlertBannerSummary(vitals, lang)

  const speakAiBriefing = () => {
    if (!anyWarning) return
    const summaryEn = abnormalVitals
      .map((v) => `${v.title} is ${v.value} ${v.unit}`)
      .join(', ')
    const summaryVi = abnormalVitals
      .map((v) => `${v.viTitle} ở mức ${v.value} ${v.unit}`)
      .join(', ')

    const msg =
      lang === 'EN'
        ? `ASTRO AI Telemetry Alert Briefing: ${summaryEn}. Recommend 15-minute vagal breathing protocol and immediate countermeasure execution.`
        : `Bản tin Cảnh báo ASTRO AI: ${summaryVi}. Khuyến nghị thực hiện 15 phút thở phế vị và kích hoạt phác đồ xử lý ngay.`
    speakSingleReply(msg)
  }

  const nums = focusedVital.series
  const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
  const mn = Math.min(...nums, focusedVital.baseline)
  const mx = Math.max(...nums, focusedVital.baseline)
  const pad = (mx - mn) * 0.3 || 1
  const FocusedIcon = ICONS[focusedVital.id]
  const focusedFormatted = formatVitalDisplay(focusedVital, unitPrefs)

  const activeNote = effectiveNotes[region.id]
  const displayCause = activeNote?.cause ?? (lang === 'EN' ? region.cause : region.viCause)
  const displayCountermeasure =
    activeNote?.countermeasure ?? (lang === 'EN' ? region.countermeasure : region.viCountermeasure)

  return (
    <div className="dash h-full overflow-hidden">
      {/* 1. Streamlined Top Warning Banner — 1-Line Smart AI Insight + [ 📷 Quét Sinh Trắc Học ] & [ 🔊 Nghe Bản tin AI ] */}
      {anyWarning && (
        <section
          className={`hero !py-1.5 !px-3.5 flex items-center justify-between gap-3 flex-none transition-all duration-300 ${
            hasCritical ? '!border-rose-500/60 !bg-rose-950/35' : ''
          }`}
          aria-label="Autonomic fatigue warning banner"
        >
          <button
            type="button"
            onClick={() =>
              handleOpenInspectorForRegion(smartAlert.primaryRegionId, smartAlert.primaryVitalId)
            }
            className={`text-left text-xs md:text-[13px] font-semibold truncate hover:underline transition-colors min-w-0 flex-1 ${
              hasCritical ? 'text-rose-200' : 'text-amber-200'
            }`}
          >
            {smartAlert.text}
          </button>

          <div className="flex items-center gap-2 flex-none">
            <button
              type="button"
              onClick={handleRequestOpticalScan}
              className="btn btn-outline-cyan !min-h-8 !px-3 !text-xs flex-none"
            >
              <ScanFace size={14} className="text-sky-400" aria-hidden="true" />
              <span>{lang === 'EN' ? 'Optical Biometric Scan' : 'Quét Sinh Trắc Học'}</span>
            </button>

            <button
              type="button"
              onClick={speakAiBriefing}
              aria-pressed={speakingBriefing}
              className="btn btn-outline-cyan !min-h-8 !px-3 !text-xs flex-none"
            >
              <Volume2
                size={14}
                className={speakingBriefing ? 'animate-pulse text-sky-300' : ''}
                aria-hidden="true"
              />
              <span>{lang === 'EN' ? 'Listen to AI Briefing' : 'Nghe Bản tin AI'}</span>
            </button>
          </div>
        </section>
      )}

      {/* 2. Progressive Disclosure Dynamic Workspace (Zero-Scroll 100vh) */}
      <div className="dash-workspace">
        {/* MAIN CENTER STAGE: 3D Volumetric Hologram Body Model + Single-Row Voice Command Dock */}
        <div className="relative flex-1 min-w-0 min-h-0 flex flex-col transition-all duration-500 ease-in-out">
          <InteractiveBodyModel
            lang={lang}
            vitals={vitals}
            unitPrefs={unitPrefs}
            selectedRegion={selectedRegion}
            focusedVitalId={focusedVital.id}
            pulsingVitals={pulsingVitals}
            inspectorOpen={inspectorOpen}
            onSelectRegion={(id, vid) => handleOpenInspectorForRegion(id, vid)}
            onRequestOpticalScan={handleRequestOpticalScan}
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            showFloatingScanButton={!anyWarning}
          />

          <FloatingVoiceCommandDock
            lang={lang}
            isProcessingAi={isProcessingAi}
            isSpeakingExternal={speakingBriefing}
            lastSpokenCommand={lastSpokenCommand}
            aiResponseText={aiResponseText}
            onExecuteVoiceCommand={handleExecuteVoiceCommand}
          />
        </div>

        {/* RIGHT COLUMN: Progressive Disclosure Slide-Over ANATOMICAL INSPECTOR */}
        <div
          className={`transition-all duration-500 ease-in-out flex flex-col min-h-0 overflow-hidden ${
            inspectorOpen
              ? 'w-[410px] ml-3 opacity-100 translate-x-0 flex-none'
              : 'w-0 ml-0 opacity-0 translate-x-10 pointer-events-none flex-none'
          }`}
          aria-hidden={!inspectorOpen}
        >
          <section
            key={region.id}
            className="panel w-[410px] h-full flex flex-col justify-between gap-2.5 border-sky-500/40 min-h-0 overflow-hidden"
            aria-live="polite"
            aria-label="Anatomical Inspector"
          >
            {/* Inspector Header with [ ✕ Close / Đóng ] button */}
            <div className="border-b border-slate-800 pb-2 flex-none">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow text-sky-400">ANATOMICAL INSPECTOR</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={regionStatus} />
                  <button
                    type="button"
                    onClick={() => setInspectorOpen(false)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-600/80 px-2.5 py-1 text-xs font-semibold text-slate-200 transition-colors"
                    aria-label={lang === 'EN' ? 'Close Inspector' : 'Đóng bảng chi tiết'}
                  >
                    <X size={13} aria-hidden="true" />
                    <span>{lang === 'EN' ? 'Close' : 'Đóng'}</span>
                  </button>
                </div>
              </div>
              <h2 className="text-base font-bold text-slate-100 mt-0.5">
                {lang === 'EN' ? region.name : region.viName}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {lang === 'EN' ? region.subtitle : region.viSubtitle}
              </p>
            </div>

            {/* 1 Horizontal Row of Compact Selectable Metric Tabs */}
            <div
              className="grid gap-1.5 flex-none"
              style={{ gridTemplateColumns: `repeat(${regionVitals.length}, minmax(0, 1fr))` }}
              role="tablist"
              aria-label="Organ telemetry tabs"
            >
              {regionVitals.map((v) => {
                const active = focusedVital.id === v.id
                const fv = formatVitalDisplay(v, unitPrefs)
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFocusedVitalId(v.id)}
                    className={`px-2.5 py-2 rounded-lg border font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap truncate ${
                      active
                        ? 'bg-sky-500/20 border-sky-400 text-sky-100 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.45)]'
                        : v.status === 'warn'
                          ? 'bg-amber-500/10 border-amber-500/45 text-amber-200 hover:border-amber-400'
                          : 'bg-[#192338] border-slate-700/80 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    <span>{v.status === 'warn' ? '⚠️' : '🟢'}</span>
                    <span className="truncate">
                      {v.shortTitle}: {fv.displayValue}
                      {v.id === 'bp' ? '' : ` ${fv.displayUnit}`}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 7-Day Trend Chart for Focused Metric */}
            <div className="rounded-xl border border-slate-800 bg-[#0d1424] p-3 flex flex-col justify-between gap-2 flex-1 min-h-0">
              <div className="flex items-center justify-between gap-2 flex-none">
                <div className="flex items-center gap-1.5">
                  <FocusedIcon
                    size={14}
                    className={focusedVital.status === 'warn' ? 'text-amber-400' : 'text-sky-400'}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-bold text-slate-100">
                    {lang === 'EN'
                      ? `7-Day Trend: ${focusedVital.title}`
                      : `Biểu đồ 7 ngày: ${focusedVital.viTitle}`}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">{focusedVital.range}</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 flex-none">
                <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-2.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">
                    {lang === 'EN' ? 'CURRENT' : 'HIỆN TẠI'}
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-100">
                    {focusedFormatted.displayValue} {focusedFormatted.displayUnit}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-2.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">
                    {lang === 'EN' ? '7D AVG' : 'TB 7 NGÀY'}
                  </div>
                  <div className="font-mono text-xs font-bold text-sky-300">
                    {focusedVital.id === 'bp' ? '124/81' : avg} {focusedVital.unit}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-2.5 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">BASELINE</div>
                  <div className="font-mono text-xs font-bold text-slate-300">
                    {focusedVital.baseline} {focusedVital.unit}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[115px] flex">
                <LineChart
                  series={[
                    {
                      data: nums,
                      color:
                        focusedVital.status === 'ok'
                          ? '#10B981'
                          : STATUS_COLOR[focusedVital.status],
                      fill: true,
                    },
                  ]}
                  labels={TREND_DATA['7D'].labels}
                  baseline={focusedVital.baseline}
                  yMin={+(mn - pad).toFixed(1)}
                  yMax={+(mx + pad).toFixed(1)}
                  ariaLabel={`${focusedVital.title} 7-day trend`}
                  className="chart !min-h-[110px]"
                />
              </div>
            </div>

            {/* Dynamic Flight Surgeon Note (Updated in real-time by Gemini Multimodal Agent) */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 flex flex-col gap-1.5 flex-none">
              <div className="flex items-center justify-between gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                <div className="flex items-center gap-1.5">
                  <Stethoscope size={13} aria-hidden="true" />
                  <span>{lang === 'EN' ? 'Flight Surgeon Note' : 'Khuyến nghị Y sinh Vũ trụ'}</span>
                </div>
                {activeNote && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/40">
                    AI UPDATED
                  </span>
                )}
              </div>
              <ul className="flex flex-col gap-1 text-xs leading-snug text-slate-200 pl-3 list-disc">
                <li>
                  <strong className="text-slate-100">{lang === 'EN' ? 'Cause:' : 'Nguyên nhân:'}</strong>{' '}
                  {displayCause}
                </li>
                <li>
                  <strong className="text-amber-300">
                    {lang === 'EN' ? 'Countermeasure:' : 'Khắc phục:'}
                  </strong>{' '}
                  {displayCountermeasure}
                </li>
              </ul>
            </div>

            {/* Single Bottom Action Row */}
            <div className="grid grid-cols-2 gap-2 flex-none">
              <button
                type="button"
                className="btn btn-outline-cyan !min-h-9 !text-xs"
                onClick={() => onNavigate('monitoring', focusedVital.id)}
              >
                <Pencil size={13} aria-hidden="true" />
                <span>{lang === 'EN' ? 'Log Manual Data' : 'Nhập dữ liệu đo'}</span>
              </button>
              <button
                type="button"
                className="btn btn-primary !min-h-9 !text-xs"
                onClick={() => onExecuteCountermeasure(region.id)}
              >
                <Zap size={14} aria-hidden="true" />
                <span>{lang === 'EN' ? 'Execute Countermeasure' : 'Thực thi Phác đồ'}</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* 3. Strictly On-Demand Optical Biometric Scanner Modal (Camera OFF until requested) */}
      <OpticalBiometricScanner
        lang={lang}
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        vitals={vitals}
        externalScanTrigger={externalScanTrigger}
        onScanComplete={handleFaceScanComplete}
        onRegisterFrameCapture={registerFrameCapture}
      />
    </div>
  )
}
