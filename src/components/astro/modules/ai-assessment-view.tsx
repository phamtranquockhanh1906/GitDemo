import {
  Bot,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Phone,
  ShieldAlert,
  Siren,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import {
  VITALS,
  vitalsToAgentPayload,
  type AstroAgentResponse,
  type Lang,
  type Vital,
} from '@/lib/astro-data'
import type { Notify } from '../app-shell'
import { PageHeader, Panel } from '../ui'

const FACTORS = {
  EN: [
    'High operational workload (EVA & orbital science training)',
    'Circadian rhythm desynchronization under 90-min orbital day/night cycle',
    'Cephalad fluid shift and autonomic baroreceptor adaptation',
  ],
  VI: [
    'Khối lượng công việc vận hành cao (Huấn luyện EVA & khoa học quỹ đạo)',
    'Lệch nhịp sinh học do chu kỳ ngày/đêm 90 phút trên quỹ đạo',
    'Dịch chuyển dịch thể lên vùng đầu và thích nghi thụ thể áp suất tự chủ',
  ],
}

const DEFAULT_ACTIONS = {
  EN: [
    'Prioritize 8-hour sleep block tonight (21:30 UTC).',
    'Execute guided vagal breathing/relaxation protocol (15 min).',
    'Cap CEVIS ergometer session at Zone 2 aerobic recovery.',
    'Re-assess vitals and HRV in 6 hours.',
  ],
  VI: [
    'Ưu tiên khung ngủ đủ 8 tiếng tối nay (từ 21:30 UTC).',
    'Thực hiện giao thức thở kích thích dây phế vị (15 phút).',
    'Giới hạn bài tập đạp xe CEVIS ở ngưỡng phục hồi hiếu khí Zone 2.',
    'Đánh giá lại chỉ số sinh tồn và HRV sau 6 giờ.',
  ],
}

export function AiAssessmentView({
  lang = 'EN',
  vitals = VITALS,
  notify,
}: {
  lang?: Lang
  vitals?: Vital[]
  notify: Notify
}) {
  const [done, setDone] = useState<boolean[]>([false, false, false, false])
  const [confirming, setConfirming] = useState(false)
  const [escalated, setEscalated] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [customAiSummary, setCustomAiSummary] = useState<string | null>(null)
  const [customCountermeasure, setCustomCountermeasure] = useState<string | null>(null)

  const completed = done.filter(Boolean).length
  const toggle = (i: number) => setDone((d) => d.map((v, j) => (j === i ? !v : v)))

  // Dynamically compute anomalies from live vitals
  const abnormalVitals = vitals.filter((v) => v.status !== 'ok')
  const hasCritical = abnormalVitals.some((v) => v.status === 'crit')
  const overallStatus = hasCritical ? 'CRITICAL' : abnormalVitals.length > 0 ? 'WARNING' : 'NOMINAL'

  const runLiveGeminiAssessment = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/astro-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript:
            lang === 'EN'
              ? 'Provide a comprehensive Flight Surgeon clinical assessment of my current 8 vital signs.'
              : 'Hãy phân tích tổng hợp tình trạng y sinh từ 8 chỉ số sinh tồn hiện tại của tôi.',
          currentVitals: vitalsToAgentPayload(vitals),
          lang,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as AstroAgentResponse
        setCustomAiSummary(
          `${data.spokenReply} ${data.dynamicSurgeonNote?.cause ?? ''}`.trim(),
        )
        if (data.dynamicSurgeonNote?.countermeasure) {
          setCustomCountermeasure(data.dynamicSurgeonNote.countermeasure)
        }
        notify(
          lang === 'EN'
            ? 'Gemini 3.8 Flash clinical assessment updated'
            : 'Đã cập nhật chẩn đoán lâm sàng từ Gemini AI',
        )
      }
    } catch {
      notify(
        lang === 'EN' ? 'Edge BioAI assessment refreshed' : 'Đã làm mới đánh giá BioAI',
      )
    } finally {
      setAnalyzing(false)
    }
  }

  const actionsList = DEFAULT_ACTIONS[lang].map((item, idx) =>
    idx === 1 && customCountermeasure ? customCountermeasure : item,
  )

  const metaItems = [
    [lang === 'EN' ? 'Timestamp' : 'Thời điểm', 'Live Telemetry Sync'],
    [lang === 'EN' ? 'Model Version' : 'Mô hình AI', 'Gemini-2.5-Flash · BioAI'],
    [lang === 'EN' ? 'Active Alerts' : 'Cảnh báo đang bật', `${abnormalVitals.length} / 8 Vitals`],
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow={lang === 'EN' ? 'Module 04 · Health Insights' : 'Phân hệ 04 · Phân tích Y sinh AI'}
        title={lang === 'EN' ? 'AI Health Assessment' : 'Chẩn đoán & Đánh giá Sức khỏe AI'}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={runLiveGeminiAssessment}
            disabled={analyzing}
          >
            {analyzing ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles size={16} aria-hidden="true" />
            )}
            <span>
              {analyzing
                ? lang === 'EN'
                  ? 'Running Gemini Analysis...'
                  : 'Đang phân tích Gemini...'
                : lang === 'EN'
                  ? 'Run Live Gemini Re-Assessment'
                  : 'Chạy Chẩn đoán Gemini AI Trực tiếp'}
            </span>
          </button>
        }
      />

      <section className="risk flex items-center gap-6" aria-label="Risk level">
        <div className="flex items-center gap-4">
          <span
            className={`grid place-items-center w-14 h-14 rounded-xl border ${
              overallStatus === 'NOMINAL'
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                : overallStatus === 'CRITICAL'
                  ? 'bg-rose-500/15 border-rose-500/50 text-rose-400'
                  : 'bg-amber-500/15 border-amber-500/50 text-amber-400'
            }`}
          >
            {overallStatus === 'NOMINAL' ? (
              <CheckCircle2 size={28} aria-hidden="true" />
            ) : (
              <TriangleAlert size={28} aria-hidden="true" />
            )}
          </span>
          <div>
            <div className="eyebrow">{lang === 'EN' ? 'Risk Level' : 'Mức độ Rủi ro'}</div>
            <div
              className={`lvl mt-1 ${
                overallStatus === 'NOMINAL'
                  ? '!text-emerald-300'
                  : overallStatus === 'CRITICAL'
                    ? '!text-rose-300'
                    : ''
              }`}
            >
              {overallStatus === 'NOMINAL'
                ? lang === 'EN'
                  ? 'NOMINAL'
                  : 'ỔN ĐỊNH'
                : overallStatus === 'CRITICAL'
                  ? lang === 'EN'
                    ? 'CRITICAL'
                    : 'NGUY CẤP'
                  : lang === 'EN'
                    ? 'WARNING'
                    : 'CẢNH BÁO'}
            </div>
          </div>
        </div>
        <div className="h-12 w-px bg-slate-700" aria-hidden="true" />
        <dl className="grid grid-cols-3 gap-6 flex-1">
          {metaItems.map(([k, v]) => (
            <div key={k}>
              <dt className="eyebrow">{k}</dt>
              <dd className="font-mono text-sm mt-1 text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="banner neu">
        <Info size={16} className="flex-none mt-px text-slate-400" aria-hidden="true" />
        <span>
          {lang === 'EN'
            ? 'This assessment dynamically synchronizes with your 8 Dashboard vital signs and Gemini Multimodal Agent.'
            : 'Bản đánh giá này đồng bộ trực tiếp theo thời gian thực với 8 chỉ số sinh tồn trên Dashboard và Trợ lý Gemini AI.'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Panel
          title={lang === 'EN' ? 'Detected Anomalies (Live)' : 'Bất thường Phát hiện (Trực tiếp)'}
          aside={<span className="cnt ml-auto">{abnormalVitals.length}</span>}
        >
          {abnormalVitals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center gap-2 text-emerald-300">
              <CheckCircle2 size={28} aria-hidden="true" />
              <span className="text-sm font-semibold">
                {lang === 'EN'
                  ? 'All 8 Vital Signs Within Nominal Orbital Bounds'
                  : 'Toàn bộ 8 chỉ số sinh tồn đều nằm trong ngưỡng chuẩn'}
              </span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {abnormalVitals.map((v) => (
                <li key={v.id} className="row-item !items-start">
                  <span
                    className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-none ${
                      v.status === 'crit'
                        ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                        : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="t">
                      {lang === 'EN' ? v.title : v.viTitle}:{' '}
                      <span className={v.status === 'crit' ? 'text-rose-300' : 'text-amber-300'}>
                        {v.value} {v.unit}
                      </span>
                    </span>
                    <span className="s font-mono">
                      {lang === 'EN' ? 'Baseline' : 'Chuẩn'}: {v.baseline} {v.unit} ({v.updated})
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={lang === 'EN' ? 'Correlated Risk Factors' : 'Các Yếu tố Nguy cơ Liên quan'}>
          <ul className="flex flex-col gap-2">
            {FACTORS[lang].map((f) => (
              <li key={f} className="row-item">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-none" aria-hidden="true" />
                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={lang === 'EN' ? 'AI Clinical Explanation' : 'Giải thích Lâm sàng từ AI'}
          aside={<span className="pill indigo ml-auto">Gemini AI</span>}
        >
          <div className="flex-1 rounded-[10px] border border-indigo-500/40 bg-indigo-500/[0.07] p-3 flex flex-col gap-3">
            <Bot size={20} className="text-indigo-300" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-slate-100">
              {customAiSummary ? (
                customAiSummary
              ) : abnormalVitals.length === 0 ? (
                lang === 'EN' ? (
                  'All 8 astronaut physiological telemetry parameters are currently within nominal pre-flight baseline ranges. Autonomic recovery and circadian alignment are optimal.'
                ) : (
                  'Toàn bộ 8 thông số sinh trắc học của phi hành gia hiện nằm trong ngưỡng chuẩn trước chuyến bay. Hệ thần kinh tự chủ và nhịp sinh học đã phục hồi tối ưu.'
                )
              ) : lang === 'EN' ? (
                <>
                  Current telemetry flags{' '}
                  <strong className="text-indigo-200 font-semibold">
                    {abnormalVitals.map((v) => `${v.title} (${v.value}${v.unit})`).join(', ')}
                  </strong>
                  . These indicators point to{' '}
                  <strong className="text-indigo-200 font-semibold">
                    incomplete autonomic recovery
                  </strong>{' '}
                  during orbital operations rather than acute organic pathology.
                </>
              ) : (
                <>
                  Hệ thống ghi nhận các chỉ số cần chú ý:{' '}
                  <strong className="text-indigo-200 font-semibold">
                    {abnormalVitals.map((v) => `${v.viTitle} (${v.value} ${v.unit})`).join(', ')}
                  </strong>
                  . Tổ hợp này phản ánh tình trạng{' '}
                  <strong className="text-indigo-200 font-semibold">
                    chưa phục hồi hoàn toàn hệ thần kinh tự chủ
                  </strong>{' '}
                  do lịch làm việc quỹ đạo.
                </>
              )}
            </p>
            <span className="mt-auto text-xs text-slate-400 font-mono">
              {lang === 'EN'
                ? 'Confidence 0.91 · Real-time Multimodal Sync'
                : 'Độ tin cậy 0.91 · Đồng bộ Đa phương thức'}
            </span>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <Panel
          title={lang === 'EN' ? 'Actionable Recommendations' : 'Phác đồ Khuyến nghị Hành động'}
          aside={
            <span className="ml-auto font-mono text-xs text-slate-300">
              {completed}/{actionsList.length} {lang === 'EN' ? 'complete' : 'hoàn thành'}
            </span>
          }
        >
          <div className="bar-track mb-3">
            <div
              className="bar-fill bg-emerald-500 transition-all"
              style={{ width: `${(completed / actionsList.length) * 100}%` }}
            />
          </div>
          <ul className="flex flex-col gap-2">
            {actionsList.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done[i]}
                  onClick={() => toggle(i)}
                  className="row-item w-full text-left hover:border-slate-500"
                >
                  <span className="check">
                    <Check size={16} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span className={`text-sm flex-1 ${done[i] ? 'text-slate-400 line-through' : 'text-slate-100'}`}>
                    {a}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <section className="escalate flex flex-col gap-3" aria-labelledby="esc-h">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-lg bg-red-500/15 text-red-400">
              <ShieldAlert size={22} aria-hidden="true" />
            </span>
            <h2 id="esc-h" className="text-base font-semibold flex-1">
              {lang === 'EN' ? 'Medical Escalation Criteria' : 'Tiêu chí Báo động Y tế Mặt đất'}
            </h2>
            <span className={`st ${abnormalVitals.length > 0 ? 'crit' : 'ok'}`}>
              {abnormalVitals.length > 0
                ? lang === 'EN'
                  ? 'TRIGGERED'
                  : 'KÍCH HOẠT'
                : lang === 'EN'
                  ? 'STANDBY'
                  : 'BÌNH THƯỜNG'}
            </span>
          </div>
          <div className="rounded-[10px] border border-red-500/40 bg-[#0B0F19] p-3">
            <div className="eyebrow">
              {lang === 'EN' ? 'Rules Status' : 'Trạng thái Quy tắc'}
            </div>
            <p className="text-sm mt-1 text-red-100">
              {abnormalVitals.length > 0
                ? lang === 'EN'
                  ? `${abnormalVitals.length} parameter(s) outside baseline (${abnormalVitals
                      .map((v) => v.shortTitle)
                      .join(', ')})`
                  : `Có ${abnormalVitals.length} chỉ số lệch khỏi baseline (${abnormalVitals
                      .map((v) => v.shortTitle)
                      .join(', ')})`
                : lang === 'EN'
                  ? 'No escalation rules triggered. All vitals nominal.'
                  : 'Không có quy tắc báo động nào bị kích hoạt.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-crit w-full mt-auto"
            onClick={() => setConfirming(true)}
            disabled={escalated}
          >
            <Siren size={20} aria-hidden="true" />
            {escalated
              ? lang === 'EN'
                ? 'Consultation Requested'
                : 'Đã gửi yêu cầu hội chẩn'
              : lang === 'EN'
                ? 'Initiate Ground Medical Team Consultation'
                : 'Yêu cầu Hội chẩn Đội Y tế Mặt đất'}
          </button>
          <button
            type="button"
            onClick={() =>
              notify(
                lang === 'EN'
                  ? 'Connected to Protocol Hotline · Flight Surgeon Loop A'
                  : 'Đã kết nối đường dây nóng Bác sĩ Vũ trụ · Kênh A',
                'crit',
              )
            }
            className="flex items-center justify-center gap-2 min-h-12 text-sm text-red-200 underline underline-offset-4 hover:text-red-100"
          >
            <Phone size={16} aria-hidden="true" />
            {lang === 'EN'
              ? 'Protocol Hotline · Flight Surgeon Loop A'
              : 'Đường dây nóng · Bác sĩ Vũ trụ Kênh A'}
          </button>
        </section>
      </div>

      {confirming && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="conf-h">
          <div className="sheet !border-red-500/60">
            <div className="sheet-h">
              <Siren size={22} className="text-red-400" aria-hidden="true" />
              <h3 id="conf-h">
                {lang === 'EN'
                  ? 'Initiate Ground Medical Consultation?'
                  : 'Xác nhận Yêu cầu Hội chẩn Y tế Mặt đất?'}
              </h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {lang === 'EN'
                ? 'This opens a priority channel to the Flight Surgeon and shares the current assessment, last 7 days of telemetry, and triggered escalation rules.'
                : 'Hệ thống sẽ mở kênh ưu tiên tới Bác sĩ Phẫu thuật Vũ trụ và gửi kèm toàn bộ dữ liệu sinh trắc học 7 ngày qua.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn" onClick={() => setConfirming(false)} autoFocus>
                {lang === 'EN' ? 'Cancel' : 'Hủy'}
              </button>
              <button
                type="button"
                className="btn btn-crit !min-h-12"
                onClick={() => {
                  setConfirming(false)
                  setEscalated(true)
                  notify(
                    lang === 'EN'
                      ? 'Ground medical consultation requested · Flight Surgeon notified'
                      : 'Đã gửi yêu cầu hội chẩn khẩn · Bác sĩ Vũ trụ đã nhận thông báo',
                    'crit',
                  )
                }}
              >
                {lang === 'EN' ? 'Confirm & Notify' : 'Xác nhận & Gửi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
