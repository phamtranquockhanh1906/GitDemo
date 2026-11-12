export type Status = 'ok' | 'warn' | 'crit' | 'neu'

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

export type Vital = {
  id: VitalId
  title: string
  value: string
  unit: string
  status: Status
  source: 'Sensor' | 'Manual'
  updated: string
  series: number[]
  baseline: number
  range: string
}

export const VITALS: Vital[] = [
  { id: 'hr', title: 'Heart Rate', value: '75', unit: 'BPM', status: 'ok', source: 'Sensor', updated: '2m ago', series: [72, 74, 71, 76, 73, 77, 75], baseline: 70, range: 'Baseline 66–74 bpm' },
  { id: 'bp', title: 'Blood Pressure', value: '125/82', unit: 'mmHg', status: 'ok', source: 'Sensor', updated: '15m ago', series: [121, 124, 122, 126, 123, 127, 125], baseline: 122, range: 'Baseline 118/78 mmHg' },
  { id: 'spo2', title: 'SpO₂', value: '98', unit: '%', status: 'ok', source: 'Sensor', updated: '2m ago', series: [98, 97, 98, 99, 98, 97, 98], baseline: 98, range: 'Target ≥ 95%' },
  { id: 'temp', title: 'Body Temperature', value: '36.8', unit: '°C', status: 'ok', source: 'Sensor', updated: '15m ago', series: [36.7, 36.8, 36.6, 36.9, 36.8, 36.7, 36.8], baseline: 36.7, range: 'Baseline 36.5–37.0 °C' },
  { id: 'sleep', title: 'Sleep Duration', value: '6.2', unit: 'hrs', status: 'warn', source: 'Sensor', updated: '8h ago', series: [7.4, 7.1, 6.8, 6.5, 6.6, 6.3, 6.2], baseline: 7.5, range: 'Personal target 7.5 h' },
  { id: 'hrv', title: 'HRV', value: '42', unit: 'ms', status: 'warn', source: 'Sensor', updated: '15m ago', series: [50, 49, 47, 45, 44, 43, 42], baseline: 49, range: 'Baseline 49 ms (−14%)' },
  { id: 'stress', title: 'Stress Level', value: '6', unit: '/10', status: 'warn', source: 'Manual', updated: '1h ago', series: [4, 4, 5, 5, 6, 5, 6], baseline: 4, range: 'Baseline 3–5' },
  { id: 'glu', title: 'Blood Glucose', value: '95', unit: 'mg/dL', status: 'ok', source: 'Manual', updated: '3h ago', series: [92, 96, 94, 98, 93, 97, 95], baseline: 94, range: 'Range 70–110 mg/dL' },
]

export type TrendRange = '24H' | '7D' | '30D'

export const TREND_DATA: Record<TrendRange, { labels: string[]; hrv: number[]; hr: number[] }> = {
  '24H': { labels: ['00', '04', '08', '12', '16', '20', 'Now'], hrv: [46, 48, 44, 41, 40, 43, 42], hr: [64, 62, 70, 78, 80, 76, 75] },
  '7D': { labels: ['D18', 'D19', 'D20', 'D21', 'D22', 'D23', 'D24'], hrv: [50, 49, 47, 45, 44, 43, 42], hr: [70, 71, 72, 73, 74, 74, 75] },
  '30D': { labels: ['W1', '', 'W2', '', 'W3', '', 'W4'], hrv: [51, 50, 52, 49, 47, 44, 42], hr: [69, 70, 69, 71, 72, 74, 75] },
}

export type AnalyticsRange = '7D' | '30D' | '90D'

export const ANALYTICS_DATA: Record<
  AnalyticsRange,
  {
    labels: string[]
    hrv: number[]
    sleep: number[]
    rhr: number[]
    summary: { hrv: number; hrvDelta: string; sleep: number; rhr: number; recovery: number }
  }
> = {
  '7D': {
    labels: ['D18', 'D19', 'D20', 'D21', 'D22', 'D23', 'D24'],
    hrv: [50, 49, 47, 45, 44, 43, 42],
    sleep: [7.4, 7.1, 6.8, 6.5, 6.6, 6.3, 6.2],
    rhr: [62, 63, 63, 64, 65, 65, 66],
    summary: { hrv: 45.7, hrvDelta: '−7%', sleep: 6.7, rhr: 64, recovery: 68 },
  },
  '30D': {
    labels: ['W1', '', 'W2', '', 'W3', '', 'W4'],
    hrv: [51, 50, 52, 49, 47, 44, 42],
    sleep: [7.6, 7.5, 7.4, 7.2, 6.9, 6.6, 6.3],
    rhr: [61, 61, 62, 62, 63, 64, 66],
    summary: { hrv: 47.9, hrvDelta: '−3%', sleep: 7.1, rhr: 63, recovery: 74 },
  },
  '90D': {
    labels: ['Pre', '', 'L+0', '', 'M1', '', 'Now'],
    hrv: [53, 52, 46, 48, 50, 47, 42],
    sleep: [7.8, 7.7, 6.4, 7.0, 7.4, 7.0, 6.3],
    rhr: [59, 60, 68, 64, 62, 63, 66],
    summary: { hrv: 48.3, hrvDelta: '−2%', sleep: 7.1, rhr: 63, recovery: 76 },
  },
}
