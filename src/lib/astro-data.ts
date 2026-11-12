export type Status = 'ok' | 'warn' | 'crit' | 'neu'
export type Lang = 'EN' | 'VI'

export type UnitPrefs = {
  tempUnit: '°C' | '°F'
  gluUnit: 'mg/dL' | 'mmol/L'
  clockFormat: '24h' | '12h'
}

export const DEFAULT_UNIT_PREFS: UnitPrefs = {
  tempUnit: '°C',
  gluUnit: 'mg/dL',
  clockFormat: '24h',
}

export function formatVitalDisplay(
  vital: Vital,
  unitPrefs: UnitPrefs = DEFAULT_UNIT_PREFS,
): { displayValue: string; displayUnit: string } {
  if (vital.id === 'temp' && unitPrefs.tempUnit === '°F') {
    const c = Number(vital.value)
    if (Number.isFinite(c)) {
      return {
        displayValue: ((c * 9) / 5 + 32).toFixed(1),
        displayUnit: '°F',
      }
    }
  }
  if (vital.id === 'glu' && unitPrefs.gluUnit === 'mmol/L') {
    const mg = Number(vital.value)
    if (Number.isFinite(mg)) {
      return {
        displayValue: (mg / 18).toFixed(1),
        displayUnit: 'mmol/L',
      }
    }
  }
  return {
    displayValue: vital.value,
    displayUnit: vital.unit,
  }
}

export const STATUS_COLOR: Record<Status, string> = {
  ok: '#10B981',
  warn: '#F59E0B',
  crit: '#EF4444',
  neu: '#94A3B8',
}

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'NORMAL',
  warn: 'WARNING',
  crit: 'CRITICAL',
  neu: 'STALE',
}

export type VitalId = 'hr' | 'bp' | 'spo2' | 'temp' | 'sleep' | 'hrv' | 'stress' | 'glu'

export type AnatomyRegionId = 'brain' | 'heart' | 'lungs' | 'circulatory'

export type Vital = {
  id: VitalId
  shortTitle: string
  title: string
  viTitle: string
  value: string
  unit: string
  status: Status
  source: 'Sensor' | 'Manual'
  updated: string
  series: number[]
  baseline: number
  range: string
  regionId: AnatomyRegionId
}

export type AnatomyRegion = {
  id: AnatomyRegionId
  shortLabel: string
  viShortLabel: string
  name: string
  viName: string
  subtitle: string
  viSubtitle: string
  metricIds: VitalId[]
  pinCoords: { x: number; y: number }
  tagSide: 'left' | 'right'
  cause: string
  viCause: string
  countermeasure: string
  viCountermeasure: string
}

export const ANATOMY_REGIONS: AnatomyRegion[] = [
  {
    id: 'brain',
    shortLabel: 'Brain / Neuro',
    viShortLabel: 'Não / Thần kinh',
    name: 'Cerebral & Neuro-Regulatory',
    viName: 'Hệ Thần kinh Trung ương',
    subtitle: 'CNS · Circadian & Autonomic Stress',
    viSubtitle: 'Nhịp sinh học & Căng thẳng thần kinh',
    metricIds: ['sleep', 'stress'],
    pinCoords: { x: 160, y: 54 },
    tagSide: 'left',
    cause: 'Cumulative sleep debt (-1.3h vs target) and elevated cognitive stress (Lv.6) during orbital science ops.',
    viCause: 'Thiếu ngủ tích lũy (-1.3h so với mục tiêu) và căng thẳng nhận thức tăng (Mức 6) trong ca làm việc quỹ đạo.',
    countermeasure: '15-min vagal breathing protocol before 21:30 UTC sleep block; shift cabin spectrum to 480nm-depleted.',
    viCountermeasure: 'Thực hiện 15 phút thở kích thích dây phế vị trước 21:30 UTC; giảm ánh sáng xanh 480nm trong khoang ngủ.',
  },
  {
    id: 'heart',
    shortLabel: 'Thorax / Heart',
    viShortLabel: 'Lồng ngực / Tim',
    name: 'Cardiovascular & Autonomic',
    viName: 'Hệ Tim mạch & Tự chủ',
    subtitle: 'Myocardial Rhythm · HRV · Arterial Pressure',
    viSubtitle: 'Nhịp cơ tim · Biến thiên nhịp tim · Huyết áp',
    metricIds: ['hr', 'hrv', 'bp'],
    pinCoords: { x: 168, y: 158 },
    tagSide: 'right',
    cause: 'Depressed HRV (42 ms, -14% vs baseline) with mildly elevated BP (125/82 mmHg) from sympathetic overload.',
    viCause: 'HRV suy giảm (42 ms, -14% so với baseline) kèm huyết áp tăng nhẹ (125/82 mmHg) do quá tải giao cảm.',
    countermeasure: 'Cap CEVIS ergometer at Zone 2 aerobic recovery; re-verify cuff BP after 5 min seated restraint.',
    viCountermeasure: 'Giới hạn bài tập CEVIS ở ngưỡng phục hồi Zone 2; đo lại huyết áp sau 5 phút nghỉ tĩnh.',
  },
  {
    id: 'lungs',
    shortLabel: 'Lungs',
    viShortLabel: 'Phổi / Hô hấp',
    name: 'Pulmonary & Gas Exchange',
    viName: 'Hệ Hô hấp & Trao đổi khí',
    subtitle: 'Alveolar Oxygenation · Cabin O₂ Partial Pressure',
    viSubtitle: 'Bão hòa Oxy phế nang · Áp suất riêng phần O₂',
    metricIds: ['spo2'],
    pinCoords: { x: 136, y: 146 },
    tagSide: 'left',
    cause: 'Nominal alveolar gas exchange (SpO₂ 98%, Perfusion Index 2.4) under 101.3 kPa station cabin pressure.',
    viCause: 'Trao đổi khí phế nang tối ưu (SpO₂ 98%, chỉ số tưới máu PI 2.4) ở áp suất khoang chuẩn 101.3 kPa.',
    countermeasure: 'Maintain routine morning pulse oximetry telemetry; no pulmonary intervention required.',
    viCountermeasure: 'Duy trì đo SpO₂ định kỳ mỗi sáng; không cần can thiệp hô hấp.',
  },
  {
    id: 'circulatory',
    shortLabel: 'Systemic',
    viShortLabel: 'Toàn thân',
    name: 'Systemic & Metabolic Circulation',
    viName: 'Tuần hoàn & Chuyển hóa Toàn thân',
    subtitle: 'Thermoregulation · Glycemic Homeostasis',
    viSubtitle: 'Điều hòa thân nhiệt · Cân bằng đường huyết',
    metricIds: ['temp', 'glu'],
    pinCoords: { x: 160, y: 256 },
    tagSide: 'right',
    cause: 'Core temperature (36.8°C) and fasting blood glucose (95 mg/dL) stable within pre-flight baseline.',
    viCause: 'Thân nhiệt lõi (36.8°C) và đường huyết lúc đói (95 mg/dL) ổn định trong dải chuẩn trước chuyến bay.',
    countermeasure: 'Continue 2.4 L/day electrolyte hydration and daily ARED resistive exercise protocol.',
    viCountermeasure: 'Duy trì bù điện giải 2.4 L/ngày và bài tập kháng lực ARED định kỳ.',
  },
]

export const VITALS: Vital[] = [
  {
    id: 'hr',
    shortTitle: 'HR',
    title: 'Heart Rate',
    viTitle: 'Nhịp tim',
    value: '75',
    unit: 'bpm',
    status: 'ok',
    source: 'Sensor',
    updated: '2m ago',
    series: [72, 74, 71, 76, 73, 77, 75],
    baseline: 70,
    range: 'Baseline 66–74 bpm',
    regionId: 'heart',
  },
  {
    id: 'bp',
    shortTitle: 'BP',
    title: 'Blood Pressure',
    viTitle: 'Huyết áp',
    value: '125/82',
    unit: 'mmHg',
    status: 'warn',
    source: 'Sensor',
    updated: '15m ago',
    series: [121, 124, 122, 126, 123, 127, 125],
    baseline: 122,
    range: 'Baseline 118/78 mmHg',
    regionId: 'heart',
  },
  {
    id: 'spo2',
    shortTitle: 'SpO₂',
    title: 'SpO₂',
    viTitle: 'Độ bão hòa SpO₂',
    value: '98',
    unit: '%',
    status: 'ok',
    source: 'Sensor',
    updated: '2m ago',
    series: [98, 97, 98, 99, 98, 97, 98],
    baseline: 98,
    range: 'Target ≥ 95%',
    regionId: 'lungs',
  },
  {
    id: 'temp',
    shortTitle: 'Temp',
    title: 'Body Temp',
    viTitle: 'Thân nhiệt',
    value: '36.8',
    unit: '°C',
    status: 'ok',
    source: 'Sensor',
    updated: '15m ago',
    series: [36.7, 36.8, 36.6, 36.9, 36.8, 36.7, 36.8],
    baseline: 36.7,
    range: 'Baseline 36.5–37.0 °C',
    regionId: 'circulatory',
  },
  {
    id: 'sleep',
    shortTitle: 'Sleep',
    title: 'Sleep Duration',
    viTitle: 'Thời lượng ngủ',
    value: '6.2',
    unit: 'h',
    status: 'warn',
    source: 'Sensor',
    updated: '8h ago',
    series: [7.4, 7.1, 6.8, 6.5, 6.6, 6.3, 6.2],
    baseline: 7.5,
    range: 'Target 7.5 h',
    regionId: 'brain',
  },
  {
    id: 'hrv',
    shortTitle: 'HRV',
    title: 'HRV',
    viTitle: 'Biến thiên HRV',
    value: '42',
    unit: 'ms',
    status: 'warn',
    source: 'Sensor',
    updated: '15m ago',
    series: [50, 49, 47, 45, 44, 43, 42],
    baseline: 49,
    range: 'Baseline 49 ms (−14%)',
    regionId: 'heart',
  },
  {
    id: 'stress',
    shortTitle: 'Stress',
    title: 'Stress Level',
    viTitle: 'Mức căng thẳng',
    value: '6',
    unit: '/10',
    status: 'warn',
    source: 'Manual',
    updated: '1h ago',
    series: [4, 4, 5, 5, 6, 5, 6],
    baseline: 4,
    range: 'Baseline 3–5',
    regionId: 'brain',
  },
  {
    id: 'glu',
    shortTitle: 'Glucose',
    title: 'Blood Glucose',
    viTitle: 'Đường huyết',
    value: '95',
    unit: 'mg/dL',
    status: 'ok',
    source: 'Manual',
    updated: '3h ago',
    series: [92, 96, 94, 98, 93, 97, 95],
    baseline: 94,
    range: 'Range 70–110 mg/dL',
    regionId: 'circulatory',
  },
]

export function getRegionVitals(vitals: Vital[], regionId: AnatomyRegionId): Vital[] {
  const region = ANATOMY_REGIONS.find((r) => r.id === regionId)
  if (!region) return []
  return region.metricIds
    .map((id) => vitals.find((v) => v.id === id))
    .filter((v): v is Vital => Boolean(v))
}

export function computeRegionStatus(vitals: Vital[], regionId: AnatomyRegionId): Status {
  const regionVitals = getRegionVitals(vitals, regionId)
  if (regionVitals.some((v) => v.status === 'crit')) return 'crit'
  if (regionVitals.some((v) => v.status === 'warn')) return 'warn'
  if (regionVitals.some((v) => v.status === 'ok')) return 'ok'
  return 'neu'
}

export function evaluateVitalStatus(id: VitalId, rawValue: string): Status {
  if (id === 'bp') {
    const parts = rawValue.split('/')
    const sys = Number(parts[0])
    const dia = Number(parts[1] ?? 80)
    if (Number.isNaN(sys) || Number.isNaN(dia)) return 'warn'
    if (sys >= 140 || dia >= 90 || sys < 85 || dia < 50) return 'crit'
    if (sys >= 125 || dia >= 82) return 'warn'
    return 'ok'
  }

  const num = Number(rawValue)
  if (Number.isNaN(num)) return 'warn'

  switch (id) {
    case 'hr':
      if (num < 48 || num > 125) return 'crit'
      if (num < 58 || num >= 100) return 'warn'
      return 'ok'
    case 'spo2':
      if (num < 90) return 'crit'
      if (num < 95) return 'warn'
      return 'ok'
    case 'temp':
      if (num < 35.5 || num > 38.2) return 'crit'
      if (num < 36.1 || num > 37.2) return 'warn'
      return 'ok'
    case 'sleep':
      if (num < 5.0) return 'crit'
      if (num < 7.0) return 'warn'
      return 'ok'
    case 'hrv':
      if (num < 32) return 'crit'
      if (num < 46) return 'warn'
      return 'ok'
    case 'stress':
      if (num >= 8) return 'crit'
      if (num >= 5) return 'warn'
      return 'ok'
    case 'glu':
      if (num < 60 || num > 140) return 'crit'
      if (num < 70 || num > 100) return 'warn'
      return 'ok'
  }
}

export type NavModuleTarget = 'dashboard' | 'monitoring' | 'analytics' | 'ai' | 'missions' | 'profile'

export type HandsFreeMetricId = 'hr' | 'hrv' | 'bp' | 'spo2' | 'temp' | 'glu' | 'sleep' | 'mood'

export function applyVoiceVitalUpdate(
  vitals: Vital[],
  vitalId: VitalId,
  rawValue: string,
  alsoNormalizeBrain = false,
): { vitals: Vital[]; updatedIds: VitalId[] } {
  const newStatus = evaluateVitalStatus(vitalId, rawValue)
  const updatedIds: VitalId[] = [vitalId]
  if (vitalId === 'sleep' && alsoNormalizeBrain) {
    updatedIds.push('stress')
  }

  const nextVitals = vitals.map((v) => {
    if (v.id === vitalId) {
      const numericForSeries =
        vitalId === 'bp' ? Number(rawValue.split('/')[0]) : Number(rawValue)
      return {
        ...v,
        value: rawValue,
        status: newStatus,
        source: 'Manual' as const,
        updated: 'Just now',
        series: [
          ...v.series.slice(1),
          Number.isFinite(numericForSeries) ? numericForSeries : v.series[v.series.length - 1],
        ],
      }
    }
    if (vitalId === 'sleep' && alsoNormalizeBrain && v.id === 'stress' && v.status !== 'ok') {
      return {
        ...v,
        value: '3',
        status: 'ok' as const,
        source: 'Sensor' as const,
        updated: 'Just now',
        series: [...v.series.slice(1), 3],
      }
    }
    return v
  })

  return { vitals: nextVitals, updatedIds }
}

// ---------- Native Multimodal Gemini Audio AI Types & State Helpers ----------

export type UiActionType =
  | 'OPEN_BRAIN'
  | 'OPEN_HEART'
  | 'OPEN_LUNGS'
  | 'OPEN_SYSTEMIC'
  | 'CLOSE_PANEL'
  | 'SCAN_FACE'
  | 'NAV_DASHBOARD'
  | 'NAV_MONITORING'
  | 'NAV_ANALYTICS'
  | 'NAV_AI_ASSESSMENT'
  | 'NAV_MISSIONS'
  | 'NAV_PROFILE'
  | 'NONE'

export type AgentVitalsPayload = {
  heartRate: number
  bloodPressure: string
  spO2: number
  bodyTemp: number
  sleepDuration: number
  hrv: number
  stressLevel: number
  bloodGlucose: number
}

export type DynamicSurgeonNote = {
  cause: string
  countermeasure: string
}

export type AstroAgentResponse = {
  spokenReply: string
  uiAction: UiActionType
  updatedVitals: AgentVitalsPayload
  dynamicSurgeonNote: DynamicSurgeonNote
  source?: 'gemini' | 'edge-fallback'
}

export type CurrentAppStatePayload = {
  activeModule: NavModuleTarget
  activeMetricTab: HandsFreeMetricId
  lang: Lang
  vitals: AgentVitalsPayload
}

export type MultimodalLoggedVital = {
  metricId: HandsFreeMetricId
  sys?: string
  dia?: string
  pulse?: string
  value?: string
  secondaryValue?: string
  formattedValue: string
  status: Status
}

export type SpacecraftNavigatePage =
  | 'dashboard'
  | 'monitoring'
  | 'analytics'
  | 'ai_assessment'
  | 'missions'
  | 'profile'
  | 'KEEP_CURRENT'

export type SpacecraftMetricTab =
  | 'heartRate'
  | 'hrv'
  | 'bloodPressure'
  | 'spO2'
  | 'bodyTemp'
  | 'bloodGlucose'
  | 'sleep'
  | 'stress'
  | 'KEEP_CURRENT'

export type SpacecraftBodyRegion =
  | 'brain'
  | 'heart'
  | 'lungs'
  | 'systemic'
  | 'CLOSE'
  | 'KEEP_CURRENT'

export type VitalsToUpdatePayload = {
  heartRate: number | null
  hrv: number | null
  systolic: number | null
  diastolic: number | null
  pulse: number | null
  spO2: number | null
  bodyTemp: number | null
  bloodGlucose: number | null
  sleepHours: number | null
  stressLevel: number | null
}

export type SpacecraftVoiceAiResponse = {
  isNoiseOrUnrelated: boolean
  userTranscript: string
  spokenReply: string
  navigateToPage: SpacecraftNavigatePage
  selectMetricTab: SpacecraftMetricTab
  inspectBodyRegion: SpacecraftBodyRegion
  triggerBiometricScan: boolean
  autoSave: boolean
  vitalsToUpdate: VitalsToUpdatePayload
  dynamicSurgeonNote: {
    cause: string | null
    countermeasure: string | null
  }
}

export type MultimodalControlResponse = {
  // Exact Section 4 Spacecraft JSON fields
  isNoiseOrUnrelated?: boolean
  userTranscript?: string
  navigateToPage?: SpacecraftNavigatePage
  selectMetricTab?: SpacecraftMetricTab
  inspectBodyRegion?: SpacecraftBodyRegion
  triggerBiometricScan?: boolean
  autoSave?: boolean
  vitalsToUpdate?: VitalsToUpdatePayload
  // Normalized execution fields
  transcript: string
  shouldIgnore: boolean
  spokenReply: string
  toastMessage: string
  navigateModule: NavModuleTarget | 'NONE'
  switchMetricTab: HandsFreeMetricId | 'NONE'
  openInspectorRegion: AnatomyRegionId | 'CLOSE' | 'NONE'
  triggerOpticalScan: boolean
  loggedVitals: MultimodalLoggedVital[]
  updatedVitals: AgentVitalsPayload
  dynamicSurgeonNote: {
    regionId: AnatomyRegionId
    cause: string
    countermeasure: string
  }
  source: 'gemini-multimodal-audio' | 'gemini-multimodal'
}

export function extractLoggedVitalsFromVitalsToUpdate(
  vitalsToUpdate: Partial<VitalsToUpdatePayload> | undefined | null,
  currentVitals?: AgentVitalsPayload,
): MultimodalLoggedVital[] {
  if (!vitalsToUpdate) return []
  const logged: MultimodalLoggedVital[] = []

  const hasSys = vitalsToUpdate.systolic !== null && vitalsToUpdate.systolic !== undefined
  const hasDia = vitalsToUpdate.diastolic !== null && vitalsToUpdate.diastolic !== undefined
  if (hasSys || hasDia) {
    const fallbackBp = (currentVitals?.bloodPressure || '120/80').split('/')
    const sys = String(Math.round(Number(vitalsToUpdate.systolic ?? fallbackBp[0] ?? 120)))
    const dia = String(Math.round(Number(vitalsToUpdate.diastolic ?? fallbackBp[1] ?? 80)))
    const pulse = String(
      Math.round(
        Number(
          vitalsToUpdate.pulse ??
            vitalsToUpdate.heartRate ??
            currentVitals?.heartRate ??
            72,
        ),
      ),
    )
    logged.push({
      metricId: 'bp',
      sys,
      dia,
      pulse,
      formattedValue: `${sys}/${dia} mmHg · ${pulse} BPM`,
      status: evaluateVitalStatus('bp', `${sys}/${dia}`),
    })
  }

  if (vitalsToUpdate.heartRate !== null && vitalsToUpdate.heartRate !== undefined) {
    const val = String(Math.round(Number(vitalsToUpdate.heartRate)))
    logged.push({
      metricId: 'hr',
      value: val,
      formattedValue: `${val} BPM`,
      status: evaluateVitalStatus('hr', val),
    })
  }

  if (vitalsToUpdate.hrv !== null && vitalsToUpdate.hrv !== undefined) {
    const val = String(Math.round(Number(vitalsToUpdate.hrv)))
    logged.push({
      metricId: 'hrv',
      value: val,
      formattedValue: `${val} ms`,
      status: evaluateVitalStatus('hrv', val),
    })
  }

  if (vitalsToUpdate.spO2 !== null && vitalsToUpdate.spO2 !== undefined) {
    const val = String(Math.round(Number(vitalsToUpdate.spO2)))
    logged.push({
      metricId: 'spo2',
      value: val,
      formattedValue: `${val}%`,
      status: evaluateVitalStatus('spo2', val),
    })
  }

  if (vitalsToUpdate.bodyTemp !== null && vitalsToUpdate.bodyTemp !== undefined) {
    const val = Number(vitalsToUpdate.bodyTemp).toFixed(1)
    logged.push({
      metricId: 'temp',
      value: val,
      formattedValue: `${val} °C`,
      status: evaluateVitalStatus('temp', val),
    })
  }

  if (vitalsToUpdate.bloodGlucose !== null && vitalsToUpdate.bloodGlucose !== undefined) {
    const val = String(Math.round(Number(vitalsToUpdate.bloodGlucose)))
    logged.push({
      metricId: 'glu',
      value: val,
      formattedValue: `${val} mg/dL`,
      status: evaluateVitalStatus('glu', val),
    })
  }

  if (vitalsToUpdate.sleepHours !== null && vitalsToUpdate.sleepHours !== undefined) {
    const num = Number(vitalsToUpdate.sleepHours)
    const val = Number.isInteger(num) ? `${num}.0` : String(num)
    logged.push({
      metricId: 'sleep',
      value: val,
      secondaryValue: '0',
      formattedValue: `${val}h · 0x`,
      status: evaluateVitalStatus('sleep', val),
    })
  }

  if (vitalsToUpdate.stressLevel !== null && vitalsToUpdate.stressLevel !== undefined) {
    const num = Math.max(1, Math.min(10, Math.round(Number(vitalsToUpdate.stressLevel))))
    const val = String(num)
    const moodVal = num <= 3 ? '8' : num <= 6 ? '6' : '4'
    logged.push({
      metricId: 'mood',
      value: val,
      secondaryValue: moodVal,
      formattedValue: `Stress ${val}/10 · Mood ${moodVal}/10`,
      status: evaluateVitalStatus('stress', val),
    })
  }

  return logged
}

export function normalizeSpacecraftVoiceResponse(
  raw: Partial<SpacecraftVoiceAiResponse & MultimodalControlResponse>,
  appState: CurrentAppStatePayload,
): MultimodalControlResponse {
  const isNoise = Boolean(raw.isNoiseOrUnrelated ?? raw.shouldIgnore ?? false)
  const transcript = (raw.userTranscript ?? raw.transcript ?? '').trim()
  const spokenReply = (raw.spokenReply ?? '').trim()

  const mapPage = (p?: SpacecraftNavigatePage | NavModuleTarget | 'NONE'): NavModuleTarget | 'NONE' => {
    if (!p || p === 'KEEP_CURRENT' || p === 'NONE') return 'NONE'
    if (p === 'ai_assessment' || p === 'ai') return 'ai'
    if (p === 'dashboard' || p === 'monitoring' || p === 'analytics' || p === 'missions' || p === 'profile') {
      return p
    }
    return 'NONE'
  }

  const mapTab = (t?: SpacecraftMetricTab | HandsFreeMetricId | 'NONE'): HandsFreeMetricId | 'NONE' => {
    if (!t || t === 'KEEP_CURRENT' || t === 'NONE') return 'NONE'
    const dict: Record<string, HandsFreeMetricId> = {
      heartRate: 'hr',
      hr: 'hr',
      hrv: 'hrv',
      bloodPressure: 'bp',
      bp: 'bp',
      spO2: 'spo2',
      spo2: 'spo2',
      bodyTemp: 'temp',
      temp: 'temp',
      bloodGlucose: 'glu',
      glu: 'glu',
      sleep: 'sleep',
      stress: 'mood',
      mood: 'mood',
    }
    return dict[t] ?? 'NONE'
  }

  const mapRegion = (
    r?: SpacecraftBodyRegion | AnatomyRegionId | 'CLOSE' | 'NONE',
  ): AnatomyRegionId | 'CLOSE' | 'NONE' => {
    if (!r || r === 'KEEP_CURRENT' || r === 'NONE') return 'NONE'
    if (r === 'systemic' || r === 'circulatory') return 'circulatory'
    if (r === 'brain' || r === 'heart' || r === 'lungs' || r === 'CLOSE') return r
    return 'NONE'
  }

  const loggedFromVitalsToUpdate = extractLoggedVitalsFromVitalsToUpdate(
    raw.vitalsToUpdate,
    appState.vitals,
  )
  const loggedVitals =
    raw.loggedVitals && raw.loggedVitals.length > 0
      ? raw.loggedVitals
      : loggedFromVitalsToUpdate

  const updatedVitals: AgentVitalsPayload = {
    ...(raw.updatedVitals ?? appState.vitals),
  }

  if (raw.vitalsToUpdate) {
    const v = raw.vitalsToUpdate
    if (v.systolic != null || v.diastolic != null) {
      const fallbackBp = (updatedVitals.bloodPressure || '120/80').split('/')
      const sys = Math.round(Number(v.systolic ?? fallbackBp[0] ?? 120))
      const dia = Math.round(Number(v.diastolic ?? fallbackBp[1] ?? 80))
      updatedVitals.bloodPressure = `${sys}/${dia}`
      if (v.pulse != null) {
        updatedVitals.heartRate = Math.round(Number(v.pulse))
      }
    }
    if (v.heartRate != null) updatedVitals.heartRate = Math.round(Number(v.heartRate))
    if (v.hrv != null) updatedVitals.hrv = Math.round(Number(v.hrv))
    if (v.spO2 != null) updatedVitals.spO2 = Math.round(Number(v.spO2))
    if (v.bodyTemp != null) updatedVitals.bodyTemp = Number(Number(v.bodyTemp).toFixed(1))
    if (v.bloodGlucose != null) updatedVitals.bloodGlucose = Math.round(Number(v.bloodGlucose))
    if (v.sleepHours != null) updatedVitals.sleepDuration = Number(v.sleepHours)
    if (v.stressLevel != null) updatedVitals.stressLevel = Math.round(Number(v.stressLevel))
  }

  const rawPage =
    raw.navigateToPage && raw.navigateToPage !== 'KEEP_CURRENT'
      ? raw.navigateToPage
      : raw.navigateModule
  const rawTab =
    raw.selectMetricTab && raw.selectMetricTab !== 'KEEP_CURRENT'
      ? raw.selectMetricTab
      : raw.switchMetricTab
  const rawRegion =
    raw.inspectBodyRegion && raw.inspectBodyRegion !== 'KEEP_CURRENT'
      ? raw.inspectBodyRegion
      : raw.openInspectorRegion

  const navigateModule = mapPage(rawPage)
  let switchMetricTab = mapTab(rawTab)
  if (switchMetricTab === 'NONE' && loggedVitals.length > 0) {
    switchMetricTab = loggedVitals[0].metricId
  }
  const openInspectorRegion = mapRegion(rawRegion)
  const triggerOpticalScan = Boolean(raw.triggerBiometricScan ?? raw.triggerOpticalScan ?? false)

  const toSpacecraftPage = (m: NavModuleTarget | 'NONE'): SpacecraftNavigatePage => {
    if (m === 'NONE') return 'KEEP_CURRENT'
    if (m === 'ai') return 'ai_assessment'
    return m
  }

  const toSpacecraftTab = (t: HandsFreeMetricId | 'NONE'): SpacecraftMetricTab => {
    switch (t) {
      case 'hr':
        return 'heartRate'
      case 'hrv':
        return 'hrv'
      case 'bp':
        return 'bloodPressure'
      case 'spo2':
        return 'spO2'
      case 'temp':
        return 'bodyTemp'
      case 'glu':
        return 'bloodGlucose'
      case 'sleep':
        return 'sleep'
      case 'mood':
        return 'stress'
      default:
        return 'KEEP_CURRENT'
    }
  }

  const toSpacecraftRegion = (r: AnatomyRegionId | 'CLOSE' | 'NONE'): SpacecraftBodyRegion => {
    if (r === 'NONE') return 'KEEP_CURRENT'
    if (r === 'circulatory') return 'systemic'
    return r
  }

  const inferredRegion: AnatomyRegionId =
    openInspectorRegion !== 'NONE' && openInspectorRegion !== 'CLOSE'
      ? openInspectorRegion
      : loggedVitals[0]?.metricId === 'hr' ||
          loggedVitals[0]?.metricId === 'bp' ||
          loggedVitals[0]?.metricId === 'hrv'
        ? 'heart'
        : loggedVitals[0]?.metricId === 'spo2'
          ? 'lungs'
          : loggedVitals[0]?.metricId === 'temp' || loggedVitals[0]?.metricId === 'glu'
            ? 'circulatory'
            : 'brain'

  const toastMessage =
    raw.toastMessage ||
    (loggedVitals.length > 0
      ? appState.lang === 'VI'
        ? `⚡ Đã tự động ghi nhận & Lưu (${loggedVitals.length} chỉ số): ${loggedVitals.map((l) => l.formattedValue).join(' | ')}`
        : `⚡ Auto-logged & Saved (${loggedVitals.length} vitals): ${loggedVitals.map((l) => l.formattedValue).join(' | ')}`
      : spokenReply
        ? `🎙️ ${spokenReply}`
        : '')

  return {
    isNoiseOrUnrelated: isNoise,
    userTranscript: transcript,
    navigateToPage: toSpacecraftPage(navigateModule),
    selectMetricTab: toSpacecraftTab(switchMetricTab),
    inspectBodyRegion: toSpacecraftRegion(openInspectorRegion),
    triggerBiometricScan: triggerOpticalScan,
    autoSave: raw.autoSave ?? loggedVitals.length > 0,
    vitalsToUpdate: raw.vitalsToUpdate ?? {
      heartRate: null,
      hrv: null,
      systolic: null,
      diastolic: null,
      pulse: null,
      spO2: null,
      bodyTemp: null,
      bloodGlucose: null,
      sleepHours: null,
      stressLevel: null,
    },
    transcript,
    shouldIgnore: isNoise,
    spokenReply,
    toastMessage,
    navigateModule,
    switchMetricTab,
    openInspectorRegion,
    triggerOpticalScan,
    loggedVitals,
    updatedVitals,
    dynamicSurgeonNote: {
      regionId: raw.dynamicSurgeonNote?.regionId ?? inferredRegion,
      cause: raw.dynamicSurgeonNote?.cause ?? '',
      countermeasure: raw.dynamicSurgeonNote?.countermeasure ?? '',
    },
    source: raw.source ?? 'gemini-multimodal-audio',
  }
}

/**
 * Maps a MultimodalLoggedVital item returned by Gemini into the MonitoringView form field dictionary.
 */
export function convertLoggedVitalToFormValues(
  item: MultimodalLoggedVital,
): Record<string, string> {
  switch (item.metricId) {
    case 'bp':
      return {
        sys: item.sys || '120',
        dia: item.dia || '80',
        pulse: item.pulse || '72',
      }
    case 'hr':
      return { hr: item.value || '72' }
    case 'hrv':
      return { hrv: item.value || '48' }
    case 'spo2':
      return { spo2: item.value || '99' }
    case 'temp':
      return { temp: item.value || '36.7' }
    case 'glu':
      return { glu: item.value || '92' }
    case 'sleep':
      return {
        hrs: item.value || '7.5',
        wake: item.secondaryValue || '0',
      }
    case 'mood':
      return {
        stress: item.value || '3',
        mood: item.secondaryValue || (Number(item.value || 3) <= 4 ? '8' : '6'),
      }
  }
}

export function vitalsToAgentPayload(vitals: Vital[]): AgentVitalsPayload {
  const getVal = (id: VitalId, fallback: string) =>
    vitals.find((v) => v.id === id)?.value ?? fallback
  return {
    heartRate: Number(getVal('hr', '75')),
    bloodPressure: getVal('bp', '125/82'),
    spO2: Number(getVal('spo2', '98')),
    bodyTemp: Number(getVal('temp', '36.8')),
    sleepDuration: Number(getVal('sleep', '6.2')),
    hrv: Number(getVal('hrv', '42')),
    stressLevel: Number(getVal('stress', '6')),
    bloodGlucose: Number(getVal('glu', '95')),
  }
}

export function applyAgentVitalsToState(
  currentVitals: Vital[],
  updated: Partial<AgentVitalsPayload>,
): { vitals: Vital[]; changedIds: VitalId[] } {
  const changedIds: VitalId[] = []
  const sleepNum = updated.sleepDuration !== undefined ? Number(updated.sleepDuration) : NaN
  const normalizeBrain = Number.isFinite(sleepNum) && sleepNum >= 7.0

  const fieldMap: Record<VitalId, string | undefined> = {
    hr: updated.heartRate !== undefined ? String(Math.round(Number(updated.heartRate))) : undefined,
    bp: updated.bloodPressure !== undefined ? String(updated.bloodPressure).trim() : undefined,
    spo2: updated.spO2 !== undefined ? String(Math.round(Number(updated.spO2))) : undefined,
    temp: updated.bodyTemp !== undefined ? String(Number(updated.bodyTemp)) : undefined,
    sleep:
      updated.sleepDuration !== undefined
        ? Number.isInteger(Number(updated.sleepDuration))
          ? `${Number(updated.sleepDuration)}.0`
          : String(Number(updated.sleepDuration))
        : undefined,
    hrv: updated.hrv !== undefined ? String(Math.round(Number(updated.hrv))) : undefined,
    stress:
      updated.stressLevel !== undefined
        ? String(Math.round(Number(updated.stressLevel)))
        : undefined,
    glu:
      updated.bloodGlucose !== undefined
        ? String(Math.round(Number(updated.bloodGlucose)))
        : undefined,
  }

  const nextVitals = currentVitals.map((v) => {
    let rawNext = fieldMap[v.id]
    if (
      v.id === 'stress' &&
      normalizeBrain &&
      (rawNext === undefined || rawNext === v.value) &&
      v.status !== 'ok'
    ) {
      rawNext = '3'
    }

    if (rawNext === undefined || rawNext === '' || rawNext === v.value) {
      return v
    }

    changedIds.push(v.id)
    const newStatus = evaluateVitalStatus(v.id, rawNext)
    const numericForSeries = v.id === 'bp' ? Number(rawNext.split('/')[0]) : Number(rawNext)

    return {
      ...v,
      value: rawNext,
      status: newStatus,
      source: 'Manual' as const,
      updated: 'AI Synced',
      series: [
        ...v.series.slice(1),
        Number.isFinite(numericForSeries) ? numericForSeries : v.series[v.series.length - 1],
      ],
    }
  })

  return { vitals: nextVitals, changedIds }
}

export type FieldBounds = {
  normal: [number, number]
  plausible: [number, number]
}

export function classifyMeasurementField(bounds: FieldBounds, raw: string): 'ok' | 'warn' | 'crit' | 'empty' {
  if (raw.trim() === '') return 'empty'
  const v = Number(raw)
  if (Number.isNaN(v) || v < bounds.plausible[0] || v > bounds.plausible[1]) return 'crit'
  if (v < bounds.normal[0] || v > bounds.normal[1]) return 'warn'
  return 'ok'
}

export function findConsecutiveDecline(values: number[], lowerIsWorse: boolean): { start: number; end: number } | null {
  if (values.length < 4) return null
  const end = values.length - 1
  let start = end
  while (
    start > 0 &&
    (lowerIsWorse ? values[start - 1] > values[start] : values[start - 1] < values[start])
  ) {
    start--
  }
  return end - start >= 3 ? { start, end } : null
}

export function updateVitalsWithEntry(
  vitals: Vital[],
  metricId: string,
  values: Record<string, string>,
  source: 'Sensor' | 'Manual',
  status: Status,
): Vital[] {
  return vitals.map((v) => {
    if (metricId === 'hr' && v.id === 'hr') {
      const num = Number(values.hr)
      return {
        ...v,
        value: values.hr,
        status: evaluateVitalStatus('hr', values.hr),
        source,
        updated: 'Just now',
        series: [...v.series.slice(1), Number.isFinite(num) ? num : v.series[v.series.length - 1]],
      }
    }
    if (metricId === 'hrv' && v.id === 'hrv') {
      const num = Number(values.hrv)
      return {
        ...v,
        value: values.hrv,
        status: evaluateVitalStatus('hrv', values.hrv),
        source,
        updated: 'Just now',
        series: [...v.series.slice(1), Number.isFinite(num) ? num : v.series[v.series.length - 1]],
      }
    }
    if (metricId === 'bp' && v.id === 'bp') {
      const sys = Number(values.sys)
      const combined = `${values.sys}/${values.dia}`
      return {
        ...v,
        value: combined,
        status: evaluateVitalStatus('bp', combined),
        source,
        updated: 'Just now',
        series: [...v.series.slice(1), Number.isFinite(sys) ? sys : v.series[v.series.length - 1]],
      }
    }
    if (metricId === 'spo2' && v.id === 'spo2') {
      const num = Number(values.spo2)
      return {
        ...v,
        value: values.spo2,
        status: evaluateVitalStatus('spo2', values.spo2),
        source,
        updated: 'Just now',
        series: [...v.series.slice(1), Number.isFinite(num) ? num : v.series[v.series.length - 1]],
      }
    }
    if (metricId === 'temp' && v.id === 'temp') {
      const num = Number(values.temp)
      return {
        ...v,
        value: values.temp,
        status: evaluateVitalStatus('temp', values.temp),
        source,
        updated: 'Just now',
        series: [...v.series.slice(1), Number.isFinite(num) ? num : v.series[v.series.length - 1]],
      }
    }
    if (metricId === 'glu' && v.id === 'glu') {
      const num = Number(values.glu)
      return {
        ...v,
        value: values.glu,
        status: evaluateVitalStatus('glu', values.glu),
        source,
        updated: 'Just now',
        series: [...v.series.slice(1), Number.isFinite(num) ? num : v.series[v.series.length - 1]],
      }
    }
    if (metricId === 'sleep' && v.id === 'sleep') {
      const num = Number(values.hrs)
      return {
        ...v,
        value: values.hrs,
        status: evaluateVitalStatus('sleep', values.hrs),
        source,
        updated: 'Just now',
        series: [...v.series.slice(1), Number.isFinite(num) ? num : v.series[v.series.length - 1]],
      }
    }
    if (metricId === 'mood' && v.id === 'stress') {
      const num = Number(values.stress)
      return {
        ...v,
        value: values.stress,
        status: evaluateVitalStatus('stress', values.stress) || status,
        source,
        updated: 'Just now',
        series: [...v.series.slice(1), Number.isFinite(num) ? num : v.series[v.series.length - 1]],
      }
    }
    if (metricId === 'bp' && v.id === 'hr' && values.pulse) {
      const pulseNum = Number(values.pulse)
      if (Number.isFinite(pulseNum) && pulseNum >= 25 && pulseNum <= 230) {
        return {
          ...v,
          value: String(Math.round(pulseNum)),
          status: evaluateVitalStatus('hr', String(Math.round(pulseNum))),
          source,
          updated: 'Just now',
          series: [...v.series.slice(1), Math.round(pulseNum)],
        }
      }
    }
    return v
  })
}

export type TrendRange = '24H' | '7D' | '30D'

export const TREND_DATA: Record<TrendRange, { labels: string[]; hrv: number[]; hr: number[] }> = {
  '24H': { labels: ['00', '04', '08', '12', '16', '20', 'Now'], hrv: [46, 48, 44, 41, 40, 43, 42], hr: [64, 62, 70, 78, 80, 76, 75] },
  '7D': { labels: ['D18', 'D19', 'D20', 'D21', 'D22', 'D23', 'D24'], hrv: [50, 49, 47, 45, 44, 43, 42], hr: [70, 71, 72, 73, 74, 74, 75] },
  '30D': { labels: ['W1', '', 'W2', '', 'W3', '', 'W4'], hrv: [51, 50, 52, 49, 47, 44, 42], hr: [69, 70, 69, 71, 72, 74, 75] },
}

export function computeHeartBeatDurationSec(hrValue: string | number): number {
  const bpm = typeof hrValue === 'number' ? hrValue : Number(hrValue)
  if (!Number.isFinite(bpm) || bpm <= 0) return Number((60 / 75).toFixed(3))
  const clampedBpm = Math.min(180, Math.max(40, bpm))
  return Number((60 / clampedBpm).toFixed(3))
}

export function buildSmartAiAlertBannerSummary(
  vitals: Vital[],
  lang: Lang,
): {
  hasWarning: boolean
  isCritical: boolean
  text: string
  primaryRegionId: AnatomyRegionId
  primaryVitalId: VitalId
} {
  const abnormal = vitals.filter((v) => v.status === 'crit' || v.status === 'warn')
  if (abnormal.length === 0) {
    return {
      hasWarning: false,
      isCritical: false,
      text:
        lang === 'EN'
          ? '🟢 AI Telemetry Nominal: All 8 astronaut vital signs are stable within personal baseline'
          : '🟢 AI Sinh trắc học ổn định: Cả 8 chỉ số sinh tồn đều nằm trong ngưỡng chuẩn cá nhân',
      primaryRegionId: 'heart',
      primaryVitalId: 'hr',
    }
  }

  const isCritical = abnormal.some((v) => v.status === 'crit')
  const sorted = [...abnormal].sort((a, b) => {
    if (a.status === 'crit' && b.status !== 'crit') return -1
    if (b.status === 'crit' && a.status !== 'crit') return 1
    // Prioritize neuro/sleep & cardiac alerts
    const order: VitalId[] = ['sleep', 'hr', 'bp', 'spo2', 'hrv', 'stress', 'temp', 'glu']
    return order.indexOf(a.id) - order.indexOf(b.id)
  })

  const primary = sorted[0]
  const sleepVital = abnormal.find((v) => v.id === 'sleep')
  const hrvVital = abnormal.find((v) => v.id === 'hrv')
  const hrVital = abnormal.find((v) => v.id === 'hr')
  const bpVital = abnormal.find((v) => v.id === 'bp')

  if (sleepVital && sleepVital.status === 'crit') {
    return {
      hasWarning: true,
      isCritical: true,
      text:
        lang === 'EN'
          ? `⚠️ Neuro Alert: Severe sleep deprivation (${sleepVital.value}h) – Recommend activating rest & circadian recovery protocol`
          : `⚠️ Cảnh báo Thần kinh: Thiếu ngủ nghiêm trọng (${sleepVital.value}h) – Khuyến nghị kích hoạt phác đồ nghỉ ngơi`,
      primaryRegionId: 'brain',
      primaryVitalId: 'sleep',
    }
  }

  if (hrVital && hrVital.status !== 'ok') {
    return {
      hasWarning: true,
      isCritical,
      text:
        lang === 'EN'
          ? `⚠️ Cardiovascular Alert: Elevated heart rate (${hrVital.value} bpm) – Recommend 5-min zero-G rest & ECG check`
          : `⚠️ Cảnh báo Tim mạch: Nhịp tim vượt ngưỡng (${hrVital.value} bpm) – Khuyến nghị nghỉ tĩnh 5 phút & kiểm tra ECG`,
      primaryRegionId: 'heart',
      primaryVitalId: 'hr',
    }
  }

  if (sleepVital && hrvVital) {
    return {
      hasWarning: true,
      isCritical,
      text:
        lang === 'EN'
          ? `⚠️ Neuro-Autonomic Alert: Sleep deficit (${sleepVital.value}h) & depressed HRV (${hrvVital.value}ms) – Recommend rest & vagal breathing protocol`
          : `⚠️ Cảnh báo Thần kinh: Thiếu ngủ (${sleepVital.value}h) & suy giảm HRV (${hrvVital.value}ms) – Khuyến nghị kích hoạt phác đồ nghỉ ngơi`,
      primaryRegionId: 'brain',
      primaryVitalId: 'sleep',
    }
  }

  if (bpVital && bpVital.status !== 'ok') {
    return {
      hasWarning: true,
      isCritical,
      text:
        lang === 'EN'
          ? `⚠️ Hemodynamic Alert: Blood pressure elevated (${bpVital.value} mmHg) – Recommend CEVIS Zone-2 cap & fluid check`
          : `⚠️ Cảnh báo Huyết động: Huyết áp tăng (${bpVital.value} mmHg) – Khuyến nghị giảm tải CEVIS & thở điều hòa`,
      primaryRegionId: 'heart',
      primaryVitalId: 'bp',
    }
  }

  const regionObj = ANATOMY_REGIONS.find((r) => r.id === primary.regionId) ?? ANATOMY_REGIONS[0]
  return {
    hasWarning: true,
    isCritical,
    text:
      lang === 'EN'
        ? `⚠️ ${regionObj.shortLabel} Alert: ${primary.title} at ${primary.value} ${primary.unit} – Recommend activating countermeasure protocol`
        : `⚠️ Cảnh báo ${regionObj.viShortLabel}: ${primary.viTitle} (${primary.value} ${primary.unit}) – Khuyến nghị kích hoạt phác đồ cân bằng`,
    primaryRegionId: primary.regionId,
    primaryVitalId: primary.id,
  }
}
