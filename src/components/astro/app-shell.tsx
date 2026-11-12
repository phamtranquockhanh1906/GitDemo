import { CircleCheck, Siren } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ANATOMY_REGIONS,
  DEFAULT_UNIT_PREFS,
  VITALS,
  applyAgentVitalsToState,
  applyVoiceVitalUpdate,
  convertLoggedVitalToFormValues,
  updateVitalsWithEntry,
  vitalsToAgentPayload,
  type AnatomyRegionId,
  type CurrentAppStatePayload,
  type DynamicSurgeonNote,
  type Lang,
  type MultimodalControlResponse,
  type Status,
  type UnitPrefs,
  type Vital,
  type VitalId,
} from '@/lib/astro-data'
import { GlobalHandsFreeController } from './global-hands-free'
import { AiAssessmentView } from './modules/ai-assessment-view'
import { AnalyticsView } from './modules/analytics-view'
import { DashboardView, type ExternalDashboardAction } from './modules/dashboard-view'
import { MissionsView } from './modules/missions-view'
import {
  INITIAL_MONITORING_ROWS,
  MonitoringView,
  type ExternalVoiceSyncPayload,
  type MetricId,
  type MonitoringRow,
} from './modules/monitoring-view'
import { ProfileView } from './modules/profile-view'
import { Sidebar, type ModuleId } from './sidebar'
import { TopHeader, useUtcClock } from './top-header'

export type Notify = (message: string, tone?: 'ok' | 'crit') => void

const STORAGE_KEY = 'astrocare_state_v3'

type PersistedState = {
  lang?: Lang
  vitals?: Vital[]
  rows?: MonitoringRow[]
  completedMissions?: string[]
  unitPrefs?: UnitPrefs
  dynamicNotes?: Partial<Record<AnatomyRegionId, DynamicSurgeonNote>>
}

function loadPersistedState(): PersistedState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PersistedState
  } catch {
    return {}
  }
}

export function AppShell() {
  const initialPersisted = useRef<PersistedState>(loadPersistedState())

  const [active, setActive] = useState<ModuleId>('dashboard')
  const [lang, setLang] = useState<Lang>(initialPersisted.current.lang ?? 'VI')
  const [vitals, setVitals] = useState<Vital[]>(initialPersisted.current.vitals ?? VITALS)
  const [rows, setRows] = useState<MonitoringRow[]>(
    initialPersisted.current.rows ?? INITIAL_MONITORING_ROWS,
  )
  const [completedMissions, setCompletedMissions] = useState<string[]>(
    initialPersisted.current.completedMissions ?? ['telemetry', 'mood', 'cycle'],
  )
  const [unitPrefs, setUnitPrefs] = useState<UnitPrefs>(
    initialPersisted.current.unitPrefs ?? DEFAULT_UNIT_PREFS,
  )
  const [dynamicNotes, setDynamicNotes] = useState<
    Partial<Record<AnatomyRegionId, DynamicSurgeonNote>>
  >(initialPersisted.current.dynamicNotes ?? {})

  const [monitoringVital, setMonitoringVital] = useState<VitalId | undefined>(undefined)
  const [currentMetricTab, setCurrentMetricTab] = useState<MetricId>('bp')
  const [externalVoiceSync, setExternalVoiceSync] = useState<ExternalVoiceSyncPayload | null>(null)
  const [externalDashboardAction, setExternalDashboardAction] =
    useState<ExternalDashboardAction | null>(null)
  const voiceSyncSeqRef = useRef(0)

  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'crit' } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const contentRef = useRef<HTMLElement>(null)
  const now = useUtcClock()

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const payload: PersistedState = {
        lang,
        vitals,
        rows,
        completedMissions,
        unitPrefs,
        dynamicNotes,
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore storage quota errors
    }
  }, [lang, vitals, rows, completedMissions, unitPrefs, dynamicNotes])

  const notify = useCallback<Notify>((message, tone = 'ok') => {
    setToast({ message, tone })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const select = (id: ModuleId, metricId?: VitalId) => {
    if (metricId) {
      setMonitoringVital(metricId)
      setCurrentMetricTab(metricId === 'stress' ? 'mood' : metricId)
    }
    setActive(id)
    contentRef.current?.scrollTo({ top: 0 })
  }

  const handleSaveVitalEntry = (
    metricId: MetricId,
    values: Record<string, string>,
    source: 'Sensor' | 'Manual',
    status: Status,
  ) => {
    setVitals((prev) => updateVitalsWithEntry(prev, metricId, values, source, status))
  }

  const handleAddRow = (row: MonitoringRow) => {
    setRows((prev) => [row, ...prev])
  }

  const handleToggleMission = (id: string) => {
    setCompletedMissions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleExecuteCountermeasure = (regionId: AnatomyRegionId) => {
    const reg = ANATOMY_REGIONS.find((r) => r.id === regionId)
    if (!reg) return
    setVitals((prev) => {
      let next = prev
      if (regionId === 'brain') {
        next = applyVoiceVitalUpdate(next, 'sleep', '7.6', true).vitals
      } else if (regionId === 'heart') {
        next = applyVoiceVitalUpdate(next, 'hrv', '50', false).vitals
        next = applyVoiceVitalUpdate(next, 'bp', '118/78', false).vitals
      }
      return next.map((v) =>
        reg.metricIds.includes(v.id) ? { ...v, updated: 'Protocol Active' } : v,
      )
    })
    notify(
      lang === 'EN'
        ? `Countermeasure protocol initiated for ${reg.shortLabel} — Biometrics stabilized`
        : `Đã thực thi phác đồ cho ${reg.viShortLabel} — Chỉ số sinh tồn đã ổn định`,
    )
  }

  const handleResetDemoData = () => {
    setVitals(VITALS)
    setRows(INITIAL_MONITORING_ROWS)
    setCompletedMissions(['telemetry', 'mood', 'cycle'])
    setUnitPrefs(DEFAULT_UNIT_PREFS)
    setDynamicNotes({})
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    notify(
      lang === 'EN'
        ? 'All telemetry and settings restored to default mission state'
        : 'Đã khôi phục toàn bộ chỉ số và cài đặt về mặc định ban đầu',
    )
  }

  /**
   * Applies the structured JSON control response returned by Gemini Native Multimodal Audio AI.
   */
  const handleApplyMultimodalControl = useCallback(
    (
      response: MultimodalControlResponse,
      speakConfirm: (text: string) => void,
    ) => {
      const nowTime = () => {
        const d = new Date()
        const hh = String(d.getUTCHours()).padStart(2, '0')
        const mm = String(d.getUTCMinutes()).padStart(2, '0')
        return `2026-11-06 ${hh}:${mm}`
      }

      // 1. Update Dashboard vitals from Gemini's updatedVitals and loggedVitals
      setVitals((prev) => {
        let next = applyAgentVitalsToState(prev, response.updatedVitals).vitals
        for (const item of response.loggedVitals) {
          const formVals = convertLoggedVitalToFormValues(item)
          next = updateVitalsWithEntry(next, item.metricId, formVals, 'Manual', item.status)
        }
        return next
      })

      // 2. Update Dynamic Flight Surgeon Note if present
      if (response.dynamicSurgeonNote?.regionId) {
        setDynamicNotes((prev) => ({
          ...prev,
          [response.dynamicSurgeonNote.regionId]: {
            cause: response.dynamicSurgeonNote.cause,
            countermeasure: response.dynamicSurgeonNote.countermeasure,
          },
        }))
      }

      // 3. Auto-Save all logged vitals to Biometric Measurement History with source 'Voice'
      if (response.loggedVitals.length > 0) {
        const timestamp = nowTime()
        const baseId = Date.now()
        const newRows: MonitoringRow[] = response.loggedVitals.map((item, idx) => ({
          id: baseId + idx,
          time: timestamp,
          metric: item.metricId,
          value: item.formattedValue,
          source: 'Voice',
          quality: item.status === 'ok' ? 'Verified' : 'Flagged',
        }))
        setRows((prev) => [...newRows, ...prev])

        // Auto-switch to target page & metric tab, and fill inputs
        const targetTab =
          response.switchMetricTab && response.switchMetricTab !== 'NONE'
            ? response.switchMetricTab
            : response.loggedVitals[0].metricId
        const matchingItem =
          response.loggedVitals.find((v) => v.metricId === targetTab) ??
          response.loggedVitals[0]
        const targetModule =
          response.navigateModule && response.navigateModule !== 'NONE'
            ? response.navigateModule
            : 'monitoring'

        voiceSyncSeqRef.current += 1
        setActive(targetModule)
        setCurrentMetricTab(targetTab)
        setExternalVoiceSync({
          metricId: targetTab,
          values:
            matchingItem.metricId === targetTab
              ? convertLoggedVitalToFormValues(matchingItem)
              : undefined,
          transcript: response.transcript,
          autoSavedTimeUtc: `${timestamp.slice(11, 16)} UTC`,
          seq: voiceSyncSeqRef.current,
        })
      } else {
        // 4. Handle module navigation & metric tab switching when no new vital numbers were logged
        if (response.navigateModule && response.navigateModule !== 'NONE') {
          setActive(response.navigateModule)
          contentRef.current?.scrollTo({ top: 0 })
        }
        if (response.switchMetricTab && response.switchMetricTab !== 'NONE') {
          voiceSyncSeqRef.current += 1
          setActive('monitoring')
          setCurrentMetricTab(response.switchMetricTab)
          setExternalVoiceSync({
            metricId: response.switchMetricTab,
            seq: voiceSyncSeqRef.current,
          })
          contentRef.current?.scrollTo({ top: 0 })
        }
        if (
          (response.openInspectorRegion && response.openInspectorRegion !== 'NONE') ||
          response.triggerOpticalScan
        ) {
          voiceSyncSeqRef.current += 1
          setActive('dashboard')
          setExternalDashboardAction({
            openInspectorRegion: response.openInspectorRegion,
            triggerOpticalScan: response.triggerOpticalScan,
            seq: voiceSyncSeqRef.current,
          })
        }
      }

      // 5. Show Toast & Speak TTS Reply with Anti-Echo
      const hasAnomaly = response.loggedVitals.some((v) => v.status !== 'ok')
      notify(
        response.toastMessage || `⚡ ${response.spokenReply}`,
        hasAnomaly ? 'crit' : 'ok',
      )
      speakConfirm(response.spokenReply)
    },
    [notify],
  )

  const currentAppState = useMemo<CurrentAppStatePayload>(
    () => ({
      activeModule: active,
      activeMetricTab: currentMetricTab,
      lang,
      vitals: vitalsToAgentPayload(vitals),
    }),
    [active, currentMetricTab, lang, vitals],
  )

  const anomalyCount = vitals.filter((v) => v.status !== 'ok').length

  return (
    <div className="shell h-screen overflow-hidden">
      <Sidebar
        active={active}
        lang={lang}
        anomalyCount={anomalyCount}
        onSelect={(id) => select(id)}
        onEmergency={() =>
          notify(
            lang === 'EN'
              ? 'Emergency channel to Flight Surgeon requested'
              : 'Đã mở kênh liên lạc khẩn cấp với Bác sĩ Vũ trụ',
            'crit',
          )
        }
      />
      <div className="main-col h-full overflow-hidden">
        <TopHeader
          now={now}
          lang={lang}
          vitals={vitals}
          unitPrefs={unitPrefs}
          onLangChange={setLang}
          onNavigate={(id) => select(id)}
          handsFreeSlot={
            <GlobalHandsFreeController
              lang={lang}
              currentAppState={currentAppState}
              onApplyMultimodalControl={handleApplyMultimodalControl}
            />
          }
        />
        <main
          ref={contentRef}
          className={`content ${active === 'dashboard' ? '!overflow-hidden' : ''}`}
          aria-live="off"
        >
          {active === 'dashboard' && (
            <DashboardView
              lang={lang}
              vitals={vitals}
              unitPrefs={unitPrefs}
              dynamicNotes={dynamicNotes}
              onUpdateDynamicNotes={setDynamicNotes}
              onUpdateVitals={setVitals}
              notify={notify}
              onNavigate={select}
              onExecuteCountermeasure={handleExecuteCountermeasure}
              externalDashboardAction={externalDashboardAction}
            />
          )}
          {active === 'monitoring' && (
            <MonitoringView
              lang={lang}
              vitals={vitals}
              rows={rows}
              onAddRow={handleAddRow}
              notify={notify}
              initialVitalId={monitoringVital}
              externalVoiceSync={externalVoiceSync}
              onActiveMetricChange={setCurrentMetricTab}
              onSaveVitalEntry={handleSaveVitalEntry}
            />
          )}
          {active === 'analytics' && (
            <AnalyticsView
              lang={lang}
              vitals={vitals}
              onNavigate={(id) => select(id)}
            />
          )}
          {active === 'ai' && (
            <AiAssessmentView
              lang={lang}
              vitals={vitals}
              notify={notify}
            />
          )}
          {active === 'missions' && (
            <MissionsView
              lang={lang}
              vitals={vitals}
              completedIds={completedMissions}
              onToggleMissionId={handleToggleMission}
              notify={notify}
            />
          )}
          {active === 'profile' && (
            <ProfileView
              lang={lang}
              unitPrefs={unitPrefs}
              onChangeUnitPrefs={setUnitPrefs}
              onResetDemoData={handleResetDemoData}
              notify={notify}
            />
          )}
        </main>
      </div>
      {toast && (
        <div className={`toast ${toast.tone === 'crit' ? 'crit' : ''}`} role="status">
          {toast.tone === 'crit' ? (
            <Siren size={16} aria-hidden="true" />
          ) : (
            <CircleCheck size={16} aria-hidden="true" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
