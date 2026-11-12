import assert from 'node:assert/strict'
import test from 'node:test'
import {
  VITALS,
  applyAgentVitalsToState,
  buildSmartAiAlertBannerSummary,
  classifyMeasurementField,
  computeHeartBeatDurationSec,
  convertLoggedVitalToFormValues,
  evaluateVitalStatus,
  extractLoggedVitalsFromVitalsToUpdate,
  findConsecutiveDecline,
  normalizeSpacecraftVoiceResponse,
  updateVitalsWithEntry,
  vitalsToAgentPayload,
} from './astro-data.ts'

test('evaluateVitalStatus classifies NASA vital thresholds accurately', () => {
  assert.equal(evaluateVitalStatus('hr', '72'), 'ok')
  assert.equal(evaluateVitalStatus('hr', '104'), 'warn')
  assert.equal(evaluateVitalStatus('hr', '132'), 'crit')

  assert.equal(evaluateVitalStatus('bp', '118/76'), 'ok')
  assert.equal(evaluateVitalStatus('bp', '128/84'), 'warn')
  assert.equal(evaluateVitalStatus('bp', '145/94'), 'crit')

  assert.equal(evaluateVitalStatus('spo2', '98'), 'ok')
  assert.equal(evaluateVitalStatus('spo2', '93'), 'warn')
  assert.equal(evaluateVitalStatus('spo2', '88'), 'crit')

  assert.equal(evaluateVitalStatus('sleep', '7.6'), 'ok')
  assert.equal(evaluateVitalStatus('sleep', '6.1'), 'warn')
  assert.equal(evaluateVitalStatus('sleep', '4.5'), 'crit')
})

test('classifyMeasurementField returns ok, warn, crit, and empty states', () => {
  const bounds = { normal: [90, 120] as [number, number], plausible: [40, 260] as [number, number] }
  assert.equal(classifyMeasurementField(bounds, ''), 'empty')
  assert.equal(classifyMeasurementField(bounds, '115'), 'ok')
  assert.equal(classifyMeasurementField(bounds, '132'), 'warn')
  assert.equal(classifyMeasurementField(bounds, '290'), 'crit')
})

test('findConsecutiveDecline detects 3+ consecutive decline streaks', () => {
  const decliningHrv = [50, 49, 47, 45, 44, 43, 42]
  const res = findConsecutiveDecline(decliningHrv, true)
  assert.deepEqual(res, { start: 0, end: 6 })
})

test('convertLoggedVitalToFormValues maps Gemini MultimodalLoggedVital to Monitoring form fields', () => {
  const bpForm = convertLoggedVitalToFormValues({
    metricId: 'bp',
    sys: '125',
    dia: '82',
    pulse: '70',
    formattedValue: '125/82 mmHg · 70 BPM',
    status: 'warn',
  })
  assert.deepEqual(bpForm, { sys: '125', dia: '82', pulse: '70' })

  const sleepForm = convertLoggedVitalToFormValues({
    metricId: 'sleep',
    value: '7.8',
    secondaryValue: '1',
    formattedValue: '7.8 h · 1 wakes',
    status: 'ok',
  })
  assert.deepEqual(sleepForm, { hrs: '7.8', wake: '1' })
})

test('updateVitalsWithEntry updates BP and synchronizes pulse to HR simultaneously', () => {
  const updated = updateVitalsWithEntry(
    VITALS,
    'bp',
    { sys: '118', dia: '76', pulse: '68' },
    'Manual',
    'ok',
  )
  const bp = updated.find((v) => v.id === 'bp')!
  const hr = updated.find((v) => v.id === 'hr')!
  assert.equal(bp.value, '118/76')
  assert.equal(bp.status, 'ok')
  assert.equal(hr.value, '68')
  assert.equal(hr.status, 'ok')
})

test('applyAgentVitalsToState updates vitals from Gemini multimodal payload and normalizes brain on >=7h sleep', () => {
  const basePayload = vitalsToAgentPayload(VITALS)
  const { vitals: updated, changedIds } = applyAgentVitalsToState(VITALS, {
    ...basePayload,
    sleepDuration: 8.0,
    heartRate: 70,
  })
  assert.equal(changedIds.includes('sleep'), true)
  assert.equal(changedIds.includes('hr'), true)
  assert.equal(updated.find((v) => v.id === 'sleep')?.value, '8.0')
  assert.equal(updated.find((v) => v.id === 'stress')?.status, 'ok')
})

test('extractLoggedVitalsFromVitalsToUpdate extracts multiple non-null vitals from Gemini JSON', () => {
  const logged = extractLoggedVitalsFromVitalsToUpdate({
    heartRate: null,
    hrv: 52,
    systolic: 120,
    diastolic: 78,
    pulse: 68,
    spO2: 99,
    bodyTemp: 36.7,
    bloodGlucose: null,
    sleepHours: 7.5,
    stressLevel: 2,
  })
  assert.equal(logged.length, 6)
  assert.equal(logged[0].metricId, 'bp')
  assert.equal(logged[0].formattedValue, '120/78 mmHg · 68 BPM')
  assert.equal(logged[1].metricId, 'hrv')
  assert.equal(logged[1].value, '52')
})

test('normalizeSpacecraftVoiceResponse maps Section 4 JSON fields to app control actions', () => {
  const appState = {
    activeModule: 'dashboard' as const,
    activeMetricTab: 'bp' as const,
    lang: 'VI' as const,
    vitals: vitalsToAgentPayload(VITALS),
  }

  const normalized = normalizeSpacecraftVoiceResponse(
    {
      isNoiseOrUnrelated: false,
      userTranscript: 'Huyết áp 120 80 và chuyển sang mục Thân nhiệt',
      spokenReply: 'Đã lưu huyết áp 120/80 và chuyển sang mục Thân nhiệt.',
      navigateToPage: 'monitoring',
      selectMetricTab: 'bodyTemp',
      inspectBodyRegion: 'KEEP_CURRENT',
      triggerBiometricScan: false,
      autoSave: true,
      vitalsToUpdate: {
        heartRate: null,
        hrv: null,
        systolic: 120,
        diastolic: 80,
        pulse: 70,
        spO2: null,
        bodyTemp: null,
        bloodGlucose: null,
        sleepHours: null,
        stressLevel: null,
      },
      dynamicSurgeonNote: {
        cause: null,
        countermeasure: null,
      },
    },
    appState,
  )

  assert.equal(normalized.shouldIgnore, false)
  assert.equal(normalized.transcript, 'Huyết áp 120 80 và chuyển sang mục Thân nhiệt')
  assert.equal(normalized.navigateModule, 'monitoring')
  assert.equal(normalized.switchMetricTab, 'temp')
  assert.equal(normalized.loggedVitals.length, 1)
  assert.equal(normalized.loggedVitals[0].metricId, 'bp')
  assert.equal(normalized.updatedVitals.bloodPressure, '120/80')
})

test('computeHeartBeatDurationSec calculates exact real-time cardiac beat duration', () => {
  assert.equal(computeHeartBeatDurationSec(75), 0.8)
  assert.equal(computeHeartBeatDurationSec('71'), 0.845)
  assert.equal(computeHeartBeatDurationSec(120), 0.5)
})

test('buildSmartAiAlertBannerSummary returns concise single-line AI clinical insight', () => {
  const defaultSummary = buildSmartAiAlertBannerSummary(VITALS, 'VI')
  assert.equal(defaultSummary.hasWarning, true)
  assert.equal(defaultSummary.primaryRegionId, 'brain')
  assert.equal(defaultSummary.text.includes('Cảnh báo Thần kinh'), true)

  const severeSleepVitals = VITALS.map((v) =>
    v.id === 'sleep' ? { ...v, value: '2.0', status: 'crit' as const } : v,
  )
  const critSummary = buildSmartAiAlertBannerSummary(severeSleepVitals, 'VI')
  assert.equal(critSummary.isCritical, true)
  assert.equal(
    critSummary.text,
    '⚠️ Cảnh báo Thần kinh: Thiếu ngủ nghiêm trọng (2.0h) – Khuyến nghị kích hoạt phác đồ nghỉ ngơi',
  )
})

test('evaluateRuleBasedAnalytics executes 4-step pipeline and produces A-I-A structure', async () => {
  const { evaluateRuleBasedAnalytics, detectTrendStreak } = await import('./rule-based-analytics.ts')

  // 1. Nominal case (stable series without adverse streak)
  const nominal = evaluateRuleBasedAnalytics({
    metricId: 'hr',
    currentValue: 69,
    baselineValue: 68,
    seriesValues: [68, 69, 68, 69],
    unit: 'BPM',
    lowerIsWorse: false,
    lang: 'VI',
  })
  assert.equal(nominal.assessment.status, 'NOMINAL')
  assert.equal(nominal.assessment.statusLabelVi, 'Trong Giới hạn Tham chiếu')
  assert.equal(nominal.action.urgencyLevelVi, 'Duy trì Quy trình Vận hành Định kỳ')

  // 2. Monitoring case with streak
  const monitoring = evaluateRuleBasedAnalytics({
    metricId: 'hrv',
    currentValue: 42,
    baselineValue: 56,
    seriesValues: [50, 48, 45, 43, 42],
    unit: 'ms',
    lowerIsWorse: true,
    lang: 'VI',
  })
  assert.equal(monitoring.assessment.status, 'MONITORING')
  assert.equal(monitoring.insight.trendDetected, true)
  assert.equal(monitoring.action.targetModule, 'monitoring')

  // 3. Medical attention case (acute drop)
  const critical = evaluateRuleBasedAnalytics({
    metricId: 'spo2',
    currentValue: 89,
    baselineValue: 98.5,
    seriesValues: [98, 97, 95, 89],
    unit: '%',
    lowerIsWorse: true,
    lang: 'EN',
  })
  assert.equal(critical.assessment.status, 'MEDICAL_ATTENTION')
  assert.equal(critical.assessment.severityScore, 3)
  assert.equal(critical.action.targetModule, 'ai')
})


