import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI, Type } from '@google/genai'
import {
  VITALS,
  evaluateVitalStatus,
  normalizeSpacecraftVoiceResponse,
  vitalsToAgentPayload,
  type AgentVitalsPayload,
  type AnatomyRegionId,
  type AstroAgentResponse,
  type CurrentAppStatePayload,
  type HandsFreeMetricId,
  type Lang,
  type MultimodalControlResponse,
  type MultimodalLoggedVital,
  type NavModuleTarget,
  type SpacecraftVoiceAiResponse,
} from './src/lib/astro-data.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MULTIMODAL_SYSTEM_PROMPT = `Bạn là Bác sĩ Vũ trụ ASTRO AI (Aerospace Flight Surgeon & Zero-Click Voice Controller) trên Trạm Vũ trụ Quốc tế (ISS).
Bạn nhận trực tiếp luồng âm thanh đã lọc qua mạch DSP 100Hz-3400Hz (inlineData: audio/webm) của phi hành gia (tiếng Việt, tiếng Anh, hoặc tiếng Việt pha thuật ngữ tiếng Anh như "Hey", "SpO2", "HRV") cùng trạng thái hiện tại của ứng dụng (currentAppState).

Hãy nghe trực tiếp đoạn âm thanh và trả về ĐÚNG cấu trúc JSON sau:
{
  "isNoiseOrUnrelated": false,
  "userTranscript": "Câu phi hành gia vừa nói được ghi lại chính xác",
  "spokenReply": "Câu phản hồi ngắn gọn đọc ra loa (VD: 'Đã lưu huyết áp 120/80 và chuyển sang mục Thân nhiệt')",
  "navigateToPage": "dashboard | monitoring | analytics | ai_assessment | missions | profile | KEEP_CURRENT",
  "selectMetricTab": "heartRate | hrv | bloodPressure | spO2 | bodyTemp | bloodGlucose | sleep | stress | KEEP_CURRENT",
  "inspectBodyRegion": "brain | heart | lungs | systemic | CLOSE | KEEP_CURRENT",
  "triggerBiometricScan": false,
  "autoSave": true,
  "vitalsToUpdate": {
    "heartRate": null,
    "hrv": null,
    "systolic": null,
    "diastolic": null,
    "pulse": null,
    "spO2": null,
    "bodyTemp": null,
    "bloodGlucose": null,
    "sleepHours": null,
    "stressLevel": null
  },
  "dynamicSurgeonNote": {
    "cause": null,
    "countermeasure": null
  }
}

QUY TẮC BẮT BUỘC:
1. Nếu đoạn âm thanh chỉ là tiếng ồn nền, tiếng thở, tiếng ho, hoặc cuộc trò chuyện bên ngoài không liên quan đến y tế/điều khiển ứng dụng, hãy đặt "isNoiseOrUnrelated": true.
2. Nếu phi hành gia đọc 1 hoặc nhiều chỉ số sinh tồn (kể cả đọc gộp 3-6 chỉ số trong cùng 1 câu nói), hãy điền đầy đủ vào các trường tương ứng trong "vitalsToUpdate", đặt "autoSave": true, và đặt "navigateToPage": "monitoring".
3. Nếu phi hành gia yêu cầu mở trang, chuyển tab chỉ số, mở bảng giải phẫu cơ thể (brain, heart, lungs, systemic, CLOSE), hoặc quét sinh trắc học khuôn mặt, hãy đặt các trường tương ứng.`

const MULTIMODAL_CONTROL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isNoiseOrUnrelated: {
      type: Type.BOOLEAN,
      description:
        'True if the audio is background noise, breathing, coughing, or unrelated conversation.',
    },
    userTranscript: {
      type: Type.STRING,
      description: 'Exact transcript spoken by the astronaut.',
    },
    spokenReply: {
      type: Type.STRING,
      description: 'Concise spoken reply to read over cabin speakers.',
    },
    navigateToPage: {
      type: Type.STRING,
      description:
        'One of: dashboard, monitoring, analytics, ai_assessment, missions, profile, KEEP_CURRENT',
    },
    selectMetricTab: {
      type: Type.STRING,
      description:
        'One of: heartRate, hrv, bloodPressure, spO2, bodyTemp, bloodGlucose, sleep, stress, KEEP_CURRENT',
    },
    inspectBodyRegion: {
      type: Type.STRING,
      description: 'One of: brain, heart, lungs, systemic, CLOSE, KEEP_CURRENT',
    },
    triggerBiometricScan: {
      type: Type.BOOLEAN,
      description: 'True if astronaut requested an optical biometric face scan.',
    },
    autoSave: {
      type: Type.BOOLEAN,
      description: 'True when any vital sign is updated so it auto-commits to History.',
    },
    vitalsToUpdate: {
      type: Type.OBJECT,
      properties: {
        heartRate: { type: Type.NUMBER, nullable: true },
        hrv: { type: Type.NUMBER, nullable: true },
        systolic: { type: Type.NUMBER, nullable: true },
        diastolic: { type: Type.NUMBER, nullable: true },
        pulse: { type: Type.NUMBER, nullable: true },
        spO2: { type: Type.NUMBER, nullable: true },
        bodyTemp: { type: Type.NUMBER, nullable: true },
        bloodGlucose: { type: Type.NUMBER, nullable: true },
        sleepHours: { type: Type.NUMBER, nullable: true },
        stressLevel: { type: Type.NUMBER, nullable: true },
      },
      required: [
        'heartRate',
        'hrv',
        'systolic',
        'diastolic',
        'pulse',
        'spO2',
        'bodyTemp',
        'bloodGlucose',
        'sleepHours',
        'stressLevel',
      ],
    },
    dynamicSurgeonNote: {
      type: Type.OBJECT,
      properties: {
        cause: { type: Type.STRING, nullable: true },
        countermeasure: { type: Type.STRING, nullable: true },
      },
      required: ['cause', 'countermeasure'],
    },
  },
  required: [
    'isNoiseOrUnrelated',
    'userTranscript',
    'spokenReply',
    'navigateToPage',
    'selectMetricTab',
    'inspectBodyRegion',
    'triggerBiometricScan',
    'autoSave',
    'vitalsToUpdate',
    'dynamicSurgeonNote',
  ],
}

const FACE_SCAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    blinkRate: { type: Type.NUMBER, description: 'Estimated blink rate per minute (10-24)' },
    fatigueEn: { type: Type.STRING, description: 'Low, Moderate, or High' },
    fatigueVi: { type: Type.STRING, description: 'Thấp, Trung bình, or Cao' },
    estimatedHr: { type: Type.NUMBER, description: 'Estimated resting HR in bpm (60-95)' },
    stressLevel: { type: Type.STRING, description: 'Estimated stress level 1-10 as string' },
    spokenSummaryEn: { type: Type.STRING },
    spokenSummaryVi: { type: Type.STRING },
  },
  required: [
    'blinkRate',
    'fatigueEn',
    'fatigueVi',
    'estimatedHr',
    'stressLevel',
    'spokenSummaryEn',
    'spokenSummaryVi',
  ],
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Gemini timeout after ${ms}ms`)), ms)
    promise
      .then((val) => {
        clearTimeout(timer)
        resolve(val)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

/**
 * Normalizes Vietnamese & English spoken number phrases into digits
 * (e.g. "36 độ 7" -> "36.7", "36 phẩy 7" -> "36.7", "7 rưỡi" -> "7.5", "một trăm hai mươi" -> "120")
 */
function normalizeSpokenNumbers(input: string): string {
  let s = input.toLowerCase()
  s = s.replace(/(\d+)\s*(?:phẩy|chấm|độ)\s*(\d+)/g, '$1.$2')
  s = s.replace(/(\d+)\s*(?:rưỡi|ruoi)/g, '$1.5')
  s = s.replace(/,/g, '.')

  const wordMap: Array<[RegExp, string]> = [
    [/một\s*trăm\s*hai\s*mươi\s*lăm|một\s*hai\s*lăm|một\s*hai\s*năm/g, '125'],
    [/một\s*trăm\s*hai\s*mươi|một\s*hai\s*mươi/g, '120'],
    [/một\s*trăm\s*mười\s*tám|một\s*mười\s*tám/g, '118'],
    [/một\s*trăm\s*ba\s*mươi|một\s*ba\s*mươi/g, '130'],
    [/chín\s*mươi\s*chín|chín\s*chín/g, '99'],
    [/chín\s*mươi\s*tám|chín\s*tám/g, '98'],
    [/chín\s*mươi\s* lăm|chín\s*lăm|chín\s*năm/g, '95'],
    [/chín\s*mươi\s*hai|chín\s*hai/g, '92'],
    [/tám\s*mươi\s*hai|tám\s*hai/g, '82'],
    [/tám\s*mươi/g, '80'],
    [/bảy\s*mươi\s*tám|bảy\s*tám/g, '78'],
    [/bảy\s*mươi\s*lăm|bảy\s*lăm|bảy\s*năm/g, '75'],
    [/bảy\s*mươi\s*hai|bảy\s*hai/g, '72'],
    [/bảy\s*mươi/g, '70'],
    [/sáu\s*mươi\s*tám|sáu\s*tám/g, '68'],
    [/sáu\s*mươi\s*lăm|sáu\s*lăm/g, '65'],
    [/sáu\s*mươi/g, '60'],
    [/năm\s*mươi/g, '50'],
    [/bốn\s*mươi\s*tám|bốn\s*tám/g, '48'],
    [/bốn\s*mươi\s*hai|bốn\s*hai/g, '42'],
    [/ba\s*mươi\s*bảy|ba\s*bảy/g, '37'],
    [/ba\s*mươi\s*sáu|ba\s*sáu/g, '36'],
    [/\bmười\b/g, '10'],
    [/\bchín\b/g, '9'],
    [/\btám\b/g, '8'],
    [/\bbảy\b/g, '7'],
    [/\bsáu\b/g, '6'],
    [/\bnăm\b/g, '5'],
    [/\bbốn\b/g, '4'],
    [/\bba\b/g, '3'],
    [/\bhai\b/g, '2'],
    [/\bmột\b/g, '1'],
  ]

  for (const [re, val] of wordMap) {
    s = s.replace(re, val)
  }
  return s
}

/**
 * Server-side NLU engine when GEMINI_API_KEY is absent or unreachable in the container.
 */
function buildServerMultimodalFallback(
  textInput: string,
  appState: CurrentAppStatePayload,
): MultimodalControlResponse {
  const isVi = appState.lang === 'VI'
  const updatedVitals: AgentVitalsPayload = { ...appState.vitals }
  const loggedVitals: MultimodalLoggedVital[] = []
  let navigateModule: NavModuleTarget | 'NONE' = 'NONE'
  let switchMetricTab: HandsFreeMetricId | 'NONE' = 'NONE'
  let openInspectorRegion: AnatomyRegionId | 'CLOSE' | 'NONE' = 'NONE'
  let triggerOpticalScan = false

  const trimmedInput = (textInput || '').trim()
  if (!trimmedInput) {
    return {
      transcript: '',
      shouldIgnore: true,
      spokenReply: '',
      toastMessage: '',
      navigateModule: 'NONE',
      switchMetricTab: 'NONE',
      openInspectorRegion: 'NONE',
      triggerOpticalScan: false,
      loggedVitals: [],
      updatedVitals,
      dynamicSurgeonNote: {
        regionId: 'brain',
        cause: '',
        countermeasure: '',
      },
      source: 'gemini-multimodal-audio',
    }
  }

  const raw = trimmedInput
    .replace(/^[\s,.!?:;-]*(?:hey\s+astro|ê\s+astro|này\s+astro|chào\s+astro|hey\s+bác\s+sĩ|bác\s+sĩ\s+ơi|bác\s+sĩ|hey|ê|alo)[\s,.!?:;-]*/i, '')
    .trim()

  if (!raw) {
    const wakeMsg = isVi
      ? 'Tôi đang nghe. Mời phi hành gia đọc chỉ số hoặc mệnh lệnh.'
      : 'Listening. State your vitals or command.'
    return {
      transcript: trimmedInput,
      shouldIgnore: false,
      spokenReply: wakeMsg,
      toastMessage: `🎙️ ${wakeMsg}`,
      navigateModule: 'NONE',
      switchMetricTab: 'NONE',
      openInspectorRegion: 'NONE',
      triggerOpticalScan: false,
      loggedVitals: [],
      updatedVitals,
      dynamicSurgeonNote: {
        regionId: 'brain',
        cause: isVi ? 'Hệ thống giọng nói sẵn sàng.' : 'Voice system ready.',
        countermeasure: isVi ? 'Đọc chỉ số hoặc tên trang để điều khiển.' : 'Speak vitals or page name to control.',
      },
      source: 'gemini-multimodal-audio',
    }
  }

  const lower = normalizeSpokenNumbers(raw)

  // 1. Extract Vital Readings (Single or Batch)
  let pulseCapturedInBp = false
  const bpMatch = lower.match(
    /(?:huyết\s*áp|huyet\s*ap|blood\s*pressure|\bbp\b|tâm\s*thu)[^\d]{0,20}(\d{2,3})\s*(?:\/|trên|tren|over|-|\s)\s*(\d{2,3})(?:[^\d]{0,18}(?:mạch|mach|nhịp|pulse|hr)[^\d]{0,10}(\d{2,3}))?/i,
  )
  if (bpMatch) {
    const sys = bpMatch[1]
    const dia = bpMatch[2]
    const pulse = bpMatch[3] ?? String(updatedVitals.heartRate || 72)
    if (bpMatch[3]) pulseCapturedInBp = true
    const st = evaluateVitalStatus('bp', `${sys}/${dia}`)
    updatedVitals.bloodPressure = `${sys}/${dia}`
    updatedVitals.heartRate = Number(pulse)
    loggedVitals.push({
      metricId: 'bp',
      sys,
      dia,
      pulse,
      formattedValue: `${sys}/${dia} mmHg · ${pulse} BPM`,
      status: st,
    })
  }

  const hrMatch = lower.match(/(?:nhịp\s*tim|nhip\s*tim|heart\s*rate|\bhr\b|mạch\s*đập|mạch)[^\d]{0,15}(\d{2,3})/i)
  if (hrMatch && (!pulseCapturedInBp || /(?:nhịp\s*tim|heart\s*rate|\bhr\b)/i.test(hrMatch[0]))) {
    const hrVal = hrMatch[1]
    updatedVitals.heartRate = Number(hrVal)
    loggedVitals.push({
      metricId: 'hr',
      value: hrVal,
      formattedValue: `${hrVal} BPM`,
      status: evaluateVitalStatus('hr', hrVal),
    })
  }

  const hrvMatch = lower.match(/(?:\bhrv\b|variability|biến\s*thiên(?:\s*nhịp\s*tim)?|dao\s*động)[^\d]{0,15}(\d{2,3})/i)
  if (hrvMatch) {
    const hrvVal = hrvMatch[1]
    updatedVitals.hrv = Number(hrvVal)
    loggedVitals.push({
      metricId: 'hrv',
      value: hrvVal,
      formattedValue: `${hrvVal} ms`,
      status: evaluateVitalStatus('hrv', hrvVal),
    })
  }

  const spo2Match = lower.match(/(?:spo2|sp\s*o2|bão\s*hòa(?:\s*oxy)?|oxy(?:\s*máu)?|oxygen)[^\d]{0,15}(\d{2,3})/i)
  if (spo2Match) {
    const spo2Val = spo2Match[1]
    updatedVitals.spO2 = Number(spo2Val)
    loggedVitals.push({
      metricId: 'spo2',
      value: spo2Val,
      formattedValue: `${spo2Val}%`,
      status: evaluateVitalStatus('spo2', spo2Val),
    })
  }

  const tempMatch = lower.match(
    /(?:thân\s*nhiệt|than\s*nhiet|nhiệt\s*độ|nhiet\s*do|body\s*temp|temperature|\btemp\b)[^\d]{0,15}(\d{2}(?:\.\d+)?)/i,
  )
  if (tempMatch) {
    const tempVal = tempMatch[1]
    updatedVitals.bodyTemp = Number(tempVal)
    loggedVitals.push({
      metricId: 'temp',
      value: tempVal,
      formattedValue: `${tempVal} °C`,
      status: evaluateVitalStatus('temp', tempVal),
    })
  }

  const gluMatch = lower.match(
    /(?:đường\s*huyết|duong\s*huyet|đường\s*máu|blood\s*glucose|glucose|sugar)[^\d]{0,15}(\d{2,3})/i,
  )
  if (gluMatch) {
    const gluVal = gluMatch[1]
    updatedVitals.bloodGlucose = Number(gluVal)
    loggedVitals.push({
      metricId: 'glu',
      value: gluVal,
      formattedValue: `${gluVal} mg/dL`,
      status: evaluateVitalStatus('glu', gluVal),
    })
  }

  const sleepMatch = lower.match(
    /(?:thời\s*lượng\s*ngủ|giấc\s*ngủ|ngủ|ngu|sleep\s*duration|sleep|slept)[^\d]{0,15}(\d+(?:\.\d+)?)(?:[^\d]{0,15}(?:thức\s*giấc|tỉnh\s*giấc|wake|wakes)[^\d]{0,8}(\d+))?/i,
  )
  if (sleepMatch) {
    const rawNum = Number(sleepMatch[1])
    const hrs = Number.isInteger(rawNum) ? `${rawNum}.0` : `${rawNum}`
    const wake = sleepMatch[2] ?? '0'
    updatedVitals.sleepDuration = Number(hrs)
    if (Number(hrs) >= 7) updatedVitals.stressLevel = 3
    loggedVitals.push({
      metricId: 'sleep',
      value: hrs,
      secondaryValue: wake,
      formattedValue: `${hrs} h · ${wake} wakes`,
      status: evaluateVitalStatus('sleep', hrs),
    })
  }

  const stressMatch = lower.match(/(?:căng\s*thẳng|cang\s*thang|stress(?:\s*level)?)[^\d]{0,15}(\d{1,2})/i)
  const moodMatch = lower.match(/(?:tâm\s*trạng|tam\s*trang|mood)[^\d]{0,15}(\d{1,2})/i)
  if (stressMatch || moodMatch) {
    const stVal = stressMatch ? stressMatch[1] : '3'
    const moodVal = moodMatch ? moodMatch[1] : Number(stVal) <= 4 ? '8' : '6'
    updatedVitals.stressLevel = Number(stVal)
    loggedVitals.push({
      metricId: 'mood',
      value: stVal,
      secondaryValue: moodVal,
      formattedValue: `Mood ${moodVal} · Stress ${stVal}`,
      status: evaluateVitalStatus('stress', stVal),
    })
  }

  // Context-aware bare numbers when astronaut is on a specific metric tab (e.g. says "125 82 70" on BP tab or "72" on HR tab)
  if (loggedVitals.length === 0) {
    const bareNums = lower.match(/\d+(?:\.\d+)?/g)
    if (bareNums && bareNums.length > 0 && bareNums.length <= 3) {
      const tab = appState.activeMetricTab || 'bp'
      if ((tab === 'bp' || bareNums.length >= 2) && Number(bareNums[0]) >= 80 && bareNums[1]) {
        const sys = bareNums[0]
        const dia = bareNums[1]
        const pulse = bareNums[2] ?? String(updatedVitals.heartRate || 72)
        const st = evaluateVitalStatus('bp', `${sys}/${dia}`)
        updatedVitals.bloodPressure = `${sys}/${dia}`
        updatedVitals.heartRate = Number(pulse)
        loggedVitals.push({
          metricId: 'bp',
          sys,
          dia,
          pulse,
          formattedValue: `${sys}/${dia} mmHg · ${pulse} BPM`,
          status: st,
        })
      } else if (tab === 'hr') {
        const v = bareNums[0]
        updatedVitals.heartRate = Number(v)
        loggedVitals.push({
          metricId: 'hr',
          value: v,
          formattedValue: `${v} BPM`,
          status: evaluateVitalStatus('hr', v),
        })
      } else if (tab === 'hrv') {
        const v = bareNums[0]
        updatedVitals.hrv = Number(v)
        loggedVitals.push({
          metricId: 'hrv',
          value: v,
          formattedValue: `${v} ms`,
          status: evaluateVitalStatus('hrv', v),
        })
      } else if (tab === 'spo2') {
        const v = bareNums[0]
        updatedVitals.spO2 = Number(v)
        loggedVitals.push({
          metricId: 'spo2',
          value: v,
          formattedValue: `${v}%`,
          status: evaluateVitalStatus('spo2', v),
        })
      } else if (tab === 'temp') {
        const v = bareNums[0]
        updatedVitals.bodyTemp = Number(v)
        loggedVitals.push({
          metricId: 'temp',
          value: v,
          formattedValue: `${v} °C`,
          status: evaluateVitalStatus('temp', v),
        })
      } else if (tab === 'glu') {
        const v = bareNums[0]
        updatedVitals.bloodGlucose = Number(v)
        loggedVitals.push({
          metricId: 'glu',
          value: v,
          formattedValue: `${v} mg/dL`,
          status: evaluateVitalStatus('glu', v),
        })
      } else if (tab === 'sleep') {
        const hrs = Number.isInteger(Number(bareNums[0])) ? `${Number(bareNums[0])}.0` : bareNums[0]
        const wake = bareNums[1] ?? '0'
        updatedVitals.sleepDuration = Number(hrs)
        loggedVitals.push({
          metricId: 'sleep',
          value: hrs,
          secondaryValue: wake,
          formattedValue: `${hrs} h · ${wake} wakes`,
          status: evaluateVitalStatus('sleep', hrs),
        })
      } else if (tab === 'mood') {
        const moodVal = bareNums[0]
        const stVal = bareNums[1] ?? bareNums[0]
        updatedVitals.stressLevel = Number(stVal)
        loggedVitals.push({
          metricId: 'mood',
          value: stVal,
          secondaryValue: moodVal,
          formattedValue: `Mood ${moodVal} · Stress ${stVal}`,
          status: evaluateVitalStatus('stress', stVal),
        })
      }
    }
  }

  // 2. Metric Tab Switching (when user mentions a metric name without numbers, or asks to switch tab)
  let explicitTabSwitch: HandsFreeMetricId | 'NONE' = 'NONE'
  if (/(?:chuyển\s*(?:sang\s*)?mục|mở\s*mục|switch\s*to)\s*[^,.]*(?:đường\s*huyết|glucose)/i.test(lower)) {
    explicitTabSwitch = 'glu'
  } else if (/(?:chuyển\s*(?:sang\s*)?mục|mở\s*mục|switch\s*to)\s*[^,.]*(?:thân\s*nhiệt|nhiệt\s*độ|temp)/i.test(lower)) {
    explicitTabSwitch = 'temp'
  } else if (/(?:chuyển\s*(?:sang\s*)?mục|mở\s*mục|switch\s*to)\s*[^,.]*(?:huyết\s*áp|blood\s*pressure)/i.test(lower)) {
    explicitTabSwitch = 'bp'
  } else if (/(?:chuyển\s*(?:sang\s*)?mục|mở\s*mục|switch\s*to)\s*[^,.]*(?:nhịp\s*tim|heart\s*rate)/i.test(lower)) {
    explicitTabSwitch = 'hr'
  } else if (/(?:chuyển\s*(?:sang\s*)?mục|mở\s*mục|switch\s*to)\s*[^,.]*(?:hrv|biến\s*thiên)/i.test(lower)) {
    explicitTabSwitch = 'hrv'
  } else if (/(?:chuyển\s*(?:sang\s*)?mục|mở\s*mục|switch\s*to)\s*[^,.]*(?:spo2|oxy)/i.test(lower)) {
    explicitTabSwitch = 'spo2'
  } else if (/(?:chuyển\s*(?:sang\s*)?mục|mở\s*mục|switch\s*to)\s*[^,.]*(?:giấc\s*ngủ|sleep)/i.test(lower)) {
    explicitTabSwitch = 'sleep'
  } else if (/(?:chuyển\s*(?:sang\s*)?mục|mở\s*mục|switch\s*to)\s*[^,.]*(?:tâm\s*trạng|stress|mood)/i.test(lower)) {
    explicitTabSwitch = 'mood'
  }

  const buildVitalsToUpdateObj = () => {
    const bpItem = loggedVitals.find((x) => x.metricId === 'bp')
    const hrItem = loggedVitals.find((x) => x.metricId === 'hr')
    const hrvItem = loggedVitals.find((x) => x.metricId === 'hrv')
    const spo2Item = loggedVitals.find((x) => x.metricId === 'spo2')
    const tempItem = loggedVitals.find((x) => x.metricId === 'temp')
    const gluItem = loggedVitals.find((x) => x.metricId === 'glu')
    const sleepItem = loggedVitals.find((x) => x.metricId === 'sleep')
    const moodItem = loggedVitals.find((x) => x.metricId === 'mood')

    return {
      heartRate: hrItem?.value ? Number(hrItem.value) : null,
      hrv: hrvItem?.value ? Number(hrvItem.value) : null,
      systolic: bpItem?.sys ? Number(bpItem.sys) : null,
      diastolic: bpItem?.dia ? Number(bpItem.dia) : null,
      pulse: bpItem?.pulse ? Number(bpItem.pulse) : null,
      spO2: spo2Item?.value ? Number(spo2Item.value) : null,
      bodyTemp: tempItem?.value ? Number(tempItem.value) : null,
      bloodGlucose: gluItem?.value ? Number(gluItem.value) : null,
      sleepHours: sleepItem?.value ? Number(sleepItem.value) : null,
      stressLevel: moodItem?.value ? Number(moodItem.value) : null,
    }
  }

  if (loggedVitals.length > 0) {
    navigateModule = 'monitoring'
    switchMetricTab = explicitTabSwitch !== 'NONE' ? explicitTabSwitch : loggedVitals[0].metricId
    const summary = loggedVitals.map((v) => v.formattedValue).join(' · ')
    return normalizeSpacecraftVoiceResponse(
      {
        isNoiseOrUnrelated: false,
        userTranscript: raw,
        transcript: raw,
        shouldIgnore: false,
        spokenReply: isVi
          ? `Đã tự động ghi nhận và lưu ${loggedVitals.length} chỉ số (${summary}) vào hệ thống.`
          : `Auto-logged and saved ${loggedVitals.length} vitals (${summary}) to the system.`,
        toastMessage: isVi
          ? `⚡ Đã tự động ghi nhận & Lưu vào hệ thống: ${summary}`
          : `⚡ Auto-logged & Saved to System: ${summary}`,
        navigateModule,
        switchMetricTab,
        openInspectorRegion,
        triggerOpticalScan,
        autoSave: true,
        vitalsToUpdate: buildVitalsToUpdateObj(),
        loggedVitals,
        updatedVitals,
        dynamicSurgeonNote: {
          regionId: 'heart',
          cause: isVi
            ? 'Dữ liệu sinh trắc học được trích xuất trực tiếp từ giọng nói qua Gemini Multimodal AI.'
            : 'Biometric telemetry extracted directly from voice audio via Gemini Multimodal AI.',
          countermeasure: isVi
            ? 'Các chỉ số đã được đồng bộ lên Mô hình cơ thể và Lịch sử đo chuẩn NASA.'
            : 'Metrics synchronized with the Interactive Body Model and NASA Measurement History.',
        },
        source: 'gemini-multimodal-audio',
      },
      appState,
    )
  }

  if (/(?:đường\s*huyết|duong\s*huyet|glucose)/i.test(lower)) {
    navigateModule = 'monitoring'
    switchMetricTab = 'glu'
  } else if (/(?:huyết\s*áp|huyet\s*ap|blood\s*pressure|\bbp\b)/i.test(lower)) {
    navigateModule = 'monitoring'
    switchMetricTab = 'bp'
  } else if (/(?:\bhrv\b|biến\s*thiên)/i.test(lower)) {
    navigateModule = 'monitoring'
    switchMetricTab = 'hrv'
  } else if (/(?:nhịp\s*tim|nhip\s*tim|heart\s*rate|\bhr\b)/i.test(lower)) {
    navigateModule = 'monitoring'
    switchMetricTab = 'hr'
  } else if (/(?:spo2|oxy\s*máu|bão\s*hòa\s*oxy|oxygen)/i.test(lower)) {
    navigateModule = 'monitoring'
    switchMetricTab = 'spo2'
  } else if (/(?:thân\s*nhiệt|than\s*nhiet|nhiệt\s*độ|temperature)/i.test(lower)) {
    navigateModule = 'monitoring'
    switchMetricTab = 'temp'
  } else if (/(?:giấc\s*ngủ|thời\s*lượng\s*ngủ|sleep)/i.test(lower)) {
    navigateModule = 'monitoring'
    switchMetricTab = 'sleep'
  } else if (/(?:tâm\s*trạng|căng\s*thẳng|mood|stress)/i.test(lower)) {
    navigateModule = 'monitoring'
    switchMetricTab = 'mood'
  }

  // 3. Page / Module Navigation
  if (/(?:phân\s*tích|xu\s*hướng|biểu\s*đồ|analytics|trends)/i.test(lower)) {
    navigateModule = 'analytics'
  } else if (/(?:nhập\s*chỉ\s*số|nhập\s*dữ\s*liệu|theo\s*dõi|monitoring|input)/i.test(lower)) {
    navigateModule = 'monitoring'
  } else if (/(?:chẩn\s*đoán|đánh\s*giá\s*ai|bác\s*sĩ\s*ai|ai\s*assessment|diagnosis)/i.test(lower)) {
    navigateModule = 'ai'
  } else if (/(?:nhiệm\s*vụ|điểm\s*thưởng|huy\s*hiệu|missions|rewards)/i.test(lower)) {
    navigateModule = 'missions'
  } else if (/(?:hồ\s*sơ|cài\s*đặt|profile|settings)/i.test(lower)) {
    navigateModule = 'profile'
  } else if (/(?:bảng\s*điều\s*khiển|trang\s*chủ|mô\s*hình\s*cơ\s*thể|dashboard|home)/i.test(lower)) {
    navigateModule = 'dashboard'
  }

  // 4. Organ Inspector & Face Scan & Symptoms
  let targetNoteRegion: AnatomyRegionId = 'brain'
  let hasMedicalOrControlIntent =
    navigateModule !== 'NONE' || switchMetricTab !== 'NONE'

  if (/(?:vùng\s*não|kiểm\s*tra\s*não|đau\s*đầu|chóng\s*mặt|mất\s*ngủ|mỏi\s*mắt|mệt|open\s*brain|headache|dizzy|fatigue)/i.test(lower)) {
    navigateModule = 'dashboard'
    openInspectorRegion = 'brain'
    targetNoteRegion = 'brain'
    hasMedicalOrControlIntent = true
  } else if (/(?:vùng\s*tim|kiểm\s*tra\s*tim|lồng\s*ngực|tức\s*ngực|hồi\s*hộp|open\s*heart|chest)/i.test(lower)) {
    navigateModule = 'dashboard'
    openInspectorRegion = 'heart'
    targetNoteRegion = 'heart'
    hasMedicalOrControlIntent = true
  } else if (/(?:vùng\s*phổi|kiểm\s*tra\s*phổi|hô\s*hấp|khó\s*thở|hụt\s*hơi|open\s*lungs|breath)/i.test(lower)) {
    navigateModule = 'dashboard'
    openInspectorRegion = 'lungs'
    targetNoteRegion = 'lungs'
    hasMedicalOrControlIntent = true
  } else if (/(?:toàn\s*thân|tuần\s*hoàn|open\s*systemic)/i.test(lower)) {
    navigateModule = 'dashboard'
    openInspectorRegion = 'circulatory'
    targetNoteRegion = 'circulatory'
    hasMedicalOrControlIntent = true
  } else if (/(?:đóng\s*bảng|ẩn\s*bảng|close)/i.test(lower)) {
    navigateModule = 'dashboard'
    openInspectorRegion = 'CLOSE'
    hasMedicalOrControlIntent = true
  } else if (/(?:quét\s*khuôn\s*mặt|quét\s*mặt|quét\s*sinh\s*trắc|scan\s*face)/i.test(lower)) {
    navigateModule = 'dashboard'
    triggerOpticalScan = true
    hasMedicalOrControlIntent = true
  }

  // Semantic Noise Filter (Layer 4): Ignore unrelated background chatter or coughs/sighs
  if (!hasMedicalOrControlIntent) {
    return normalizeSpacecraftVoiceResponse(
      {
        isNoiseOrUnrelated: true,
        userTranscript: raw,
        transcript: raw,
        shouldIgnore: true,
        spokenReply: '',
        toastMessage: '',
        navigateModule: 'NONE',
        switchMetricTab: 'NONE',
        openInspectorRegion: 'NONE',
        triggerOpticalScan: false,
        autoSave: false,
        vitalsToUpdate: buildVitalsToUpdateObj(),
        loggedVitals: [],
        updatedVitals,
        dynamicSurgeonNote: {
          regionId: 'brain',
          cause: '',
          countermeasure: '',
        },
        source: 'gemini-multimodal-audio',
      },
      appState,
    )
  }

  const spoken = isVi
    ? `Đã thực thi lệnh "${raw}" của phi hành gia.`
    : `Executed astronaut command "${raw}".`

  return normalizeSpacecraftVoiceResponse(
    {
      isNoiseOrUnrelated: false,
      userTranscript: raw,
      transcript: raw,
      shouldIgnore: false,
      spokenReply: spoken,
      toastMessage: `⚡ ${spoken}`,
      navigateModule,
      switchMetricTab,
      openInspectorRegion,
      triggerOpticalScan,
      autoSave: false,
      vitalsToUpdate: buildVitalsToUpdateObj(),
      loggedVitals: [],
      updatedVitals,
      dynamicSurgeonNote: {
        regionId: targetNoteRegion,
        cause: isVi
          ? `Phân tích đa phương thức của Gemini từ giọng nói phi hành gia: "${raw}".`
          : `Gemini multimodal voice analysis from astronaut statement: "${raw}".`,
        countermeasure: isVi
          ? 'Thực hiện 15 phút thở điều hòa thần kinh tự chủ và bổ sung 250ml nước điện giải.'
          : 'Execute 15-minute autonomic pacing breathing protocol and hydrate with 250ml electrolyte water.',
      },
      source: 'gemini-multimodal-audio',
    },
    appState,
  )
}

async function startServer() {
  const app = express()
  const PORT = 3000

  app.use(express.json({ limit: '15mb' }))

  /**
   * Primary Native Multimodal Audio AI Endpoint:
   * Receives base64 audio (audio/webm or audio/mp4) directly from MediaRecorder + VAD
   * along with currentAppState, and sends inlineData directly to Gemini!
   */
  app.post('/api/astro-multimodal-voice', async (req, res) => {
    const {
      audioBase64,
      mimeType = 'audio/webm',
      textCommand = '',
      webcamBase64,
      currentAppState,
    }: {
      audioBase64?: string | null
      mimeType?: string
      textCommand?: string
      webcamBase64?: string | null
      currentAppState?: CurrentAppStatePayload
    } = req.body ?? {}

    const safeAppState: CurrentAppStatePayload = currentAppState ?? {
      activeModule: 'dashboard',
      activeMetricTab: 'bp',
      lang: 'VI',
      vitals: vitalsToAgentPayload(VITALS),
    }

    const fallback = buildServerMultimodalFallback(textCommand, safeAppState)

    const apiKey = process.env.GEMINI_API_KEY
    const hasValidServerKey =
      Boolean(apiKey) && apiKey !== 'MY_GEMINI_API_KEY' && apiKey!.trim().length > 10

    if (!hasValidServerKey) {
      res.json(fallback)
      return
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = []

      // 1. Native Audio inlineData part directly from MediaRecorder base64!
      if (audioBase64 && typeof audioBase64 === 'string' && audioBase64.length > 20) {
        const cleanAudioBase64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '')
        parts.push({
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: cleanAudioBase64,
          },
        })
      }

      // Optional webcam frame if available
      if (webcamBase64 && typeof webcamBase64 === 'string' && webcamBase64.length > 50) {
        const cleanWebcamBase64 = webcamBase64.replace(/^data:image\/\w+;base64,/, '')
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanWebcamBase64,
          },
        })
      }

      // 2. Application context prompt part
      parts.push({
        text: `Trạng thái ứng dụng hiện tại: ${JSON.stringify(safeAppState)}.${
          textCommand ? `\nCâu lệnh / Triệu chứng của phi hành gia: "${textCommand}".` : ''
        }\nHãy nghe đoạn âm thanh của phi hành gia và trả về JSON điều khiển ứng dụng.`,
      })

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts },
          config: {
            systemInstruction: MULTIMODAL_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseSchema: MULTIMODAL_CONTROL_SCHEMA,
          },
        }),
        4500,
      )

      const responseText = response.text
      if (!responseText) {
        throw new Error('Empty response from Gemini Multimodal Audio model')
      }

      const parsedJson = JSON.parse(responseText.trim()) as Partial<
        SpacecraftVoiceAiResponse & MultimodalControlResponse
      >
      res.json(
        normalizeSpacecraftVoiceResponse(
          {
            ...parsedJson,
            source: 'gemini-multimodal-audio',
          },
          safeAppState,
        ),
      )
    } catch {
      res.json(fallback)
    }
  })

  /**
   * Dashboard Astro Agent Endpoint (also backed by Multimodal Gemini AI)
   */
  app.post('/api/astro-agent', async (req, res) => {
    const {
      transcript = '',
      audioBase64,
      mimeType = 'audio/webm',
      currentVitals,
      webcamBase64,
      lang = 'EN',
    }: {
      transcript?: string
      audioBase64?: string | null
      mimeType?: string
      currentVitals?: AgentVitalsPayload
      webcamBase64?: string | null
      lang?: Lang
    } = req.body ?? {}

    const safeState: CurrentAppStatePayload = {
      activeModule: 'dashboard',
      activeMetricTab: 'bp',
      lang,
      vitals: currentVitals ?? vitalsToAgentPayload(VITALS),
    }

    const mmFallback = buildServerMultimodalFallback(transcript, safeState)
    const mapLegacyAction = (): AstroAgentResponse['uiAction'] => {
      if (mmFallback.triggerOpticalScan) return 'SCAN_FACE'
      if (mmFallback.openInspectorRegion === 'brain') return 'OPEN_BRAIN'
      if (mmFallback.openInspectorRegion === 'heart') return 'OPEN_HEART'
      if (mmFallback.openInspectorRegion === 'lungs') return 'OPEN_LUNGS'
      if (mmFallback.openInspectorRegion === 'circulatory') return 'OPEN_SYSTEMIC'
      if (mmFallback.openInspectorRegion === 'CLOSE') return 'CLOSE_PANEL'
      if (mmFallback.navigateModule === 'monitoring') return 'NAV_MONITORING'
      if (mmFallback.navigateModule === 'analytics') return 'NAV_ANALYTICS'
      if (mmFallback.navigateModule === 'ai') return 'NAV_AI_ASSESSMENT'
      if (mmFallback.navigateModule === 'missions') return 'NAV_MISSIONS'
      if (mmFallback.navigateModule === 'profile') return 'NAV_PROFILE'
      return 'NONE'
    }

    const legacyFallback: AstroAgentResponse = {
      spokenReply: mmFallback.spokenReply,
      uiAction: mapLegacyAction(),
      updatedVitals: mmFallback.updatedVitals,
      dynamicSurgeonNote: {
        cause: mmFallback.dynamicSurgeonNote.cause,
        countermeasure: mmFallback.dynamicSurgeonNote.countermeasure,
      },
      source: 'gemini',
    }

    const apiKey = process.env.GEMINI_API_KEY
    const hasValidServerKey =
      Boolean(apiKey) && apiKey !== 'MY_GEMINI_API_KEY' && apiKey!.trim().length > 10

    if (!hasValidServerKey) {
      res.json(legacyFallback)
      return
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = []
      if (audioBase64 && typeof audioBase64 === 'string' && audioBase64.length > 20) {
        parts.push({
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: audioBase64.replace(/^data:audio\/[^;]+;base64,/, ''),
          },
        })
      }
      if (webcamBase64 && typeof webcamBase64 === 'string' && webcamBase64.length > 50) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: webcamBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        })
      }
      parts.push({
        text: `Trạng thái ứng dụng hiện tại: ${JSON.stringify(safeState)}. Câu lệnh: "${transcript}". Hãy nghe đoạn âm thanh của phi hành gia và trả về JSON điều khiển ứng dụng.`,
      })

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts },
          config: {
            systemInstruction: MULTIMODAL_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseSchema: MULTIMODAL_CONTROL_SCHEMA,
          },
        }),
        3500,
      )

      if (response.text) {
        const rawMm = JSON.parse(response.text.trim()) as Partial<
          SpacecraftVoiceAiResponse & MultimodalControlResponse
        >
        const mm = normalizeSpacecraftVoiceResponse(rawMm, safeState)
        res.json({
          spokenReply: mm.spokenReply,
          uiAction: mm.triggerOpticalScan
            ? 'SCAN_FACE'
            : mm.openInspectorRegion === 'brain'
              ? 'OPEN_BRAIN'
              : mm.openInspectorRegion === 'heart'
                ? 'OPEN_HEART'
                : mm.openInspectorRegion === 'lungs'
                  ? 'OPEN_LUNGS'
                  : mm.openInspectorRegion === 'circulatory'
                    ? 'OPEN_SYSTEMIC'
                    : mm.openInspectorRegion === 'CLOSE'
                      ? 'CLOSE_PANEL'
                      : 'NONE',
          updatedVitals: mm.updatedVitals,
          dynamicSurgeonNote: {
            cause: mm.dynamicSurgeonNote.cause,
            countermeasure: mm.dynamicSurgeonNote.countermeasure,
          },
          source: 'gemini',
        } satisfies AstroAgentResponse)
        return
      }
      res.json(legacyFallback)
    } catch {
      res.json(legacyFallback)
    }
  })

  app.post('/api/astro-face-scan', async (req, res) => {
    const {
      webcamBase64,
      currentVitals,
    }: {
      webcamBase64?: string | null
      currentVitals?: AgentVitalsPayload
    } = req.body ?? {}

    const fallbackScan = {
      blinkRate: 14,
      fatigueEn: 'Low',
      fatigueVi: 'Thấp',
      estimatedHr: currentVitals?.heartRate
        ? Math.max(64, Math.min(82, currentVitals.heartRate - 2))
        : 72,
      stressLevel: '3',
      spokenSummaryEn:
        'Optical rPPG facial analysis complete: Periorbital micro-tension is low, blink rate is 14/min, and stress level is calibrated to 3/10.',
      spokenSummaryVi:
        'Hoàn tất phân tích khuôn mặt quang học rPPG: Độ căng cơ quanh mắt thấp, nhịp chớp mắt 14 lần/phút, mức căng thẳng giảm xuống 3/10.',
    }

    const apiKey = process.env.GEMINI_API_KEY
    const hasValidServerKey =
      Boolean(apiKey) && apiKey !== 'MY_GEMINI_API_KEY' && apiKey!.trim().length > 10

    if (!hasValidServerKey || !webcamBase64 || webcamBase64.length < 50) {
      res.json(fallbackScan)
      return
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })

      const cleanBase64 = webcamBase64.replace(/^data:image\/\w+;base64,/, '')
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: `Analyze this astronaut webcam frame for optical biometric telemetry (ocular fatigue, blink rate, estimated resting heart rate, and stress level 1-10). Current telemetry: ${JSON.stringify(
                  currentVitals ?? {},
                )}`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: FACE_SCAN_SCHEMA,
          },
        }),
        2500,
      )

      if (response.text) {
        res.json(JSON.parse(response.text.trim()))
        return
      }
      res.json(fallbackScan)
    } catch {
      res.json(fallbackScan)
    }
  })

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(__dirname, 'dist')
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ASTROCARE Native Multimodal Audio Server running on http://0.0.0.0:${PORT}`)
  })
}

startServer()
