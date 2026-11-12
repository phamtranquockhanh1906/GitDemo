import {
  Activity,
  Armchair,
  Brain,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  Download,
  Droplet,
  Droplets,
  Eye,
  FileImage,
  Gauge,
  Hand,
  HeartPulse,
  Hourglass,
  Loader2,
  Mic,
  Minus,
  Moon,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Ruler,
  Sparkles,
  Stethoscope,
  Thermometer,
  Timer,
  TriangleAlert,
  Upload,
  Volume2,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  classifyMeasurementField,
  convertLoggedVitalToFormValues,
  vitalsToAgentPayload,
  type Lang,
  type Status,
  type Vital,
  type VitalId,
} from '@/lib/astro-data'
import { sendMultimodalAudioToGemini } from '@/lib/multimodal-audio'
import type { Notify } from '../app-shell'
import { PageHeader, Panel } from '../ui'

export type MetricId = 'hr' | 'hrv' | 'bp' | 'spo2' | 'temp' | 'glu' | 'sleep' | 'mood'
export type SourceId = 'Sensor' | 'Manual' | 'Simulated' | 'External' | 'Voice'
export type ExternalVoiceSyncPayload = {
  metricId: MetricId
  values?: Record<string, string>
  transcript?: string
  autoSavedTimeUtc?: string
  seq: number
}

type FieldDef = {
  key: string
  label: string
  viLabel: string
  unit: string
  viUnit?: string
  normal: [number, number]
  plausible: [number, number]
  step?: number
  initial: string
}

function getFieldUnit(f: FieldDef, lang: Lang): string {
  if (lang === 'VI') {
    if (f.viUnit) return f.viUnit
    if (f.unit === 'hrs') return 'giờ'
    if (f.unit === 'count') return 'lần'
  }
  return f.unit
}

type GuidanceStep = {
  icon: LucideIcon
  text: string
  viText: string
  timerSeconds?: number
}

type MetricDef = {
  id: MetricId
  label: string
  viLabel: string
  icon: LucideIcon
  title: string
  viTitle: string
  fields: FieldDef[]
  guidance: GuidanceStep[]
  whyItMattersEn: string
  whyItMattersVi: string
  voiceHintEn: string
  voiceHintVi: string
  format: (v: Record<string, string>) => string
}

const METRICS: MetricDef[] = [
  {
    id: 'hr',
    label: 'Heart Rate',
    viLabel: 'Nhịp tim',
    icon: HeartPulse,
    title: 'Log Heart Rate Measurement',
    viTitle: 'Ghi nhận Chỉ số Nhịp tim',
    fields: [
      {
        key: 'hr',
        label: 'Heart Rate',
        viLabel: 'Nhịp tim',
        unit: 'BPM',
        normal: [58, 99],
        plausible: [25, 230],
        initial: '75',
      },
    ],
    guidance: [
      {
        icon: Armchair,
        text: 'Rest seated or restrained for 5 minutes.',
        viText: 'Ngồi nghỉ cố định trong 5 phút trước khi đo.',
        timerSeconds: 300,
      },
      {
        icon: Hand,
        text: 'Place fingertip sensor or chest strap firmly.',
        viText: 'Đặt cảm biến đầu ngón tay hoặc đai ngực chắc chắn.',
      },
      {
        icon: Hourglass,
        text: 'Hold still for a 30-second capture window.',
        viText: 'Giữ yên trong 30 giây thu nhận tín hiệu.',
        timerSeconds: 30,
      },
      {
        icon: Ruler,
        text: 'Confirm reading is in BPM.',
        viText: 'Xác nhận đơn vị đo là BPM.',
      },
    ],
    whyItMattersEn:
      'Microgravity reduces plasma volume by 10–15%, risking cardiac deconditioning unless target heart rate zones are maintained during daily CEVIS/ARED exercise.',
    whyItMattersVi:
      'Vi trọng lực làm giảm 10–15% thể tích huyết tương, khiến cơ tim có nguy cơ co nhỏ nếu không duy trì nhịp tim mục tiêu qua bài tập CEVIS/ARED mỗi ngày.',
    voiceHintEn: 'Say e.g. "72" or "Heart rate 88"',
    voiceHintVi: 'Nói VD: "72" hoặc "Nhịp tim 88"',
    format: (v) => `${v.hr} BPM`,
  },
  {
    id: 'hrv',
    label: 'HRV (RMSSD)',
    viLabel: 'Biến thiên HRV',
    icon: Activity,
    title: 'Log Heart Rate Variability (RMSSD)',
    viTitle: 'Đo Biến thiên Nhịp tim (HRV · RMSSD)',
    fields: [
      {
        key: 'hrv',
        label: 'HRV (R-R Interval RMSSD)',
        viLabel: 'Biến thiên khoảng R-R (RMSSD)',
        unit: 'ms',
        normal: [46, 85],
        plausible: [10, 180],
        initial: '42',
      },
    ],
    guidance: [
      {
        icon: Armchair,
        text: 'Measure immediately after waking while still in crew quarters.',
        viText: 'Đo ngay sau khi thức dậy khi còn nằm yên trong khoang ngủ.',
      },
      {
        icon: HeartPulse,
        text: 'Use Bio-Monitor ECG chest strap or optical PPG finger sensor for 60s.',
        viText: 'Đeo đai ngực ECG hoặc kẹp cảm biến quang học PPG trong 60 giây.',
        timerSeconds: 60,
      },
      {
        icon: Wind,
        text: 'Breathe naturally (avoid forced deep breathing during RMSSD capture).',
        viText: 'Thở tự nhiên đều đặn để máy tính độ lệch chuẩn khoảng cách giữa các nhịp R-R (ms).',
      },
      {
        icon: Ruler,
        text: 'Higher HRV (≥ 46 ms) indicates strong vagal & autonomic recovery.',
        viText: 'HRV càng cao (≥ 46 ms) chứng tỏ hệ thần kinh tự chủ phục hồi tốt.',
      },
    ],
    whyItMattersEn:
      'RMSSD directly reflects parasympathetic vagal tone. HRV dropping below 46 ms is the earliest biomarker of sympathetic overload and fatigue prior to EVA spacewalks.',
    whyItMattersVi:
      'Chỉ số RMSSD phản ánh trực tiếp trương lực dây thần kinh phế vị. HRV giảm dưới 46 ms là dấu hiệu sớm nhất của quá tải giao cảm và mệt mỏi tích lũy trước ca đi bộ không gian EVA.',
    voiceHintEn: 'Say e.g. "52" or "HRV 48"',
    voiceHintVi: 'Nói VD: "52" hoặc "HRV 48"',
    format: (v) => `${v.hrv} ms`,
  },
  {
    id: 'bp',
    label: 'Blood Pressure',
    viLabel: 'Huyết áp',
    icon: Gauge,
    title: 'Log Blood Pressure Measurement',
    viTitle: 'Ghi nhận Chỉ số Huyết áp',
    fields: [
      { key: 'sys', label: 'Systolic', viLabel: 'Tâm thu', unit: 'mmHg', normal: [90, 124], plausible: [60, 260], initial: '125' },
      { key: 'dia', label: 'Diastolic', viLabel: 'Tâm trương', unit: 'mmHg', normal: [60, 81], plausible: [30, 160], initial: '82' },
      { key: 'pulse', label: 'Pulse', viLabel: 'Mạch đập', unit: 'BPM', normal: [55, 100], plausible: [25, 230], initial: '75' },
    ],
    guidance: [
      {
        icon: Armchair,
        text: 'Rest seated for 5 minutes prior to measurement.',
        viText: 'Nghỉ tĩnh 5 phút trước khi bơm vòng bít.',
        timerSeconds: 300,
      },
      {
        icon: HeartPulse,
        text: 'Fasten cuff securely at heart level.',
        viText: 'Quấn vòng bít ngang mức tim.',
      },
      {
        icon: Hand,
        text: 'Maintain stillness during 45-second cuff reading.',
        viText: 'Giữ tay thả lỏng trong 45 giây máy bơm đo.',
        timerSeconds: 45,
      },
      {
        icon: Ruler,
        text: 'Verify mmHg unit calibration.',
        viText: 'Kiểm tra chuẩn đơn vị mmHg.',
      },
    ],
    whyItMattersEn:
      'In microgravity, cephalad fluid shift moves ~2 liters of fluid toward the head and thorax, altering arterial pressure and increasing Spaceflight-Associated Neuro-ocular Syndrome (SANS) risk.',
    whyItMattersVi:
      'Trong vi trọng lực, dịch cơ thể dồn lên vùng đầu-ngực làm thay đổi huyết áp động mạch và tăng nguy cơ hội chứng thần kinh-thị giác vũ trụ (SANS).',
    voiceHintEn: 'Say e.g. "120 78 pulse 70"',
    voiceHintVi: 'Nói VD: "120 78 mạch 70"',
    format: (v) => `${v.sys}/${v.dia} mmHg · ${v.pulse} BPM`,
  },
  {
    id: 'spo2',
    label: 'SpO₂',
    viLabel: 'Độ bão hòa SpO₂',
    icon: Droplets,
    title: 'Log SpO₂ Measurement',
    viTitle: 'Ghi nhận Độ bão hòa Oxy (SpO₂)',
    fields: [
      {
        key: 'spo2',
        label: 'Oxygen Saturation',
        viLabel: 'Bão hòa Oxy máu',
        unit: '%',
        normal: [95, 100],
        plausible: [60, 100],
        initial: '98',
      },
    ],
    guidance: [
      {
        icon: Hand,
        text: 'Warm fingertip and remove any coatings.',
        viText: 'Làm ấm đầu ngón tay trước khi kẹp cảm biến.',
      },
      {
        icon: Armchair,
        text: 'Rest hand at heart level.',
        viText: 'Đặt bàn tay ngang tầm ngực.',
      },
      {
        icon: Hourglass,
        text: 'Wait for a stable waveform (10 s).',
        viText: 'Chờ sóng mạch ổn định trong 10 giây.',
        timerSeconds: 10,
      },
      {
        icon: Eye,
        text: 'Check perfusion index ≥ 1.0.',
        viText: 'Kiểm tra chỉ số tưới máu PI ≥ 1.0.',
      },
    ],
    whyItMattersEn:
      'Cabin O₂ partial pressure and EVA suit decompression protocols require continuous SpO₂ verification to prevent mild hypoxia and alveolar ventilation-perfusion mismatch.',
    whyItMattersVi:
      'Áp suất riêng phần O₂ trong khoang tàu và quy trình giảm áp bộ đồ EVA đòi hỏi giám sát SpO₂ sát sao để ngăn ngừa thiếu oxy mô nhẹ và rối loạn thông khí phế nang.',
    voiceHintEn: 'Say e.g. "98" or "SpO2 99"',
    voiceHintVi: 'Nói VD: "98" hoặc "SpO2 99"',
    format: (v) => `${v.spo2}%`,
  },
  {
    id: 'temp',
    label: 'Body Temp',
    viLabel: 'Thân nhiệt',
    icon: Thermometer,
    title: 'Log Body Temperature',
    viTitle: 'Ghi nhận Thân nhiệt Lõi',
    fields: [
      {
        key: 'temp',
        label: 'Core Temperature',
        viLabel: 'Thân nhiệt lõi',
        unit: '°C',
        normal: [36.1, 37.2],
        plausible: [32, 43],
        step: 0.1,
        initial: '36.8',
      },
    ],
    guidance: [
      {
        icon: Clock,
        text: 'Avoid exercise or meals for 20 minutes.',
        viText: 'Tránh tập luyện hoặc ăn uống 20 phút trước đo.',
      },
      {
        icon: Thermometer,
        text: 'Place probe sublingually or use tympanic mode.',
        viText: 'Đặt đầu dò dưới lưỡi hoặc chế độ màng nhĩ.',
      },
      {
        icon: Hand,
        text: 'Keep mouth closed for 30s until the tone.',
        viText: 'Giữ kín miệng trong 30 giây cho đến khi có âm báo.',
        timerSeconds: 30,
      },
      {
        icon: Ruler,
        text: 'Verify unit is °C.',
        viText: 'Xác nhận đơn vị đo là °C.',
      },
    ],
    whyItMattersEn:
      'Without natural buoyancy convection in 0G, body heat dissipates slowly, predisposing crew to core hyperthermia ("Spaceflight Fever") during exercise and EVA operations.',
    whyItMattersVi:
      'Trong môi trường không đối lưu tự nhiên (0G), nhiệt lượng cơ thể tản chậm hơn, dễ gây tăng thân nhiệt lõi âm thầm (Spaceflight Fever) khi tập luyện hoặc mặc đồ EVA.',
    voiceHintEn: 'Say e.g. "36.7" or "Temp 37.4"',
    voiceHintVi: 'Nói VD: "36.7" hoặc "Nhiệt độ 37.4"',
    format: (v) => `${v.temp} °C`,
  },
  {
    id: 'glu',
    label: 'Blood Glucose',
    viLabel: 'Đường huyết',
    icon: Droplet,
    title: 'Log Blood Glucose',
    viLabelTitle: 'Ghi nhận Đường huyết',
    viTitle: 'Ghi nhận Đường huyết',
    fields: [
      {
        key: 'glu',
        label: 'Glucose',
        viLabel: 'Đường huyết',
        unit: 'mg/dL',
        normal: [70, 100],
        plausible: [20, 600],
        initial: '95',
      },
    ],
    guidance: [
      {
        icon: Hand,
        text: 'Clean fingertip with an alcohol wipe.',
        viText: 'Sát khuẩn đầu ngón tay bằng gạc cồn.',
      },
      {
        icon: Droplet,
        text: 'Use a contained lancet capture pouch.',
        viText: 'Sử dụng bộ lấy máu kín dùng trong vi trọng lực.',
      },
      {
        icon: Timer,
        text: 'Wait 15 seconds for capillary strip analysis.',
        viText: 'Chờ 15 giây để que thử phân tích mao mạch.',
        timerSeconds: 15,
      },
      {
        icon: Ruler,
        text: 'Verify meter is set to mg/dL.',
        viText: 'Đảm bảo máy đo để ở chuẩn mg/dL.',
      },
    ],
    whyItMattersEn:
      'Microgravity induces subclinical insulin resistance and altered hepatic lipid metabolism; tracking fasting glucose safeguards cognitive alertness and metabolic health.',
    whyItMattersVi:
      'Vi trọng lực gây đề kháng insulin dưới lâm sàng và thay đổi chuyển hóa lipid gan; kiểm soát đường huyết giúp duy trì sự tỉnh táo nhận thức và cân bằng năng lượng.',
    voiceHintEn: 'Say e.g. "92" or "Glucose 108"',
    voiceHintVi: 'Nói VD: "92" hoặc "Đường huyết 108"',
    format: (v) => `${v.glu} mg/dL`,
  } as MetricDef,
  {
    id: 'sleep',
    label: 'Sleep',
    viLabel: 'Giấc ngủ',
    icon: Moon,
    title: 'Log Sleep Period',
    viTitle: 'Ghi nhận Thời lượng Giấc ngủ',
    fields: [
      { key: 'hrs', label: 'Duration', viLabel: 'Thời lượng ngủ', unit: 'hrs', viUnit: 'giờ', normal: [7.0, 9.5], plausible: [0, 16], step: 0.1, initial: '6.2' },
      { key: 'wake', label: 'Awakenings', viLabel: 'Số lần thức giấc', unit: 'count', viUnit: 'lần', normal: [0, 2], plausible: [0, 30], initial: '1' },
    ],
    guidance: [
      {
        icon: Clock,
        text: 'Log within 30 minutes of waking.',
        viText: 'Ghi nhận trong vòng 30 phút sau khi thức dậy.',
      },
      {
        icon: Moon,
        text: 'Count only time inside the crew quarters bag.',
        viText: 'Chỉ tính thời gian thực tế trong túi ngủ phi hành đoàn.',
      },
      {
        icon: Eye,
        text: 'Include awakenings longer than 5 minutes.',
        viText: 'Tính các lần tỉnh giấc kéo dài hơn 5 phút.',
      },
      {
        icon: Wind,
        text: 'Note CO₂ or noise disturbances in comments.',
        viText: 'Ghi chú nếu có tiếng ồn hoặc nồng độ CO₂ cao.',
      },
    ],
    whyItMattersEn:
      'Orbital crew witness 16 sunrises daily, disrupting suprachiasmatic circadian rhythms and REM sleep architecture—critical for robotic arm and docking precision.',
    whyItMattersVi:
      'Phi hành gia trên quỹ đạo đón 16 bình minh mỗi ngày, gây lệch nhịp sinh học SCN và giảm giấc ngủ sâu REM — yếu tố quyết định độ chính xác khi vận hành trạm.',
    voiceHintEn: 'Say e.g. "7.8 hours 1 wake"',
    voiceHintVi: 'Nói VD: "8 tiếng thức giấc 0 lần"',
    format: (v) => `${v.hrs} h · ${v.wake} wakes`,
  },
  {
    id: 'mood',
    label: 'Mood & Stress',
    viLabel: 'Tâm trạng & Stress',
    icon: Brain,
    title: 'Log Mood & Stress Self-Assessment',
    viTitle: 'Tự đánh giá Tâm trạng & Mức căng thẳng',
    fields: [
      { key: 'mood', label: 'Mood (1–10)', viLabel: 'Tâm trạng (1–10)', unit: '/10', normal: [5, 10], plausible: [1, 10], initial: '7' },
      { key: 'stress', label: 'Stress (1–10)', viLabel: 'Căng thẳng (1–10)', unit: '/10', normal: [1, 4], plausible: [1, 10], initial: '6' },
    ],
    guidance: [
      {
        icon: Armchair,
        text: 'Find a quiet module, 2 minutes alone.',
        viText: 'Tìm khoang yên tĩnh trong 2 phút.',
        timerSeconds: 120,
      },
      {
        icon: Wind,
        text: 'Take three slow breaths (30s) before rating.',
        viText: 'Hít thở sâu 3 nhịp chậm (30 giây) trước khi chấm điểm.',
        timerSeconds: 30,
      },
      {
        icon: Brain,
        text: 'Rate how you feel now, not today overall.',
        viText: 'Đánh giá cảm nhận ngay lúc này.',
      },
      {
        icon: Eye,
        text: 'Answers are confidential to the Flight Surgeon.',
        viText: 'Dữ liệu được bảo mật với Bác sĩ Vũ trụ.',
      },
    ],
    whyItMattersEn:
      'Long-duration confinement, high workload, and Earth communication delays elevate cortisol; proactive behavioral tracking prevents mission performance fatigue.',
    whyItMattersVi:
      'Cô lập dài ngày, áp lực công việc cao và độ trễ liên lạc với Trái Đất làm tăng cortisol; theo dõi tâm lý chủ động giúp Bác sĩ Vũ trụ can thiệp giảm tải kịp thời.',
    voiceHintEn: 'Say e.g. "Mood 8 stress 3"',
    voiceHintVi: 'Nói VD: "Tâm trạng 8 căng thẳng 3"',
    format: (v) => `Mood ${v.mood} · Stress ${v.stress}`,
  },
]

const SOURCES: SourceId[] = ['Sensor', 'Manual', 'Simulated', 'External']
const ALL_HISTORY_SOURCES: SourceId[] = ['Sensor', 'Manual', 'Voice', 'Simulated', 'External']
const SOURCE_LABEL: Record<Lang, Record<SourceId, string>> = {
  EN: {
    Sensor: 'Sensor Data',
    Manual: 'Manual Input',
    Simulated: 'Simulated Data',
    External: 'External Dataset',
    Voice: '🎙️ AI Voice',
  },
  VI: {
    Sensor: 'Cảm biến tự động',
    Manual: 'Nhập thủ công',
    Simulated: 'Dữ liệu mô phỏng',
    External: 'Bộ dữ liệu ngoài',
    Voice: '🎙️ Giọng nói AI',
  },
}
const SOURCE_PILL: Record<SourceId, string> = {
  Sensor: 'cyan',
  Manual: 'indigo',
  Simulated: 'slate',
  External: 'slate',
  Voice: 'cyan',
}

const QUALITY_LABEL: Record<Lang, Record<MonitoringRow['quality'], string>> = {
  EN: {
    Valid: 'VALID',
    Verified: 'VERIFIED',
    Flagged: 'FLAGGED',
  },
  VI: {
    Valid: 'HỢP LỆ',
    Verified: 'ĐÃ XÁC MINH',
    Flagged: 'CẢNH BÁO',
  },
}

// Simulated presets for the 3 judge test scenarios across all 8 metrics
const SIMULATED_PRESETS: Record<
  'eva' | 'fatigue' | 'optimal',
  Record<MetricId, Record<string, string>>
> = {
  eva: {
    hr: { hr: '98' },
    hrv: { hrv: '35' },
    bp: { sys: '136', dia: '86', pulse: '96' },
    spo2: { spo2: '94' },
    temp: { temp: '37.6' },
    glu: { glu: '112' },
    sleep: { hrs: '5.8', wake: '2' },
    mood: { mood: '6', stress: '7' },
  },
  fatigue: {
    hr: { hr: '88' },
    hrv: { hrv: '33' },
    bp: { sys: '132', dia: '85', pulse: '86' },
    spo2: { spo2: '96' },
    temp: { temp: '37.1' },
    glu: { glu: '106' },
    sleep: { hrs: '4.8', wake: '4' },
    mood: { mood: '4', stress: '8' },
  },
  optimal: {
    hr: { hr: '68' },
    hrv: { hrv: '58' },
    bp: { sys: '118', dia: '76', pulse: '68' },
    spo2: { spo2: '99' },
    temp: { temp: '36.7' },
    glu: { glu: '88' },
    sleep: { hrs: '8.0', wake: '0' },
    mood: { mood: '9', stress: '2' },
  },
}

// Live sensor telemetry readings when syncing from wearable Bio-Monitor
const SENSOR_SYNC_PRESETS: Record<MetricId, Record<string, string>> = {
  hr: { hr: '72' },
  hrv: { hrv: '49' },
  bp: { sys: '121', dia: '79', pulse: '72' },
  spo2: { spo2: '99' },
  temp: { temp: '36.7' },
  glu: { glu: '92' },
  sleep: { hrs: '7.4', wake: '1' },
  mood: { mood: '8', stress: '3' },
}

// Ultrasound / Medical Imaging AI Extraction presets
const ULTRASOUND_EXTRACTED_PRESETS: Record<
  MetricId,
  { values: Record<string, string>; noteEn: string; noteVi: string }
> = {
  hr: {
    values: { hr: '71' },
    noteEn: 'Echocardiography M-Mode: Left ventricular ejection fraction (LVEF) 64%, regular sinus rhythm at 71 BPM.',
    noteVi: 'Siêu âm tim M-Mode: Phân suất tống máu thất trái (LVEF) 64%, nhịp xoang đều ở mức 71 BPM.',
  },
  hrv: {
    values: { hrv: '51' },
    noteEn: 'PPG / Doppler Waveform Analysis: R-R interval RMSSD calculated at 51 ms (parasympathetic tone normal).',
    noteVi: 'Phân tích phổ Doppler & sóng mạch: Độ biến thiên khoảng R-R (RMSSD) đạt 51 ms (trương lực phế vị ổn định).',
  },
  bp: {
    values: { sys: '120', dia: '78', pulse: '71' },
    noteEn: 'Carotid & Ocular Ultrasound (SANS Check): ONSD 5.1 mm (normal), estimated central arterial pressure 120/78 mmHg · 71 BPM.',
    noteVi: 'Siêu âm Động mạch cảnh & Nhãn cầu (SANS): Đường kính bao dây thần kinh thị giác ONSD 5.1 mm (bình thường), huyết áp 120/78 mmHg · Mạch 71 BPM.',
  },
  spo2: {
    values: { spo2: '98' },
    noteEn: 'Thoracic Lung Ultrasound: No B-lines or alveolar interstitial fluid; oxygenation index corresponds to SpO₂ 98%.',
    noteVi: 'Siêu âm Phổi lồng ngực: Không có đường B-lines hay ứ dịch phế nang; độ bão hòa oxy tương đương SpO₂ 98%.',
  },
  temp: {
    values: { temp: '36.7' },
    noteEn: 'Infrared Thermal & Telemetry Panel OCR: Core tympanic temperature verified at 36.7 °C.',
    noteVi: 'Ảnh nhiệt Hồng ngoại & OCR màn hình y tế: Thân nhiệt lõi màng nhĩ xác nhận ở mức 36.7 °C.',
  },
  glu: {
    values: { glu: '91' },
    noteEn: 'Portable Analyzer Strip Optical Scan: Fasting capillary blood glucose extracted at 91 mg/dL.',
    noteVi: 'Quét quang học máy phân tích sinh hóa: Đường huyết mao mạch lúc đói trích xuất ở mức 91 mg/dL.',
  },
  sleep: {
    values: { hrs: '7.6', wake: '1' },
    noteEn: 'Actigraphy & Polysomnography Hypnogram OCR: Total sleep time 7.6 hrs with 1 brief awakening.',
    noteVi: 'Ảnh biểu đồ Giấc ngủ (Hypnogram Actigraphy): Tổng thời gian ngủ 7.6 giờ, thức giấc ngắn 1 lần.',
  },
  mood: {
    values: { mood: '8', stress: '3' },
    noteEn: 'Facial & Pupillometry Biometric Scan: Normal pupil reactivity, low ocular fatigue → Mood 8/10 · Stress 3/10.',
    noteVi: 'Ảnh sinh trắc Đồng tử & Cơ mặt: Phản xạ đồng tử tốt, độ mỏi cơ mặt thấp → Tâm trạng 8/10 · Căng thẳng 3/10.',
  },
}

export type MonitoringRow = {
  id: number
  time: string
  metric: MetricId
  value: string
  source: SourceId
  quality: 'Valid' | 'Verified' | 'Flagged'
}

export const INITIAL_MONITORING_ROWS: MonitoringRow[] = [
  { id: 5, time: '2026-11-06 08:12', metric: 'bp', value: '125/82 mmHg · 75 BPM', source: 'Sensor', quality: 'Verified' },
  { id: 4, time: '2026-11-06 07:40', metric: 'spo2', value: '98%', source: 'Sensor', quality: 'Verified' },
  { id: 3, time: '2026-11-06 07:05', metric: 'sleep', value: '6.2 h · 2 wakes', source: 'Sensor', quality: 'Flagged' },
  { id: 2, time: '2026-11-05 21:30', metric: 'mood', value: 'Mood 6 · Stress 6', source: 'Manual', quality: 'Flagged' },
  { id: 1, time: '2026-11-05 18:02', metric: 'hr', value: '75 BPM', source: 'Sensor', quality: 'Verified' },
]

/**
 * Translates stored English-formatted history row values into 100% Vietnamese when lang === 'VI'
 */
export function formatHistoryRowValue(row: MonitoringRow, lang: Lang): string {
  if (lang === 'EN') return row.value

  // Translate "Mood X · Stress Y" -> "Tâm trạng: X/10 · Căng thẳng: Y/10"
  const moodMatch = row.value.match(/Mood\s+(\d+(?:\.\d+)?)\s*·\s*Stress\s+(\d+(?:\.\d+)?)/i)
  if (moodMatch) {
    return `Tâm trạng: ${moodMatch[1]}/10 · Căng thẳng: ${moodMatch[2]}/10`
  }

  // Translate "X h · Y wakes" -> "X giờ · Thức giấc: Y lần"
  const sleepMatch = row.value.match(/(\d+(?:\.\d+)?)\s*h\s*·\s*(\d+)\s*wakes?/i)
  if (sleepMatch) {
    const hrsNum = Number(sleepMatch[1])
    const formattedHrs = Number.isInteger(hrsNum) ? hrsNum.toFixed(1) : sleepMatch[1]
    return `${formattedHrs} giờ · Thức giấc: ${sleepMatch[2]} lần`
  }

  // Translate "125/82 mmHg · 75 BPM" -> "125/82 mmHg · Mạch 75 BPM"
  const bpMatch = row.value.match(/(\d+\/\d+\s*mmHg)\s*·\s*(\d+\s*BPM)/i)
  if (bpMatch) {
    return `${bpMatch[1]} · Mạch ${bpMatch[2]}`
  }

  return row.value
}

/**
 * Extracts field values back from a MonitoringRow so the user can reload a historical record into the form
 */
function parseRowToFormValues(row: MonitoringRow): Record<string, string> {
  const nums = row.value.match(/\d+(?:\.\d+)?/g) ?? []
  switch (row.metric) {
    case 'bp':
      return {
        sys: nums[0] ?? '125',
        dia: nums[1] ?? '82',
        pulse: nums[2] ?? '75',
      }
    case 'sleep':
      return {
        hrs: nums[0] ?? '6.2',
        wake: nums[1] ?? '1',
      }
    case 'mood':
      return {
        mood: nums[0] ?? '7',
        stress: nums[1] ?? '6',
      }
    case 'hr':
      return { hr: nums[0] ?? '75' }
    case 'hrv':
      return { hrv: nums[0] ?? '42' }
    case 'spo2':
      return { spo2: nums[0] ?? '98' }
    case 'temp':
      return { temp: nums[0] ?? '36.8' }
    case 'glu':
      return { glu: nums[0] ?? '95' }
  }
}

function getClinicalNoteForRow(row: MonitoringRow, lang: Lang): string {
  if (row.quality === 'Flagged') {
    if (row.metric === 'sleep') {
      return lang === 'EN'
        ? 'ASTRO AI Assessment: Sleep duration below 7.0h orbital target with fragmented REM cycles. Recommend 15-min vagal breathing protocol and 480nm blue-light depletion prior to sleep.'
        : 'Nhận xét của ASTRO AI: Thời lượng ngủ thấp hơn chuẩn quỹ đạo (7.0 giờ) kèm tỉnh giấc giữa đêm. Khuyến nghị thực hiện 15 phút thở phế vị và giảm ánh sáng xanh 480nm trước giờ ngủ.'
    }
    if (row.metric === 'mood') {
      return lang === 'EN'
        ? 'ASTRO AI Assessment: Elevated cognitive stress detected. Flight Surgeon recommends workload pacing and guided autonomic recovery session.'
        : 'Nhận xét của ASTRO AI: Phát hiện mức căng thẳng thần kinh tăng cao. Bác sĩ Vũ trụ khuyến nghị điều chỉnh nhịp độ công việc và thực hiện bài tập thư giãn thần kinh tự chủ.'
    }
    return lang === 'EN'
      ? 'ASTRO AI Assessment: Value exceeds personal orbital baseline. Recommend seated re-verification after 5 minutes of rest.'
      : 'Nhận xét của ASTRO AI: Chỉ số vượt ngưỡng chuẩn cá nhân trên quỹ đạo. Khuyến nghị ngồi nghỉ tĩnh 5 phút và đo kiểm tra lại.'
  }
  return lang === 'EN'
    ? 'ASTRO AI Assessment: Telemetry reading verified within nominal astronaut physiological corridor. Synced with onboard Bio-Monitor database.'
    : 'Nhận xét của ASTRO AI: Chỉ số sinh trắc học nằm trong hành lang sinh lý chuẩn của phi hành gia. Đã xác minh và đồng bộ với cơ sở dữ liệu Bio-Monitor trên tàu.'
}

function buildInitialValuesFromVitals(m: MetricDef, vitals: Vital[]): Record<string, string> {
  const base = Object.fromEntries(m.fields.map((f) => [f.key, f.initial]))
  if (!vitals.length) return base
  if (m.id === 'hr') {
    base.hr = vitals.find((v) => v.id === 'hr')?.value ?? base.hr
  } else if (m.id === 'hrv') {
    base.hrv = vitals.find((v) => v.id === 'hrv')?.value ?? base.hrv
  } else if (m.id === 'bp') {
    const bp = vitals.find((v) => v.id === 'bp')?.value ?? '125/82'
    const [sys, dia] = bp.split('/')
    base.sys = sys ?? '125'
    base.dia = dia ?? '82'
    base.pulse = vitals.find((v) => v.id === 'hr')?.value ?? '75'
  } else if (m.id === 'spo2') {
    base.spo2 = vitals.find((v) => v.id === 'spo2')?.value ?? base.spo2
  } else if (m.id === 'temp') {
    base.temp = vitals.find((v) => v.id === 'temp')?.value ?? base.temp
  } else if (m.id === 'glu') {
    base.glu = vitals.find((v) => v.id === 'glu')?.value ?? base.glu
  } else if (m.id === 'sleep') {
    base.hrs = vitals.find((v) => v.id === 'sleep')?.value ?? base.hrs
  } else if (m.id === 'mood') {
    base.stress = vitals.find((v) => v.id === 'stress')?.value ?? base.stress
  }
  return base
}

function mapVitalToMetricId(vitalId?: VitalId): MetricId {
  if (!vitalId) return 'bp'
  if (vitalId === 'stress') return 'mood'
  return vitalId
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function MonitoringView({
  lang = 'EN',
  vitals = [],
  rows: externalRows,
  onAddRow,
  notify,
  initialVitalId,
  externalVoiceSync,
  onActiveMetricChange,
  onSaveVitalEntry,
}: {
  lang?: Lang
  vitals?: Vital[]
  rows?: MonitoringRow[]
  onAddRow?: (row: MonitoringRow) => void
  notify: Notify
  initialVitalId?: VitalId
  externalVoiceSync?: ExternalVoiceSyncPayload | null
  onActiveMetricChange?: (metricId: MetricId) => void
  onSaveVitalEntry?: (metricId: MetricId, values: Record<string, string>, source: 'Sensor' | 'Manual', status: Status) => void
}) {
  const [metricId, setMetricId] = useState<MetricId>(() => mapVitalToMetricId(initialVitalId))
  const metric = METRICS.find((m) => m.id === metricId)!
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialValuesFromVitals(metric, vitals))
  const [source, setSource] = useState<SourceId>('Manual')
  const [timeMode, setTimeMode] = useState<'auto' | 'custom'>('auto')
  const [customTime, setCustomTime] = useState('08:30')
  const [confirmAbnormal, setConfirmAbnormal] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [localRows, setLocalRows] = useState<MonitoringRow[]>(INITIAL_MONITORING_ROWS)
  const [filter, setFilter] = useState<'all' | SourceId>('all')
  const [detail, setDetail] = useState<MonitoringRow | null>(null)

  // Feature 1: Voice Dictation & Recognized Utterance State
  const [isVoiceDictating, setIsVoiceDictating] = useState(false)
  const [voiceDraft, setVoiceDraft] = useState('')
  const [recognizedVoiceText, setRecognizedVoiceText] = useState<string>('')

  // Feature 2: Active Data Source States (Sensor Sync, Sample Popover, External Ultrasound AI)
  const [isSyncingSensor, setIsSyncingSensor] = useState(false)
  const [activeSimPreset, setActiveSimPreset] = useState<'eva' | 'fatigue' | 'optimal' | null>(null)
  const [showSamplePopover, setShowSamplePopover] = useState(false)
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null)
  const [ultrasoundFinding, setUltrasoundFinding] = useState<{ en: string; vi: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Feature 3: Smart Save State (Prevents Duplicate Saves after Voice/Sensor Auto-Save)
  const [isSaved, setIsSaved] = useState<boolean>(false)
  const [savedTimeUtc, setSavedTimeUtc] = useState<string>(() => {
    const d = new Date()
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
  })

  // Feature 4: NASA Protocol TTS & Step Timers
  const [isSpeakingProtocol, setIsSpeakingProtocol] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null)
  const [stepSecondsLeft, setStepSecondsLeft] = useState<number>(0)

  // Feature 5: Downlink to Earth Telemetry State
  const [isDownlinking, setIsDownlinking] = useState(false)
  const [lastDownlinkTime, setLastDownlinkTime] = useState<string | null>(null)

  const rows = externalRows ?? localRows

  const getCurrentUtcStamp = useCallback(() => {
    const d = new Date()
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    return {
      shortUtc: `${hh}:${mm} UTC`,
      fullStamp:
        timeMode === 'auto'
          ? `2026-11-06 ${hh}:${mm}`
          : `2026-11-06 ${customTime}`,
    }
  }, [customTime, timeMode])

  const defaultVoiceSampleForMetric = useCallback(
    (mId: MetricId, currentLang: Lang): string => {
      const mapVi: Record<MetricId, string> = {
        hr: 'Nhịp tim 72 bpm',
        hrv: 'Biến thiên nhịp tim HRV 52 ms',
        bp: 'Huyết áp 120 78 mạch 70',
        spo2: 'Độ bão hòa oxy SpO2 99%',
        temp: 'Thân nhiệt 36.7 độ C',
        glu: 'Đường huyết 92 mg/dL',
        sleep: 'Ngủ 8 tiếng, không thức giấc',
        mood: 'Tâm trạng 8 điểm, căng thẳng mức 2',
      }
      const mapEn: Record<MetricId, string> = {
        hr: 'Heart rate 72 bpm',
        hrv: 'HRV 52 ms',
        bp: 'Blood pressure 120 over 78 pulse 70',
        spo2: 'Oxygen saturation SpO2 99%',
        temp: 'Body temperature 36.7 °C',
        glu: 'Blood glucose 92 mg/dL',
        sleep: 'Slept 8 hours, 0 awakenings',
        mood: 'Mood 8, stress level 2',
      }
      return currentLang === 'EN' ? mapEn[mId] : mapVi[mId]
    },
    [],
  )

  useEffect(() => {
    if (initialVitalId) {
      const mapped = mapVitalToMetricId(initialVitalId)
      const m = METRICS.find((x) => x.id === mapped)!
      setMetricId(mapped)
      setValues(buildInitialValuesFromVitals(m, vitals))
      setConfirmAbnormal(false)
      setIsSaved(false)
    }
  }, [initialVitalId, vitals])

  // Sync with Global Hands-Free Voice Controller when it switches tabs or auto-fills & auto-saves values!
  useEffect(() => {
    if (!externalVoiceSync) return
    const targetDef = METRICS.find((x) => x.id === externalVoiceSync.metricId)
    if (!targetDef) return
    setMetricId(externalVoiceSync.metricId)
    onActiveMetricChange?.(externalVoiceSync.metricId)
    if (externalVoiceSync.values) {
      setValues(externalVoiceSync.values)
      setSource('Voice')
      setRecognizedVoiceText(
        externalVoiceSync.transcript ||
          defaultVoiceSampleForMetric(externalVoiceSync.metricId, lang),
      )
      setIsSaved(true)
      setSavedTimeUtc(
        externalVoiceSync.autoSavedTimeUtc || getCurrentUtcStamp().shortUtc,
      )
    } else {
      setValues(buildInitialValuesFromVitals(targetDef, vitals))
      setIsSaved(false)
    }
    setConfirmAbnormal(false)
  }, [defaultVoiceSampleForMetric, externalVoiceSync, getCurrentUtcStamp, lang, onActiveMetricChange, vitals])

  // Step Countdown Timer Effect
  useEffect(() => {
    if (activeStepIndex === null || stepSecondsLeft <= 0) return
    const timer = setInterval(() => {
      setStepSecondsLeft((prev) => {
        if (prev <= 1) {
          setActiveStepIndex(null)
          notify(
            lang === 'EN'
              ? 'NASA protocol step timer completed!'
              : 'Đã hoàn tất thời gian chờ của bước đo chuẩn NASA!',
          )
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [activeStepIndex, stepSecondsLeft, lang, notify])

  const commitMeasurementRecord = useCallback(
    (
      targetMetricId: MetricId,
      targetValues: Record<string, string>,
      targetSource: SourceId,
    ) => {
      const mDef = METRICS.find((x) => x.id === targetMetricId) ?? metric
      const fieldStates = mDef.fields.map((f) =>
        classifyMeasurementField(f, targetValues[f.key] ?? ''),
      )
      const abnormal = fieldStates.includes('warn') || fieldStates.includes('crit')
      const { shortUtc, fullStamp } = getCurrentUtcStamp()

      const newRow: MonitoringRow = {
        id: Date.now(),
        time: fullStamp,
        metric: targetMetricId,
        value: mDef.format(targetValues),
        source: targetSource,
        quality: abnormal
          ? 'Flagged'
          : targetSource === 'Sensor' || targetSource === 'Voice'
            ? 'Verified'
            : 'Valid',
      }

      setLocalRows((r) => [newRow, ...r])
      onAddRow?.(newRow)
      onSaveVitalEntry?.(
        targetMetricId,
        targetValues,
        targetSource === 'Sensor' ? 'Sensor' : 'Manual',
        abnormal ? 'warn' : 'ok',
      )
      setIsSaved(true)
      setSavedTimeUtc(shortUtc)
      setConfirmAbnormal(false)
      setReviewing(false)
      return { shortUtc, mDef }
    },
    [getCurrentUtcStamp, metric, onAddRow, onSaveVitalEntry],
  )

  const switchMetric = (id: MetricId) => {
    const m = METRICS.find((x) => x.id === id)!
    setMetricId(id)
    onActiveMetricChange?.(id)
    setValues(buildInitialValuesFromVitals(m, vitals))
    setConfirmAbnormal(false)
    setActiveSimPreset(null)
    setUltrasoundFinding(null)
    setActiveStepIndex(null)
    setIsSaved(false)
    if (source === 'Voice') {
      setRecognizedVoiceText(defaultVoiceSampleForMetric(id, lang))
    }
  }

  const triggerSensorSync = useCallback(
    (targetMetricId: MetricId = metricId) => {
      setIsSyncingSensor(true)
      setTimeout(() => {
        const preset = SENSOR_SYNC_PRESETS[targetMetricId]
        if (preset) {
          setValues(preset)
          setConfirmAbnormal(false)
          commitMeasurementRecord(targetMetricId, preset, 'Sensor')
        }
        setIsSyncingSensor(false)
        notify(
          lang === 'EN'
            ? 'Synced & auto-saved real-time telemetry from ISS Bio-Monitor sensor'
            : 'Đã đồng bộ & tự động lưu chỉ số từ cảm biến ISS Bio-Monitor',
        )
      }, 900)
    },
    [commitMeasurementRecord, lang, metricId, notify],
  )

  const handleSelectSource = (s: SourceId) => {
    setSource(s)
    setShowSamplePopover(false)
    if (s === 'Sensor') {
      triggerSensorSync(metricId)
    } else if (s === 'Voice') {
      if (!recognizedVoiceText) {
        setRecognizedVoiceText(defaultVoiceSampleForMetric(metricId, lang))
      }
    }
  }

  const applySimulationPreset = (presetKey: 'eva' | 'fatigue' | 'optimal') => {
    setActiveSimPreset(presetKey)
    setShowSamplePopover(false)
    const presetValues = SIMULATED_PRESETS[presetKey][metricId]
    if (presetValues) {
      setValues(presetValues)
      setSource('Simulated')
      setIsSaved(false)
      setConfirmAbnormal(false)
      const labelVi =
        presetKey === 'eva'
          ? 'Sau đi bộ không gian (EVA - Cảnh báo)'
          : presetKey === 'fatigue'
            ? 'Thiếu ngủ / Stress cao (Cảnh báo)'
            : 'Trạng thái Lý tưởng (Bình thường)'
      const labelEn =
        presetKey === 'eva'
          ? 'Post-EVA Spacewalk (Warning)'
          : presetKey === 'fatigue'
            ? 'Sleep Deprived / Stress (Warning)'
            : 'Optimal Baseline (Normal)'
      notify(
        lang === 'EN'
          ? `Loaded test preset: ${labelEn}`
          : `Đã nạp mẫu thử: ${labelVi}`,
      )
    }
  }

  const handleAnalyzeMedicalImage = (fileName: string) => {
    setUploadedImageName(fileName)
    setIsAnalyzingImage(true)
    setTimeout(() => {
      const extracted = ULTRASOUND_EXTRACTED_PRESETS[metricId]
      setValues(extracted.values)
      setUltrasoundFinding({ en: extracted.noteEn, vi: extracted.noteVi })
      setIsAnalyzingImage(false)
      setConfirmAbnormal(false)
      setIsSaved(false)
      notify(
        lang === 'EN'
          ? `AI extracted ${metric.label} parameters from medical image`
          : `AI đã trích xuất chỉ số ${metric.viLabel} từ ảnh siêu âm / máy đo`,
      )
    }, 950)
  }

  // Send spoken audio or voice draft directly to Gemini Multimodal Audio AI and auto-save
  const applySpokenNumbersToFields = useCallback(
    async (
      transcript: string,
      audioBase64?: string,
      mimeType?: 'audio/webm' | 'audio/mp4' | 'audio/ogg',
    ) => {
      try {
        setRecognizedVoiceText(transcript)
        const res = await sendMultimodalAudioToGemini({
          audioBase64,
          mimeType,
          textCommand: `${metric.label}: ${transcript}`,
          currentAppState: {
            activeModule: 'monitoring',
            activeMetricTab: metricId,
            lang,
            vitals: vitalsToAgentPayload(vitals),
          },
        })

        const matched =
          res.loggedVitals.find((v) => v.metricId === metricId) ?? res.loggedVitals[0]
        if (matched) {
          const targetId = matched.metricId
          if (targetId !== metricId) {
            setMetricId(targetId)
          }
          const formVals = convertLoggedVitalToFormValues(matched)
          setValues(formVals)
          setSource('Voice')
          setRecognizedVoiceText(res.transcript || transcript)
          commitMeasurementRecord(targetId, formVals, 'Voice')
          setVoiceDraft('')
          notify(res.toastMessage || res.spokenReply)
        }
      } catch {
        notify(
          lang === 'EN'
            ? 'Failed to reach Gemini Multimodal Audio service.'
            : 'Không thể kết nối dịch vụ Giọng nói Gemini AI.',
          'crit',
        )
      }
    },
    [commitMeasurementRecord, lang, metric.label, metricId, notify, vitals],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleLiveVoice = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          mode: string
          transcript: string
        }>
      ).detail
      if (!detail) return
      setIsVoiceDictating(detail.mode === 'RECORDING_AUDIO')
      if (detail.transcript) {
        setVoiceDraft(detail.transcript)
        setRecognizedVoiceText(detail.transcript)
        setSource('Voice')
      }
    }

    window.addEventListener('astro-voice-live', handleLiveVoice)
    return () => {
      window.removeEventListener('astro-voice-live', handleLiveVoice)
    }
  }, [])

  const handleVoiceInputClick = () => {
    setSource('Voice')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('astro-voice-manual-toggle'))
    }
  }

  // Adjust numeric field by step via [-] and [+] buttons -> unlocks Save New Measurement button
  const stepFieldValue = (f: FieldDef, deltaDirection: -1 | 1) => {
    const step = f.step ?? 1
    const current = Number(values[f.key])
    const baseVal = Number.isFinite(current) ? current : Number(f.initial)
    const decimals = step < 1 ? 1 : 0
    const nextVal = Math.max(
      f.plausible[0],
      Math.min(f.plausible[1], +(baseVal + deltaDirection * step).toFixed(decimals)),
    )
    setValues((prev) => ({ ...prev, [f.key]: String(nextVal) }))
    setIsSaved(false)
    setConfirmAbnormal(false)
  }

  // Read NASA Protocol aloud via Web Speech API
  const handleSpeakProtocol = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      notify(
        lang === 'EN'
          ? 'Speech synthesis is not supported in this browser.'
          : 'Trình duyệt không hỗ trợ đọc giọng nói.',
      )
      return
    }
    if (isSpeakingProtocol) {
      window.speechSynthesis.cancel()
      setIsSpeakingProtocol(false)
      return
    }

    const stepsText = metric.guidance
      .map((g, i) =>
        lang === 'EN' ? `Step ${i + 1}: ${g.text}` : `Bước ${i + 1}: ${g.viText}`,
      )
      .join(' ')
    const fullText =
      lang === 'EN'
        ? `NASA Measurement Protocol for ${metric.label}. ${stepsText}`
        : `Quy trình đo chuẩn NASA cho ${metric.viLabel}. ${stepsText}`

    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(fullText)
      utterance.lang = lang === 'VI' ? 'vi-VN' : 'en-US'
      utterance.rate = 1.03
      utterance.onend = () => setIsSpeakingProtocol(false)
      utterance.onerror = () => setIsSpeakingProtocol(false)
      setIsSpeakingProtocol(true)
      window.speechSynthesis.speak(utterance)
    } catch {
      setIsSpeakingProtocol(false)
    }
  }

  // Trigger Telemetry Downlink to Earth
  const handleDownlinkToEarth = () => {
    if (isDownlinking) return
    setIsDownlinking(true)
    setTimeout(() => {
      setIsDownlinking(false)
      const nowUtc = new Date().toISOString().slice(11, 19)
      setLastDownlinkTime(`${nowUtc} UTC`)
      notify(
        lang === 'EN'
          ? `Telemetry packet (${visibleRows.length} records) downlinked to NASA Johnson Space Center!`
          : `Đã truyền đồng bộ gói tin Telemetry (${visibleRows.length} bản ghi) về Trung tâm Y tế Mặt đất thành công!`,
      )
    }, 1000)
  }

  // Load a historical record back into the active form
  const handleReloadRecordIntoForm = (row: MonitoringRow) => {
    const targetMetric = METRICS.find((m) => m.id === row.metric)
    if (!targetMetric) return
    setMetricId(row.metric)
    setValues(parseRowToFormValues(row))
    setSource(row.source)
    setConfirmAbnormal(false)
    setDetail(null)
    notify(
      lang === 'EN'
        ? `Loaded record REC-${String(row.id).slice(-6)} (${targetMetric.label}) into the form`
        : `Đã nạp lại bản ghi REC-${String(row.id).slice(-6)} (${targetMetric.viLabel}) lên biểu mẫu`,
    )
  }

  const states = metric.fields.map((f) => classifyMeasurementField(f, values[f.key] ?? ''))
  const hasInvalid = states.some((s) => s === 'crit' || s === 'empty')
  const hasAbnormal = states.includes('warn')
  const canReview = !hasInvalid && (!hasAbnormal || confirmAbnormal)

  const visibleRows = useMemo(
    () => rows.filter((r) => filter === 'all' || r.source === filter).slice(0, 8),
    [rows, filter],
  )

  const save = () => {
    commitMeasurementRecord(metricId, values, source)
    notify(
      lang === 'EN'
        ? `${metric.label} measurement saved & synced to Interactive Body Model`
        : `Đã lưu chỉ số ${metric.viLabel} và đồng bộ lên Mô hình cơ thể tương tác`,
    )
  }

  const reset = () => {
    setValues(buildInitialValuesFromVitals(metric, vitals))
    setConfirmAbnormal(false)
    setTimeMode('auto')
    setActiveSimPreset(null)
    setUltrasoundFinding(null)
    setIsSaved(false)
  }

  const INPUT_MODES: Array<{
    id: SourceId
    icon: string
    labelVi: string
    labelEn: string
  }> = [
    { id: 'Manual', icon: '⌨️', labelVi: 'Thủ công', labelEn: 'Manual' },
    { id: 'Voice', icon: '🎙️', labelVi: 'Giọng nói AI', labelEn: 'AI Voice' },
    { id: 'Sensor', icon: '⌚', labelVi: 'Cảm biến tự động', labelEn: 'Auto Sensor' },
    { id: 'External', icon: '📷', labelVi: 'Ảnh Siêu âm / Máy đo', labelEn: 'Ultrasound / Device' },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow={lang === 'EN' ? 'Module 02 · Data Input' : 'Phân hệ 02 · Nhập dữ liệu'}
        title={lang === 'EN' ? 'Health Monitoring' : 'Theo dõi & Nhập Chỉ số Sinh tồn'}
      />

      <div className="chipbar" role="tablist" aria-label="Select metric">
        {METRICS.map((m) => {
          const Icon = m.icon
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={metricId === m.id}
              onClick={() => switchMetric(m.id)}
            >
              <Icon size={16} aria-hidden="true" />
              {lang === 'EN' ? m.label : m.viLabel}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* LEFT COLUMN: UNIFIED INPUT MODE BAR + ADAPTIVE INTERFACE + SMART SAVE */}
        <Panel
          title={lang === 'EN' ? metric.title : metric.viTitle}
          aside={
            <div className="ml-auto relative">
              <button
                type="button"
                onClick={() => setShowSamplePopover((prev) => !prev)}
                aria-expanded={showSamplePopover}
                className="btn !min-h-8 !px-3 !text-xs bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-indigo-200"
              >
                <Zap size={13} className="text-amber-300" aria-hidden="true" />
                <span>{lang === 'EN' ? 'Sample Presets' : 'Nạp mẫu thử'}</span>
              </button>

              {showSamplePopover && (
                <div
                  role="dialog"
                  aria-label={lang === 'EN' ? 'Quick Simulation Presets' : 'Chọn nhanh mẫu dữ liệu thử nghiệm'}
                  className="absolute right-0 top-10 w-64 rounded-xl border border-indigo-400/50 bg-[#0d1527]/98 backdrop-blur-xl p-2 shadow-2xl z-40 flex flex-col gap-1.5"
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 px-1.5 py-0.5 border-b border-slate-800">
                    {lang === 'EN' ? 'JUDGE QUICK TEST PRESETS' : 'MẪU DỮ LIỆU TEST NHANH'}
                  </div>
                  <button
                    type="button"
                    onClick={() => applySimulationPreset('optimal')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#142038] hover:bg-emerald-500/20 border border-slate-700/80 hover:border-emerald-400 text-xs text-emerald-200 flex items-center gap-2 transition-colors"
                  >
                    <CheckCircle2 size={13} className="text-emerald-400 flex-none" />
                    <span>{lang === 'EN' ? 'Optimal Baseline (Normal)' : 'Mẫu Bình thường (Lý tưởng)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applySimulationPreset('eva')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#142038] hover:bg-amber-500/20 border border-slate-700/80 hover:border-amber-400 text-xs text-amber-200 flex items-center gap-2 transition-colors"
                  >
                    <Zap size={13} className="text-amber-400 flex-none" />
                    <span>{lang === 'EN' ? 'Post-EVA Spacewalk (Warn)' : 'Mẫu Cảnh báo nhẹ (Sau EVA)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applySimulationPreset('fatigue')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#142038] hover:bg-rose-500/20 border border-slate-700/80 hover:border-rose-400 text-xs text-rose-200 flex items-center gap-2 transition-colors"
                  >
                    <Moon size={13} className="text-rose-400 flex-none" />
                    <span>{lang === 'EN' ? 'Sleep Deprived / Stress (Warn)' : 'Mẫu Cảnh báo (Thiếu ngủ / Stress)'}</span>
                  </button>
                </div>
              )}
            </div>
          }
        >
          <form
            className="flex flex-col gap-3.5 h-full"
            onSubmit={(e) => {
              e.preventDefault()
              if (!isSaved && !hasInvalid) {
                save()
              }
            }}
          >
            {/* 1. TOP UNIFIED 4-MODE SEGMENTED INPUT BAR */}
            <div
              role="tablist"
              aria-label={lang === 'EN' ? 'Input Method' : 'Phương thức nhập dữ liệu'}
              className="grid grid-cols-4 gap-1.5 rounded-xl bg-[#09101f] border border-slate-800 p-1"
            >
              {INPUT_MODES.map((m) => {
                const isActive =
                  source === m.id || (m.id === 'Manual' && source === 'Simulated')
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelectSource(m.id)}
                    className={`px-2 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap truncate cursor-pointer ${
                      isActive
                        ? 'bg-sky-500/25 border border-sky-400 text-sky-100 shadow-[0_0_14px_rgba(14,165,233,0.28)]'
                        : 'bg-transparent border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span aria-hidden="true">{m.icon}</span>
                    <span className="truncate">{lang === 'EN' ? m.labelEn : m.labelVi}</span>
                  </button>
                )
              })}
            </div>

            {/* 2. ADAPTIVE CONTEXT PANEL ABOVE NUMBER INPUTS */}
            {source === 'Voice' && (
              <div className="rounded-xl border border-sky-500/50 bg-[#0b1629] p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mic
                      size={15}
                      className={
                        isVoiceDictating
                          ? 'text-emerald-400 animate-bounce flex-none'
                          : 'text-sky-400 flex-none'
                      }
                      aria-hidden="true"
                    />
                    <span className="text-sky-200 font-medium truncate">
                      {lang === 'EN' ? '🎙️ Recognized:' : '🎙️ Đã nhận diện:'}{' '}
                      <strong className="font-mono text-emerald-300">
                        '{recognizedVoiceText || defaultVoiceSampleForMetric(metricId, lang)}'
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleVoiceInputClick}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 flex-none ${
                      isVoiceDictating
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                        : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/50 text-sky-200'
                    }`}
                  >
                    <Mic size={12} aria-hidden="true" />
                    <span>
                      {isVoiceDictating
                        ? lang === 'EN'
                          ? 'Listening...'
                          : 'Đang nghe...'
                        : lang === 'EN'
                          ? 'Speak Again'
                          : 'Nói lại'}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={voiceDraft}
                    onChange={(e) => setVoiceDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && voiceDraft.trim()) {
                        e.preventDefault()
                        applySpokenNumbersToFields(voiceDraft.trim())
                      }
                    }}
                    placeholder={lang === 'EN' ? metric.voiceHintEn : metric.voiceHintVi}
                    className="flex-1 rounded-lg bg-[#070d19] border border-slate-700/80 px-2.5 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      applySpokenNumbersToFields(
                        voiceDraft.trim() || defaultVoiceSampleForMetric(metricId, lang),
                      )
                    }
                    className="rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 px-3 py-1.5 text-xs font-semibold text-sky-200 flex-none"
                  >
                    {lang === 'EN' ? 'Auto-Fill & Save' : 'Điền & Lưu ngay'}
                  </button>
                </div>
              </div>
            )}

            {source === 'Sensor' && (
              <div className="rounded-xl border border-sky-500/45 bg-[#0b1629] p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isSyncingSensor ? (
                    <Loader2 size={17} className="text-sky-400 animate-spin flex-none" />
                  ) : (
                    <Radio size={17} className="text-emerald-400 animate-pulse flex-none" />
                  )}
                  <div className="text-xs min-w-0">
                    <div className="font-semibold text-slate-100 truncate">
                      {isSyncingSensor
                        ? lang === 'EN'
                          ? 'Syncing live telemetry from ISS Bio-Monitor...'
                          : 'Đang đồng bộ trực tiếp từ thiết bị đeo ISS Bio-Monitor...'
                        : lang === 'EN'
                          ? 'ISS Bio-Monitor Wearable Connected (Live Telemetry Synced)'
                          : 'Đã đồng bộ trực tiếp từ thiết bị đeo ISS Bio-Monitor'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      {lang === 'EN'
                        ? 'Channel: BIO-TELEMETRY-01 · Packet Loss: 0.0%'
                        : 'Kênh: BIO-TELEMETRY-01 · Độ trễ: Real-time (0.0% lỗi)'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSyncingSensor}
                  onClick={() => triggerSensorSync(metricId)}
                  className="btn btn-outline-cyan !min-h-8 !px-3 !text-xs flex-none"
                >
                  <RefreshCw
                    size={13}
                    className={isSyncingSensor ? 'animate-spin' : ''}
                    aria-hidden="true"
                  />
                  <span>
                    {lang === 'EN' ? 'Re-sync from Sensor' : 'Đồng bộ lại từ cảm biến'}
                  </span>
                </button>
              </div>
            )}

            {source === 'External' && (
              <div className="rounded-xl border border-sky-500/45 bg-[#0b1629] p-2.5 flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleAnalyzeMedicalImage(file.name)
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileImage size={16} className="text-sky-400 flex-none" aria-hidden="true" />
                    <div className="text-xs">
                      <div className="font-bold text-slate-100">
                        {lang === 'EN'
                          ? 'Ultrasound / Medical Device Image AI Extractor'
                          : 'Khung tải Ảnh Siêu âm (Ultrasound) / Chụp màn hình Máy đo'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {lang === 'EN'
                          ? 'Drop image or capture frame to auto-extract reading into fields below'
                          : 'Thả ảnh hoặc bấm chụp mẫu để AI tự động trích xuất chỉ số vào ô bên dưới'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-none">
                    <button
                      type="button"
                      disabled={isAnalyzingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-outline-cyan !min-h-8 !px-2.5 !text-xs"
                    >
                      <Upload size={13} aria-hidden="true" />
                      <span>{lang === 'EN' ? 'Upload Photo' : 'Tải ảnh lên'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isAnalyzingImage}
                      onClick={() =>
                        handleAnalyzeMedicalImage(
                          `ISS_Ultrasound_${metricId.toUpperCase()}_Day24.dcm.png`,
                        )
                      }
                      className="btn !min-h-8 !px-2.5 !text-xs bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-400/50 text-indigo-200"
                    >
                      <Camera size={13} aria-hidden="true" />
                      <span>{lang === 'EN' ? 'Sample Ultrasound' : 'Mẫu Siêu âm NASA'}</span>
                    </button>
                  </div>
                </div>

                {isAnalyzingImage && (
                  <div className="flex items-center gap-2 text-xs text-sky-300 font-mono">
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    <span>
                      {lang === 'EN'
                        ? `AI extracting parameters from "${uploadedImageName}"...`
                        : `ASTRO AI đang trích xuất chỉ số từ "${uploadedImageName}"...`}
                    </span>
                  </div>
                )}

                {ultrasoundFinding && !isAnalyzingImage && (
                  <div className="rounded-lg bg-emerald-950/35 border border-emerald-500/45 px-2.5 py-1.5 text-xs text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 flex-none mt-0.5" />
                    <div className="leading-snug">
                      {lang === 'EN' ? ultrasoundFinding.en : ultrasoundFinding.vi}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Number Inputs with Custom [-] [+] Steppers, 100% Localized Units & Live Threshold Evaluation */}
            <div
              className={`grid gap-3 ${
                metric.fields.length === 3
                  ? 'grid-cols-3'
                  : metric.fields.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
              }`}
            >
              {metric.fields.map((f, i) => {
                const st = states[i]
                const id = `f-${metric.id}-${f.key}`
                const rawVal = values[f.key] ?? ''
                const numVal = Number(rawVal)
                const decimals = f.step && f.step < 1 ? 1 : 0
                const displayUnit = getFieldUnit(f, lang)

                let liveStatusNode: React.ReactNode
                if (st === 'empty') {
                  liveStatusNode = (
                    <span className="text-slate-400">
                      {lang === 'EN'
                        ? `Normal ${f.normal[0]}–${f.normal[1]} ${displayUnit}`
                        : `Chuẩn ${f.normal[0]}–${f.normal[1]} ${displayUnit}`}
                    </span>
                  )
                } else if (st === 'crit') {
                  liveStatusNode = (
                    <span className="text-rose-300 font-semibold">
                      {lang === 'EN'
                        ? `🚨 Out of plausible range (${f.plausible[0]}–${f.plausible[1]} ${displayUnit})`
                        : `🚨 Vượt ngưỡng sinh lý (${f.plausible[0]}–${f.plausible[1]} ${displayUnit})`}
                    </span>
                  )
                } else if (st === 'warn') {
                  const isHigh = numVal > f.normal[1]
                  const diff = isHigh
                    ? +(numVal - f.normal[1]).toFixed(decimals)
                    : +(f.normal[0] - numVal).toFixed(decimals)
                  liveStatusNode = (
                    <span className="text-amber-300 font-semibold">
                      {isHigh
                        ? lang === 'EN'
                          ? `⚠️ Above normal +${diff} ${displayUnit}`
                          : `⚠️ Vượt ngưỡng chuẩn +${diff} ${displayUnit}`
                        : lang === 'EN'
                          ? `⚠️ Below normal -${diff} ${displayUnit}`
                          : `⚠️ Thấp hơn chuẩn -${diff} ${displayUnit}`}
                    </span>
                  )
                } else {
                  liveStatusNode = (
                    <span className="text-emerald-300 font-semibold">
                      {lang === 'EN'
                        ? `🟢 Normal (${f.normal[0]}–${f.normal[1]} ${displayUnit})`
                        : `🟢 Bình thường (Chuẩn ${f.normal[0]}–${f.normal[1]} ${displayUnit})`}
                    </span>
                  )
                }

                const borderGlowClass =
                  st === 'crit'
                    ? '!border-rose-500/90 shadow-[0_0_16px_rgba(244,63,94,0.22)] bg-rose-950/20'
                    : st === 'warn'
                      ? '!border-amber-400/90 shadow-[0_0_14px_rgba(245,158,11,0.18)] bg-amber-950/15'
                      : st === 'ok'
                        ? '!border-emerald-500/75 shadow-[0_0_12px_rgba(16,185,129,0.15)] bg-emerald-950/10'
                        : ''

                return (
                  <div key={f.key} className="field">
                    <label htmlFor={id} className="flex items-center justify-between gap-1">
                      <span className="truncate">{lang === 'EN' ? f.label : f.viLabel}</span>
                      <span className="text-[10px] font-mono text-slate-400 normal-case whitespace-nowrap">
                        {f.normal[0]}–{f.normal[1]} {displayUnit}
                      </span>
                    </label>
                    <div className={`input-wrap !px-2 transition-all duration-200 ${borderGlowClass}`}>
                      <button
                        type="button"
                        onClick={() => stepFieldValue(f, -1)}
                        aria-label={
                          lang === 'EN' ? `Decrease ${f.label}` : `Giảm ${f.viLabel}`
                        }
                        className="w-7 h-7 rounded-md bg-slate-800/90 hover:bg-slate-700 border border-slate-600/80 text-slate-200 flex items-center justify-center flex-none transition-colors cursor-pointer"
                      >
                        <Minus size={13} aria-hidden="true" />
                      </button>

                      <input
                        id={id}
                        inputMode="decimal"
                        type="number"
                        step={f.step ?? 1}
                        value={rawVal}
                        aria-invalid={st === 'crit'}
                        aria-describedby={`${id}-r`}
                        className="text-center !text-xl font-mono tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        onChange={(e) => {
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                          setIsSaved(false)
                          setConfirmAbnormal(false)
                        }}
                      />

                      <span className="unit flex-none">{displayUnit}</span>

                      <button
                        type="button"
                        onClick={() => stepFieldValue(f, 1)}
                        aria-label={
                          lang === 'EN' ? `Increase ${f.label}` : `Tăng ${f.viLabel}`
                        }
                        className="w-7 h-7 rounded-md bg-slate-800/90 hover:bg-slate-700 border border-slate-600/80 text-slate-200 flex items-center justify-center flex-none transition-colors cursor-pointer"
                      >
                        <Plus size={13} aria-hidden="true" />
                      </button>
                    </div>

                    <div id={`${id}-r`} className="text-[11px] font-mono leading-tight min-h-[16px]">
                      {liveStatusNode}
                    </div>
                  </div>
                )
              })}
            </div>

            {hasInvalid && states.includes('crit') && (
              <div className="banner crit" role="alert">
                <CircleAlert size={18} className="flex-none mt-px" aria-hidden="true" />
                <span>
                  {lang === 'EN'
                    ? 'One or more values are outside physiologically plausible limits. Please re-measure or correct the entry.'
                    : 'Một hoặc nhiều giá trị vượt ngoài giới hạn sinh lý cho phép. Vui lòng đo lại hoặc kiểm tra số nhập.'}
                </span>
              </div>
            )}

            {/* 4. COMPACT FOOTER ROW: Inline Measurement Time + Smart Anti-Duplicate Save Button */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 mt-auto flex-wrap">
              {/* Compact Inline Measurement Time */}
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                <span aria-hidden="true">🕒</span>
                <span className="text-slate-400">
                  {lang === 'EN' ? 'Time:' : 'Thời điểm:'}
                </span>
                {timeMode === 'auto' ? (
                  <span className="text-slate-200 font-semibold">
                    {lang === 'EN' ? 'Current (Auto)' : 'Hiện tại (Tự động)'}
                  </span>
                ) : (
                  <input
                    type="time"
                    aria-label="Custom time (UTC)"
                    value={customTime}
                    onChange={(e) => {
                      setCustomTime(e.target.value)
                      setIsSaved(false)
                    }}
                    className="rounded bg-slate-900 border border-sky-400/50 px-1.5 py-0.5 text-xs text-sky-200 font-mono"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setTimeMode((m) => (m === 'auto' ? 'custom' : 'auto'))
                    setIsSaved(false)
                  }}
                  className="text-sky-400 hover:text-sky-300 underline font-sans font-semibold ml-0.5 cursor-pointer"
                >
                  [{timeMode === 'auto' ? (lang === 'EN' ? 'Change' : 'Đổi') : lang === 'EN' ? 'Auto' : 'Tự động'}]
                </button>
              </div>

              {/* Smart Anti-Duplicate Save Action Group */}
              <div className="flex items-center gap-2 ml-auto">
                {isSaved ? (
                  <button
                    type="button"
                    disabled
                    data-testid="smart-save-confirmed-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/55 px-3.5 py-2 text-xs font-mono font-bold text-emerald-300 cursor-default select-none shadow-[inset_0_1px_0_rgba(16,185,129,0.2)]"
                  >
                    <Check size={14} className="text-emerald-400" aria-hidden="true" />
                    <span>
                      {lang === 'EN'
                        ? `Saved & Synced to History (${savedTimeUtc})`
                        : `Đã lưu & Đồng bộ xuống Lịch sử (${savedTimeUtc})`}
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn !min-h-9 !px-3 !text-xs"
                      onClick={reset}
                    >
                      {lang === 'EN' ? 'Reset' : 'Đặt lại'}
                    </button>
                    <button
                      type="submit"
                      data-testid="smart-save-new-btn"
                      disabled={hasInvalid}
                      className="btn btn-primary !min-h-9 !px-4 !text-xs disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_18px_rgba(14,165,233,0.4)]"
                    >
                      <span>
                        {lang === 'EN' ? '💾 Save New Measurement' : '💾 Lưu Chỉ số Mới'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </Panel>

        {/* RIGHT COLUMN: NASA MEASUREMENT PROTOCOL + STEP TIMERS + WHY IT MATTERS IN SPACE */}
        <Panel
          title={lang === 'EN' ? 'Measurement Guidance' : 'Quy trình Đo chuẩn NASA'}
          aside={
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleSpeakProtocol}
                aria-pressed={isSpeakingProtocol}
                className={`btn !min-h-8 !px-3 !text-xs ${
                  isSpeakingProtocol ? 'btn-primary animate-pulse' : 'btn-outline-cyan'
                }`}
              >
                <Volume2 size={14} aria-hidden="true" />
                <span>
                  {isSpeakingProtocol
                    ? lang === 'EN'
                      ? 'Stop Reading'
                      : 'Dừng đọc'
                    : lang === 'EN'
                      ? 'AI Read Protocol'
                      : 'AI Đọc quy trình'}
                </span>
              </button>
              <span className="pill cyan">{lang === 'EN' ? metric.label : metric.viLabel}</span>
            </div>
          }
        >
          <ol className="steps">
            {metric.guidance.map((g, i) => {
              const Icon = g.icon
              const isTimerActive = activeStepIndex === i && stepSecondsLeft > 0
              return (
                <li key={g.text} className="flex items-center justify-between gap-2.5">
                  <span className="n">{i + 1}</span>
                  <span className="flex-1 text-xs sm:text-sm leading-snug">
                    {lang === 'EN' ? g.text : g.viText}
                  </span>

                  {/* Interactive Countdown Timer Button for Timed Steps */}
                  {g.timerSeconds && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isTimerActive) {
                          setActiveStepIndex(null)
                          setStepSecondsLeft(0)
                        } else {
                          setActiveStepIndex(i)
                          setStepSecondsLeft(g.timerSeconds!)
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono font-semibold transition-all flex-none ${
                        isTimerActive
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 animate-pulse'
                          : 'bg-[#121d33] hover:bg-sky-500/20 border-sky-500/45 text-sky-300'
                      }`}
                    >
                      {isTimerActive ? (
                        <>
                          <RotateCcw size={12} aria-hidden="true" />
                          <span>{formatCountdown(stepSecondsLeft)}</span>
                        </>
                      ) : (
                        <>
                          <Timer size={13} aria-hidden="true" />
                          <span>
                            {lang === 'EN'
                              ? `Timer (${g.timerSeconds >= 60 ? `${g.timerSeconds / 60}m` : `${g.timerSeconds}s`})`
                              : `Bấm giờ (${g.timerSeconds >= 60 ? `${g.timerSeconds / 60}p` : `${g.timerSeconds}s`})`}
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  <span className="mi">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                </li>
              )
            })}
          </ol>

          {/* Dynamic "Why It Matters in Microgravity" Biomedical Context Card */}
          <div className="mt-3 rounded-xl border border-indigo-500/40 bg-[#0f172a] p-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
              <Stethoscope size={14} className="text-sky-400 flex-none" aria-hidden="true" />
              <span>
                {lang === 'EN'
                  ? `Why ${metric.label} Matters in Space`
                  : `Tại sao ${metric.viLabel} quan trọng trong không gian?`}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lang === 'EN' ? metric.whyItMattersEn : metric.whyItMattersVi}
            </p>
          </div>

          <div className="banner neu mt-2.5">
            <Eye size={16} className="flex-none mt-px" aria-hidden="true" />
            <span>
              {lang === 'EN'
                ? 'Readings are stored locally first, update the Dashboard Interactive Body Model, and sync to ground when the downlink is available.'
                : 'Kết quả đo được lưu cục bộ ngay lập tức, đồng bộ trực tiếp lên Mô hình cơ thể trên Dashboard và truyền về mặt đất khi có kết nối.'}
            </span>
          </div>
        </Panel>
      </div>

      {/* BOTTOM PANEL: 100% LOCALIZED MEASUREMENT HISTORY + EARTH DOWNLINK */}
      <Panel
        title={lang === 'EN' ? 'Measurement History' : 'Lịch sử Đo lường Sinh trắc học'}
        aside={
          <div className="ml-auto flex items-center gap-2.5 flex-wrap">
            {lastDownlinkTime && (
              <span className="text-[11px] font-mono text-emerald-400 hidden sm:inline">
                {lang === 'EN'
                  ? `Last Downlink: ${lastDownlinkTime}`
                  : `Đã truyền lúc: ${lastDownlinkTime}`}
              </span>
            )}

            <button
              type="button"
              onClick={handleDownlinkToEarth}
              disabled={isDownlinking}
              className="btn btn-outline-cyan !min-h-10 !px-3.5 !text-xs"
            >
              {isDownlinking ? (
                <Loader2 size={14} className="animate-spin text-sky-300" aria-hidden="true" />
              ) : (
                <Radio size={14} className="text-sky-400" aria-hidden="true" />
              )}
              <span>
                {isDownlinking
                  ? lang === 'EN'
                    ? 'Transmitting...'
                    : 'Đang truyền gói tin...'
                  : lang === 'EN'
                    ? 'Downlink to Earth'
                    : 'Truyền về Trái Đất (Downlink)'}
              </span>
            </button>

            <label htmlFor="hist-filter" className="text-xs text-slate-400">
              {lang === 'EN' ? 'Source:' : 'Nguồn:'}
            </label>
            <div className="input-wrap !min-h-10 w-44">
              <select
                id="hist-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | SourceId)}
                className="!h-10"
              >
                <option value="all">{lang === 'EN' ? 'All sources' : 'Tất cả nguồn'}</option>
                {ALL_HISTORY_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[lang][s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        <table className="dt">
          <thead>
            <tr>
              <th scope="col">{lang === 'EN' ? 'Date / Time (UTC)' : 'Thời gian (UTC)'}</th>
              <th scope="col">{lang === 'EN' ? 'Metric' : 'Chỉ số'}</th>
              <th scope="col">{lang === 'EN' ? 'Value' : 'Giá trị'}</th>
              <th scope="col">{lang === 'EN' ? 'Source' : 'Nguồn'}</th>
              <th scope="col">{lang === 'EN' ? 'Quality' : 'Trạng thái'}</th>
              <th scope="col" className="w-14">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const mDef = METRICS.find((m) => m.id === r.metric)
              return (
                <tr key={r.id}>
                  <td className="font-mono text-slate-300">{r.time}</td>
                  <td>{lang === 'EN' ? mDef?.label : mDef?.viLabel}</td>
                  <td className="font-mono font-semibold">
                    {formatHistoryRowValue(r, lang)}
                  </td>
                  <td>
                    <span className={`pill ${SOURCE_PILL[r.source]}`}>{SOURCE_LABEL[lang][r.source]}</span>
                  </td>
                  <td>
                    <span
                      className={`st ${
                        r.quality === 'Verified' ? 'ok' : r.quality === 'Flagged' ? 'warn' : 'neu'
                      }`}
                    >
                      {QUALITY_LABEL[lang][r.quality]}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn hover:border-sky-400/60"
                      aria-label={
                        lang === 'EN'
                          ? `View details for ${r.time}`
                          : `Xem chi tiết bản ghi ${r.time}`
                      }
                      onClick={() => setDetail(r)}
                    >
                      <Eye size={18} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-6">
                  {lang === 'EN' ? 'No records for this source.' : 'Không có bản ghi nào cho nguồn này.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {/* Review & Confirm Modal */}
      {reviewing && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="review-h">
          <div className="sheet">
            <div className="sheet-h">
              <h3 id="review-h">
                {lang === 'EN' ? 'Review Measurement' : 'Xác nhận Lưu Chỉ số'}
              </h3>
              {hasAbnormal && (
                <span className="st warn">
                  {lang === 'EN' ? 'ABOVE RANGE' : 'VƯỢT NGƯỠNG CHUẨN'}
                </span>
              )}
            </div>
            <dl className="kv !text-sm">
              <dt>{lang === 'EN' ? 'Metric' : 'Chỉ số'}</dt>
              <dd>{lang === 'EN' ? metric.label : metric.viLabel}</dd>
              <dt>{lang === 'EN' ? 'Value' : 'Giá trị'}</dt>
              <dd className="font-mono font-semibold">{metric.format(values)}</dd>
              <dt>{lang === 'EN' ? 'Time' : 'Thời gian'}</dt>
              <dd className="font-mono">
                {timeMode === 'auto'
                  ? lang === 'EN'
                    ? 'Current Time (Auto)'
                    : 'Hiện tại (Tự động)'
                  : `${customTime} UTC`}
              </dd>
              <dt>{lang === 'EN' ? 'Source' : 'Nguồn'}</dt>
              <dd>{SOURCE_LABEL[lang][source]}</dd>
            </dl>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn" onClick={() => setReviewing(false)}>
                {lang === 'EN' ? 'Back to Edit' : 'Quay lại sửa'}
              </button>
              <button type="button" className="btn btn-primary" onClick={save} autoFocus>
                {lang === 'EN' ? 'Confirm & Save' : 'Xác nhận & Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Record Detail Modal with ASTRO AI Clinical Note & Reload into Form */}
      {detail && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-h"
          onClick={() => setDetail(null)}
        >
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-h">
              <h3 id="detail-h">
                {lang === 'EN' ? 'Telemetry Record Details' : 'Chi tiết Bản ghi Sinh trắc học'}
              </h3>
              <span className={`pill ${SOURCE_PILL[detail.source]}`}>
                {SOURCE_LABEL[lang][detail.source]}
              </span>
            </div>

            <dl className="kv !text-sm">
              <dt>{lang === 'EN' ? 'Recorded' : 'Thời điểm đo'}</dt>
              <dd className="font-mono">{detail.time} UTC</dd>
              <dt>{lang === 'EN' ? 'Metric' : 'Chỉ số'}</dt>
              <dd className="font-semibold">
                {lang === 'EN'
                  ? METRICS.find((m) => m.id === detail.metric)?.label
                  : METRICS.find((m) => m.id === detail.metric)?.viLabel}
              </dd>
              <dt>{lang === 'EN' ? 'Value' : 'Giá trị đo'}</dt>
              <dd className="font-mono font-bold text-sky-300">
                {formatHistoryRowValue(detail, lang)}
              </dd>
              <dt>{lang === 'EN' ? 'Quality' : 'Trạng thái'}</dt>
              <dd>
                <span
                  className={`st ${
                    detail.quality === 'Verified'
                      ? 'ok'
                      : detail.quality === 'Flagged'
                        ? 'warn'
                        : 'neu'
                  }`}
                >
                  {QUALITY_LABEL[lang][detail.quality]}
                </span>
              </dd>
              <dt>{lang === 'EN' ? 'Record ID' : 'Mã bản ghi'}</dt>
              <dd className="font-mono text-slate-400">REC-{String(detail.id).slice(-6)}</dd>
            </dl>

            {/* ASTRO AI Clinical Assessment for this record */}
            <div className="rounded-xl border border-sky-500/40 bg-[#0d1729] p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
                <Stethoscope size={14} aria-hidden="true" />
                <span>
                  {lang === 'EN'
                    ? 'ASTRO AI Telemetry Assessment'
                    : 'Nhận xét Y sinh từ ASTRO AI'}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {getClinicalNoteForRow(detail, lang)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                className="btn btn-outline-cyan !min-h-10 !text-xs"
                onClick={() => handleReloadRecordIntoForm(detail)}
              >
                <Download size={14} aria-hidden="true" />
                <span>
                  {lang === 'EN'
                    ? 'Load Record into Form'
                    : 'Nạp lại bản ghi này lên Form'}
                </span>
              </button>

              <button type="button" className="btn !min-h-10" onClick={() => setDetail(null)} autoFocus>
                {lang === 'EN' ? 'Close' : 'Đóng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
