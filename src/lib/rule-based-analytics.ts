/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NASA-STD-3001 & HRP Compliant Rule-Based Analytics Engine
 * 
 * Luồng hoạt động 4 bước:
 * 1. Kiểm tra dữ liệu (Validation & Quality)
 * 2. Đối chiếu ngưỡng (NASA Physiological Thresholds)
 * 3. So sánh baseline (Personal Pre-flight Baseline & Variance)
 * 4. Phân tích xu hướng (Longitudinal Trend & Consecutive Streak Detection)
 * 
 * Cấu trúc đầu ra 3 thành phần (A-I-A):
 * - Assessment (Đánh giá): Tình trạng hiện tại như thế nào?
 * - Insight (Nhận xét): Điều gì đang xảy ra và tại sao cần chú ý?
 * - Action (Hành động): Người dùng nên làm gì tiếp theo?
 */

import type { Lang, VitalId } from './astro-data'

export type AnalyticsStatus = 'NOMINAL' | 'MONITORING' | 'MEDICAL_ATTENTION'

export type AnalyticsRuleOutput = {
  // 1. Assessment - Đánh giá
  assessment: {
    status: AnalyticsStatus
    statusLabelEn: string
    statusLabelVi: string
    severityScore: 1 | 2 | 3 // 1: Nominal, 2: Moderate, 3: High
    currentValueFormatted: string
    baselineFormatted: string
    varianceFormatted: string
    percentChange: number
    isAdverse: boolean
  }
  // 2. Insight - Nhận xét
  insight: {
    summaryEn: string
    summaryVi: string
    mechanismEn: string
    mechanismVi: string
    spaceHazardEn: string
    spaceHazardVi: string
    trendDetected: boolean
    trendDescriptionEn?: string
    trendDescriptionVi?: string
  }
  // 3. Action - Hành động
  action: {
    urgencyLevelEn: string
    urgencyLevelVi: string
    stepsEn: string[]
    stepsVi: string[]
    targetModule?: 'monitoring' | 'ai' | 'dashboard'
    targetMetricId?: VitalId
    ctaLabelEn: string
    ctaLabelVi: string
  }
}

export type AnalyticsMetricId = 'hrv' | 'hr' | 'bp' | 'spo2' | 'sleep' | 'temp'

export type AnalyticsInput = {
  metricId: AnalyticsMetricId
  currentValue: number
  baselineValue: number
  seriesValues: number[]
  unit: string
  lowerIsWorse: boolean
  lang: Lang
}

/**
 * Thuật toán phát hiện chuỗi suy giảm bất lợi liên tiếp (>= 3 điểm)
 */
export function detectTrendStreak(
  values: number[],
  lowerIsWorse: boolean,
): { start: number; end: number; length: number } | null {
  if (values.length < 3) return null
  const end = values.length - 1
  let start = end
  while (
    start > 0 &&
    (lowerIsWorse ? values[start - 1] > values[start] : values[start - 1] < values[start])
  ) {
    start--
  }
  const length = end - start + 1
  return length >= 3 ? { start, end, length } : null
}

/**
 * ĐỘNG CƠ ĐÁNH GIÁ DỰA TRÊN QUY TẮC (RULE-BASED ASSESSMENT ENGINE)
 */
export function evaluateRuleBasedAnalytics(input: AnalyticsInput): AnalyticsRuleOutput {
  const { metricId, currentValue, baselineValue, seriesValues, unit, lowerIsWorse } = input

  // BƯỚC 1: KIỂM TRA DỮ LIỆU
  const safeCurrent = Number.isFinite(currentValue) ? currentValue : baselineValue
  const safeBaseline = Number.isFinite(baselineValue) && baselineValue > 0 ? baselineValue : 1

  // BƯỚC 2 & 3: ĐỐI CHIẾU NGƯỠNG & SO SÁNH BASELINE
  const rawDiff = +(safeCurrent - safeBaseline).toFixed(1)
  const pctChange = Math.round((rawDiff / safeBaseline) * 100)
  const isAdverse = lowerIsWorse ? rawDiff < 0 : rawDiff > 0
  const absPct = Math.abs(pctChange)

  // BƯỚC 4: PHÂN TÍCH XU HƯỚNG
  const streak = detectTrendStreak(seriesValues, lowerIsWorse)
  const hasStreak = streak !== null

  // XÁC ĐỊNH TRẠNG THÁI ASSESSMENT (3 MỨC CHUẨN NASA)
  let status: AnalyticsStatus = 'NOMINAL'
  let severityScore: 1 | 2 | 3 = 1

  // Quy tắc ngưỡng cho từng chỉ số
  if (metricId === 'hrv') {
    if (safeCurrent < 32 || (absPct >= 30 && isAdverse)) {
      status = 'MEDICAL_ATTENTION'
      severityScore = 3
    } else if (safeCurrent < 46 || (absPct >= 12 && isAdverse) || hasStreak) {
      status = 'MONITORING'
      severityScore = 2
    }
  } else if (metricId === 'hr') {
    if (safeCurrent >= 115 || safeCurrent < 48) {
      status = 'MEDICAL_ATTENTION'
      severityScore = 3
    } else if (safeCurrent >= 95 || safeCurrent < 55 || hasStreak) {
      status = 'MONITORING'
      severityScore = 2
    }
  } else if (metricId === 'bp') {
    // Systolic
    if (safeCurrent >= 140 || safeCurrent < 85) {
      status = 'MEDICAL_ATTENTION'
      severityScore = 3
    } else if (safeCurrent >= 125 || safeCurrent < 95 || hasStreak) {
      status = 'MONITORING'
      severityScore = 2
    }
  } else if (metricId === 'spo2') {
    if (safeCurrent < 92) {
      status = 'MEDICAL_ATTENTION'
      severityScore = 3
    } else if (safeCurrent < 96) {
      status = 'MONITORING'
      severityScore = 2
    }
  } else if (metricId === 'sleep') {
    if (safeCurrent < 5.0) {
      status = 'MEDICAL_ATTENTION'
      severityScore = 3
    } else if (safeCurrent < 6.8 || hasStreak) {
      status = 'MONITORING'
      severityScore = 2
    }
  }

  // TẠO ĐẦU RA 1: ASSESSMENT
  const statusLabels = {
    NOMINAL: {
      en: 'Within Reference Baseline',
      vi: 'Trong Giới hạn Tham chiếu',
    },
    MONITORING: {
      en: 'Monitoring Required',
      vi: 'Cần Tiếp tục Theo dõi',
    },
    MEDICAL_ATTENTION: {
      en: 'Medical Attention Warranted',
      vi: 'Cần Hỗ trợ Y tế từ Mặt đất',
    },
  }

  const assessment = {
    status,
    statusLabelEn: statusLabels[status].en,
    statusLabelVi: statusLabels[status].vi,
    severityScore,
    currentValueFormatted: `${safeCurrent} ${unit}`,
    baselineFormatted: `${safeBaseline} ${unit}`,
    varianceFormatted: `${rawDiff > 0 ? '+' : ''}${rawDiff} ${unit} (${absPct}% ${isAdverse ? 'lệch bất lợi' : 'ổn định'})`,
    percentChange: pctChange,
    isAdverse,
  }

  // TẠO ĐẦU RA 2: INSIGHT (Điều gì đang xảy ra và tại sao cần chú ý?)
  const insights = buildInsightContent(metricId, safeCurrent, safeBaseline, pctChange, streak, status)

  // TẠO ĐẦU RA 3: ACTION (Người dùng nên làm gì tiếp theo?)
  const action = buildActionContent(metricId, status, safeCurrent, unit)

  return {
    assessment,
    insight: insights,
    action,
  }
}

/**
 * Xây dựng nội dung Nhận xét lâm sàng (Insight)
 */
function buildInsightContent(
  metricId: AnalyticsMetricId,
  current: number,
  baseline: number,
  pct: number,
  streak: { start: number; end: number; length: number } | null,
  status: AnalyticsStatus,
) {
  const streakTextEn = streak
    ? `Sustained adverse trend detected over ${streak.length} consecutive measurement points.`
    : undefined
  const streakTextVi = streak
    ? `Phát hiện chuỗi biến động bất lợi liên tiếp qua ${streak.length} mốc đo gần nhất.`
    : undefined

  switch (metricId) {
    case 'hrv':
      return {
        summaryEn:
          status === 'NOMINAL'
            ? `HRV is robust (${current} ms), indicating balanced autonomic nervous system tone and good recovery.`
            : `HRV has dropped to ${current} ms (${Math.abs(pct)}% below pre-flight baseline of ${baseline} ms).`,
        summaryVi:
          status === 'NOMINAL'
            ? `Biến thiên HRV duy trì ở mức cao (${current} ms), phản ánh hệ thần kinh tự chủ cân bằng và phục hồi tốt.`
            : `Biến thiên HRV suy giảm xuống ${current} ms (thấp hơn ${Math.abs(pct)}% so với mức chuẩn trước bay ${baseline} ms).`,
        mechanismEn:
          'RMSSD reflects parasympathetic vagal stimulation. In microgravity, sympathetic over-activation from high operational tempo, EVA fatigue, and fluid shift suppresses vagal tone.',
        mechanismVi:
          'Chỉ số RMSSD phản ánh hoạt động của dây thần kinh phế vị. Trong không gian, sự quá tải giao cảm do cường độ làm việc cao, áp lực EVA và dịch chuyển thể dịch làm giảm trương lực phế vị.',
        spaceHazardEn:
          'NASA Hazard: [I] Isolation & Confinement paired with [G] Microgravity cephalad autonomic deconditioning.',
        spaceHazardVi:
          'Mối nguy NASA: [I] Cô lập & Buồng kín kết hợp [G] Vi trọng lực gây mất cân bằng thần kinh tự chủ.',
        trendDetected: streak !== null,
        trendDescriptionEn: streakTextEn,
        trendDescriptionVi: streakTextVi,
      }

    case 'hr':
      return {
        summaryEn:
          status === 'NOMINAL'
            ? `Resting heart rate (${current} BPM) is well-controlled near personal baseline (${baseline} BPM).`
            : `Resting heart rate is elevated at ${current} BPM (+${Math.abs(pct)}% above baseline).`,
        summaryVi:
          status === 'NOMINAL'
            ? `Nhịp tim nghỉ (${current} BPM) ổn định quanh dải chuẩn cá nhân (${baseline} BPM).`
            : `Nhịp tim nghỉ tăng lên ${current} BPM (cao hơn +${Math.abs(pct)}% so với mức chuẩn bình thường).`,
        mechanismEn:
          'Microgravity reduces plasma volume by 10-15% within days, causing compensatory tachycardia to maintain cardiac output against reduced stroke volume.',
        mechanismVi:
          'Vi trọng lực làm giảm 10-15% thể tích huyết tương trong vài ngày đầu, khiến tim phải đập nhanh hơn để duy trì lưu lượng tuần hoàn.',
        spaceHazardEn:
          'NASA Hazard: [G] Microgravity cardiovascular adaptation and decreased blood volume.',
        spaceHazardVi:
          'Mối nguy NASA: [G] Thích nghi tim mạch trong vi trọng lực và suy giảm thể tích tuần hoàn.',
        trendDetected: streak !== null,
        trendDescriptionEn: streakTextEn,
        trendDescriptionVi: streakTextVi,
      }

    case 'bp':
      return {
        summaryEn:
          status === 'NOMINAL'
            ? `Arterial pressure (${current} mmHg systolic) is stable within normal spaceflight limits.`
            : `Systolic pressure is elevated at ${current} mmHg vs ${baseline} mmHg baseline.`,
        summaryVi:
          status === 'NOMINAL'
            ? `Huyết áp động mạch (${current} mmHg tâm thu) ổn định trong dải an toàn nhiệm vụ.`
            : `Huyết áp tâm thu tăng lên ${current} mmHg so với mức chuẩn trước bay ${baseline} mmHg.`,
        mechanismEn:
          'Cephalad fluid shift moves ~2 liters of blood from lower limbs to head and thorax, elevating upper body arterial pressure and optic nerve sheath pressure (SANS risk).',
        mechanismVi:
          'Dịch chuyển dịch thể dồn khoảng 2 lít máu lên vùng ngực và đầu, làm tăng áp lực động mạch phần trên cơ thể và tăng áp lực bao dây thần kinh thị giác (nguy cơ SANS).',
        spaceHazardEn:
          'NASA Hazard: [G] Microgravity cephalad fluid redistribution and altered hemodynamics.',
        spaceHazardVi:
          'Mối nguy NASA: [G] Tái phân bố dịch thể lên vùng đầu trong vi trọng lực và xáo trộn huyết động.',
        trendDetected: streak !== null,
        trendDescriptionEn: streakTextEn,
        trendDescriptionVi: streakTextVi,
      }

    case 'spo2':
      return {
        summaryEn:
          status === 'NOMINAL'
            ? `Alveolar oxygen saturation (${current}%) is optimal under 101.3 kPa cabin pressure.`
            : `SpO2 has dipped to ${current}%, indicating potential localized air stagnation or shallow breathing.`,
        summaryVi:
          status === 'NOMINAL'
            ? `Độ bão hòa oxy SpO2 (${current}%) đạt mức tối ưu ở áp suất khoang chuẩn 101.3 kPa.`
            : `SpO2 giảm xuống ${current}%, cảnh báo nguy cơ túi khí CO2 tích tụ cục bộ hoặc giảm thông khí.`,
        mechanismEn:
          'Without natural thermal convection in zero-G, exhaled CO2 can accumulate around crew quarters, causing acute hypercapnia and reduced oxygenation.',
        mechanismVi:
          'Do thiếu đối lưu nhiệt tự nhiên trong 0G, khí CO2 thở ra có thể đọng lại quanh khoang ngủ, gây thừa CO2 cục bộ và giảm oxy máu.',
        spaceHazardEn:
          'NASA Hazard: [H] Hostile / Closed spacecraft cabin environment & ECLSS airflow.',
        spaceHazardVi:
          'Mối nguy NASA: [H] Môi trường sống khép kín của tàu vũ trụ và luồng khí quạt thông gió.',
        trendDetected: streak !== null,
        trendDescriptionEn: streakTextEn,
        trendDescriptionVi: streakTextVi,
      }

    case 'sleep':
    default:
      return {
        summaryEn:
          status === 'NOMINAL'
            ? `Sleep duration (${current}h) meets NASA recommendation (>= 7.0h for operational safety).`
            : `Sleep duration is truncated at ${current}h/night (cumulative sleep debt vs 7.5h target).`,
        summaryVi:
          status === 'NOMINAL'
            ? `Thời lượng ngủ (${current}h) đạt khuyến nghị của NASA (>= 7.0h để duy trì an toàn vận hành).`
            : `Thời lượng ngủ bị rút ngắn còn ${current}h/đêm (thiếu ngủ tích lũy so với mục tiêu 7.5h).`,
        mechanismEn:
          '90-minute orbital sunrise/sunset cycles, station ambient noise (55-65 dB), and microgravity back pain disrupt slow-wave sleep and REM phases.',
        mechanismVi:
          'Chu kỳ mặt trời mọc/lặn mỗi 90 phút trên quỹ đạo, tiếng ồn thông gió (55-65 dB) và cảm giác căng cột sống làm gián đoạn giấc ngủ sâu.',
        spaceHazardEn:
          'NASA Hazard: [I] Isolation & Circadian rhythm desynchronization under artificial lighting.',
        spaceHazardVi:
          'Mối nguy NASA: [I] Cô lập & Lệch nhịp sinh học dưới hệ thống chiếu sáng nhân tạo.',
        trendDetected: streak !== null,
        trendDescriptionEn: streakTextEn,
        trendDescriptionVi: streakTextVi,
      }
  }
}

/**
 * Xây dựng nội dung Hành động khuyến nghị (Action)
 */
function buildActionContent(
  metricId: AnalyticsMetricId,
  status: AnalyticsStatus,
  current: number,
  unit: string,
) {
  if (status === 'NOMINAL') {
    return {
      urgencyLevelEn: 'Routine Operational Protocol',
      urgencyLevelVi: 'Duy trì Quy trình Vận hành Định kỳ',
      stepsEn: [
        'Maintain scheduled 2.5h daily exercise routine on ARED and CEVIS.',
        'Continue regular morning biometrics logging in Monitoring module.',
        'No medical intervention or timeline modification required.',
      ],
      stepsVi: [
        'Duy trì bài tập thể lực 2.5 giờ mỗi ngày trên máy ARED và xe đạp CEVIS.',
        'Tiếp tục đo sinh trắc học định kỳ mỗi sáng trong module Monitoring.',
        'Không yêu cầu can thiệp y tế hoặc điều chỉnh lịch trình công tác.',
      ],
      targetModule: 'monitoring' as const,
      targetMetricId: metricId as VitalId,
      ctaLabelEn: 'Log Next Scheduled Check-in',
      ctaLabelVi: 'Ghi nhận Số đo Định kỳ Tiếp theo',
    }
  }

  if (status === 'MONITORING') {
    return {
      urgencyLevelEn: 'Self-Care Protocol & Crew Vigilance',
      urgencyLevelVi: 'Kích hoạt Phác đồ Tự chăm sóc & Theo dõi Sát',
      stepsEn: [
        `Re-measure ${metricId.toUpperCase()} after 15 minutes of seated rest restraint.`,
        metricId === 'hrv' || metricId === 'sleep'
          ? 'Execute 15-minute vagal breathing protocol before sleep block; shift cabin spectrum to 480nm-depleted.'
          : metricId === 'bp'
            ? 'Cap CEVIS cycle ergometer at Zone 2 aerobic recovery (<130 BPM); avoid high-load Valsalva maneuvers.'
            : 'Check crew quarters ventilation fan flow; ensure sleep station air loop is unobstructed.',
        'Log subjective symptoms (headache, eye strain, palpitations) in daily report.',
        'If adverse trend persists for 24 additional hours, report to Flight Surgeon during evening DPC.',
      ],
      stepsVi: [
        `Đo lại chỉ số sau 15 phút nghỉ tĩnh cố định cơ thể.`,
        metricId === 'hrv' || metricId === 'sleep'
          ? 'Thực hiện 15 phút bài tập thở kích thích dây phế vị trước giờ ngủ; giảm ánh sáng xanh 480nm.'
          : metricId === 'bp'
            ? 'Giới hạn đạp xe CEVIS ở ngưỡng Zone 2 phục hồi (<130 BPM); tránh nín thở rặn tạ nặng.'
            : 'Kiểm tra quạt thông gió khoang ngủ; đảm bảo luồng không khí lưu thông không bị cản trở.',
        'Ghi nhận các triệu chứng chủ quan (đau đầu, tức mắt, hồi hộp) vào nhật ký theo dõi.',
        'Nếu xu hướng bất lợi tiếp tục kéo dài sau 24 giờ, báo cáo Bác sĩ Vũ trụ trong phiên DPC tối.',
      ],
      targetModule: 'monitoring' as const,
      targetMetricId: metricId as VitalId,
      ctaLabelEn: 'Re-measure in Monitoring Module',
      ctaLabelVi: 'Đo kiểm tra lại trong Monitoring',
    }
  }

  // MEDICAL_ATTENTION
  return {
    urgencyLevelEn: 'Priority Medical Escalation Protocol',
    urgencyLevelVi: 'Kích hoạt Kênh Hội chẩn Y tế Ưu tiên',
    stepsEn: [
      `Immediate cessation of strenuous physical countermeasure (ARED/CEVIS).`,
      'Initiate secure voice link to Ground Flight Surgeon (Flight Surgeon Loop 1).',
      'Transmit 10-minute continuous telemetry snapshot and recent measurement history.',
      'Crew Medical Officer (CMO) verify backup blood pressure cuff and pulse oximeter.',
    ],
    stepsVi: [
      'Ngừng ngay lập tức các bài tập thể lực nặng trên máy ARED/CEVIS.',
      'Mở kênh liên lạc ưu tiên tới Bác sĩ Phẫu thuật Chuyến bay (Flight Surgeon Loop 1).',
      'Truyền ngay gói telemetry 10 phút gần nhất và lịch sử đo lường về Trung tâm Kiểm soát Bay.',
      'Sĩ quan Y tế Kíp bay (CMO) chuẩn bị máy đo kiểm chứng độc lập.',
    ],
    targetModule: 'ai' as const,
    ctaLabelEn: 'Initiate Flight Surgeon Consultation',
    ctaLabelVi: 'Mở Kênh Hội chẩn Bác sĩ Vũ trụ',
  }
}
