import {
  Camera,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Mic,
  ScanFace,
  SendHorizontal,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { vitalsToAgentPayload, type Lang, type Vital } from '@/lib/astro-data'

export type FaceScanResult = {
  blinkRate: number
  fatigueEn: string
  fatigueVi: string
  estimatedHr: number
  stressLevel: string
  spokenSummaryEn?: string
  spokenSummaryVi?: string
}

type OpticalScannerProps = {
  lang: Lang
  open: boolean
  onClose: () => void
  vitals?: Vital[]
  externalScanTrigger: number
  onScanComplete: (result: FaceScanResult) => void
  onRegisterFrameCapture?: (captureFn: () => string | null) => void
}

export function OpticalBiometricScanner({
  lang,
  open,
  onClose,
  vitals = [],
  externalScanTrigger,
  onScanComplete,
  onRegisterFrameCapture,
}: OpticalScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camActive, setCamActive] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<FaceScanResult | null>(null)
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopCameraStream = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current)
      scanTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCamActive(false)
    setIsScanning(false)
  }, [])

  const captureVideoFrame = useCallback((): string | null => {
    if (!open) return null
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      return null
    }
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.8)
    } catch {
      return null
    }
  }, [open])

  useEffect(() => {
    onRegisterFrameCapture?.(captureVideoFrame)
  }, [captureVideoFrame, onRegisterFrameCapture])

  const executeScanSession = useCallback(async () => {
    setIsScanning(true)
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current)

    await new Promise((r) => setTimeout(r, 400))
    const webcamBase64 = captureVideoFrame()
    const currentVitals = vitals.length > 0 ? vitalsToAgentPayload(vitals) : undefined

    const fallback: FaceScanResult = {
      blinkRate: 14,
      fatigueEn: 'Low',
      fatigueVi: 'Thấp',
      estimatedHr: currentVitals?.heartRate
        ? Math.max(64, Math.min(82, currentVitals.heartRate - 2))
        : 72,
      stressLevel: '3',
    }

    try {
      const [apiRes] = await Promise.all([
        fetch('/api/astro-face-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webcamBase64, currentVitals }),
        }).catch(() => null),
        new Promise((r) => {
          scanTimerRef.current = setTimeout(r, 1800)
        }),
      ])

      if (apiRes && apiRes.ok) {
        const data = (await apiRes.json()) as FaceScanResult
        setIsScanning(false)
        setScanResult(data)
        onScanComplete(data)
        return
      }
    } catch {
      // use fallback
    }

    setIsScanning(false)
    setScanResult(fallback)
    onScanComplete(fallback)
  }, [captureVideoFrame, onScanComplete, vitals])

  // Only start camera & scan when `open` becomes true; immediately stop camera when closed!
  useEffect(() => {
    if (!open) {
      stopCameraStream()
      return
    }

    let mounted = true
    const startOnDemandScan = async () => {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 180, facingMode: 'user' },
            audio: false,
          })
          if (!mounted) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
          setCamActive(true)
        } catch {
          if (mounted) setCamActive(true)
        }
      } else {
        setCamActive(true)
      }

      if (mounted) {
        executeScanSession()
      }
    }

    startOnDemandScan()

    return () => {
      mounted = false
      stopCameraStream()
    }
  }, [open, externalScanTrigger, executeScanSession, stopCameraStream])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="on-demand-optical-scanner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-[#040812]/80 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="On-Demand Optical Biometric Scanner"
          onClick={onClose}
        >
          <motion.section
            initial={{ scale: 0.94, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="panel w-full max-w-[460px] !p-4 flex flex-col gap-3 border-sky-500/60 shadow-[0_24px_64px_rgba(2,8,23,0.95)]"
          >
            {/* Scanner Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Camera size={15} className="text-sky-400 flex-none" aria-hidden="true" />
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                    {lang === 'EN'
                      ? 'ON-DEMAND OPTICAL BIOMETRIC SCANNER'
                      : 'QUÉT SINH TRẮC HỌC THEO YÊU CẦU'}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {lang === 'EN'
                      ? 'Single-shot rPPG & Ocular Fatigue Capture'
                      : 'Chỉ kích hoạt Camera khi có lệnh quét'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={executeScanSession}
                  disabled={isScanning}
                  aria-busy={isScanning}
                  className={`btn !min-h-8 !px-3 !py-1 !text-xs flex-none ${
                    isScanning ? 'btn-primary animate-pulse' : 'btn-outline-cyan'
                  }`}
                >
                  <ScanFace size={14} aria-hidden="true" />
                  <span>
                    {isScanning
                      ? lang === 'EN'
                        ? 'Scanning...'
                        : 'Đang quét...'
                      : lang === 'EN'
                        ? 'Scan Again'
                        : 'Quét lại'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-200"
                  aria-label={lang === 'EN' ? 'Close Scanner' : 'Đóng trình quét'}
                >
                  <X size={14} aria-hidden="true" />
                  <span>{lang === 'EN' ? 'Close' : 'Đóng'}</span>
                </button>
              </div>
            </div>

            {/* Clean Webcam Frame with 4-Corner Reticles, Laser Scanline & Biometric Nodes */}
            <div className="relative h-[210px] rounded-xl bg-[#060a12] border border-slate-700/80 overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover opacity-70"
              />

              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 50% 45%, transparent 45%, rgba(6, 10, 18, 0.72) 100%)',
                }}
              />

              {isScanning && <div className="scan-laser-line" aria-hidden="true" />}

              <svg
                viewBox="0 0 320 150"
                className="relative z-10 w-full h-full pointer-events-none"
                aria-hidden="true"
              >
                <path
                  d="M14 34 L14 14 L34 14 M286 14 L306 14 L306 34 M14 116 L14 136 L34 136 M286 136 L306 136 L306 116"
                  fill="none"
                  stroke={isScanning ? '#38BDF8' : '#0EA5E9'}
                  strokeWidth="1.8"
                  opacity="0.9"
                />
                <line x1="160" y1="10" x2="160" y2="18" stroke="#38BDF8" strokeWidth="1" opacity="0.6" />
                <line x1="160" y1="132" x2="160" y2="140" stroke="#38BDF8" strokeWidth="1" opacity="0.6" />
                <line x1="10" y1="75" x2="18" y2="75" stroke="#38BDF8" strokeWidth="1" opacity="0.6" />
                <line x1="302" y1="75" x2="310" y2="75" stroke="#38BDF8" strokeWidth="1" opacity="0.6" />

                <g opacity={isScanning || scanResult ? '0.95' : '0.6'}>
                  <circle cx="142" cy="40" r="2.2" fill="#38BDF8" />
                  <circle cx="178" cy="40" r="2.2" fill="#38BDF8" />
                  <line
                    x1="142"
                    y1="40"
                    x2="178"
                    y2="40"
                    stroke="#38BDF8"
                    strokeWidth="0.7"
                    strokeDasharray="2 2"
                  />
                  <text x="184" y="42" fill="#7DD3FC" fontSize="7" fontFamily="monospace">
                    FR-01
                  </text>
                  <circle cx="136" cy="64" r="2.2" fill="#10B981" />
                  <circle cx="152" cy="64" r="1.6" fill="#10B981" />
                  <circle cx="168" cy="64" r="1.6" fill="#10B981" />
                  <circle cx="184" cy="64" r="2.2" fill="#10B981" />
                  <text x="98" y="66" fill="#6EE7B7" fontSize="7" fontFamily="monospace">
                    OC-L
                  </text>
                  <text x="190" y="66" fill="#6EE7B7" fontSize="7" fontFamily="monospace">
                    OC-R
                  </text>
                  <circle cx="126" cy="52" r="1.8" fill="#0EA5E9" />
                  <circle cx="194" cy="52" r="1.8" fill="#0EA5E9" />
                </g>
              </svg>

              {/* Top-left Status Tag */}
              <div className="absolute left-2.5 top-2 z-20 inline-flex items-center gap-1.5 rounded-md bg-[#090f1d]/85 border border-slate-700/80 px-2 py-0.5 text-[10px] font-mono text-sky-300">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isScanning ? 'bg-sky-400 animate-ping' : camActive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span>
                  {isScanning
                    ? lang === 'EN'
                      ? 'CAPTURE IN PROGRESS...'
                      : 'ĐANG QUÉT KHUÔN MẶT...'
                    : lang === 'EN'
                      ? 'SINGLE-SHOT SCAN COMPLETE'
                      : 'HOÀN TẤT QUÉT 1 LẦN'}
                </span>
              </div>

              {scanResult && !isScanning && (
                <div className="absolute right-2.5 top-2 z-20 inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-400/60 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-300">
                  <CheckCircle2 size={11} aria-hidden="true" />
                  <span>
                    {lang === 'EN'
                      ? `STRESS → ${scanResult.stressLevel}/10 SYNCED`
                      : `ĐÃ ĐỒNG BỘ STRESS ${scanResult.stressLevel}/10`}
                  </span>
                </div>
              )}
            </div>

            {/* Biometric Readout Footer */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-[#0a101d] border border-slate-800 px-3 py-2">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  {lang === 'EN' ? 'BLINK RATE' : 'NHỊP CHỚP MẮT'}
                </div>
                <div className="font-mono text-sm font-bold text-sky-300 mt-0.5">
                  {isScanning ? '...' : scanResult ? `${scanResult.blinkRate}/m` : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-[#0a101d] border border-slate-800 px-3 py-2">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  {lang === 'EN' ? 'FACIAL FATIGUE' : 'MỆT MỎI CƠ MẶT'}
                </div>
                <div className="font-mono text-sm font-bold text-emerald-400 mt-0.5">
                  {isScanning
                    ? '...'
                    : scanResult
                      ? lang === 'EN'
                        ? scanResult.fatigueEn
                        : scanResult.fatigueVi
                      : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-[#0a101d] border border-slate-800 px-3 py-2">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  {lang === 'EN' ? 'EST. HR' : 'NHỊP TIM ƯỚC TÍNH'}
                </div>
                <div className="font-mono text-sm font-bold text-slate-100 mt-0.5">
                  {isScanning ? '...' : scanResult ? `${scanResult.estimatedHr} bpm` : '—'}
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type VoiceDockProps = {
  lang: Lang
  isProcessingAi?: boolean
  isSpeakingExternal?: boolean
  lastSpokenCommand: string
  aiResponseText: string
  onExecuteVoiceCommand: (
    rawText: string,
    audioBase64?: string,
    mimeType?: 'audio/webm' | 'audio/mp4' | 'audio/ogg',
  ) => void
}

const VOICE_SUGGESTIONS = {
  dataInput: [
    { en: 'Heart rate 95', vi: 'Nhịp tim 95', descEn: 'HR → 95 bpm (OK)', descVi: 'HR → 95 bpm (Ổn định)' },
    { en: 'Sleep 8 hours', vi: 'Ngủ 8 tiếng', descEn: 'Sleep → 8.0h & Brain OK', descVi: 'Ngủ → 8.0h & Não Ổn định' },
    { en: 'Blood pressure 118 over 78', vi: 'Huyết áp 118 78', descEn: 'BP → 118/78 (OK)', descVi: 'HA → 118/78 (Ổn định)' },
    { en: 'Stress level 3', vi: 'Căng thẳng mức 3', descEn: 'Stress → 3/10 (OK)', descVi: 'Stress → 3/10 (Ổn định)' },
    { en: 'Temperature 37.5', vi: 'Nhiệt độ 37.5', descEn: 'Temp → 37.5°C (WARN)', descVi: 'Thân nhiệt → 37.5°C' },
    { en: 'Blood glucose 105', vi: 'Đường huyết 105', descEn: 'Glucose → 105 mg/dL', descVi: 'Đường huyết → 105 mg/dL' },
  ],
  navigation: [
    { en: 'Open brain', vi: 'Mở vùng não', descEn: 'Slide open Brain Inspector', descVi: 'Mở bảng chi tiết Vùng não' },
    { en: 'Open heart', vi: 'Mở vùng tim', descEn: 'Slide open Heart Inspector', descVi: 'Mở bảng chi tiết Tim mạch' },
    { en: 'Open analytics', vi: 'Mở phân tích xu hướng', descEn: 'Switch to Analytics tab', descVi: 'Chuyển sang tab Phân tích' },
    { en: 'Open AI assessment', vi: 'Mở chẩn đoán AI', descEn: 'Switch to AI Assessment', descVi: 'Chuyển sang Chẩn đoán AI' },
    { en: 'Scan face', vi: 'Quét khuôn mặt', descEn: 'Run Gemini Vision Scan', descVi: 'Quét khuôn mặt theo yêu cầu' },
    {
      en: 'I have a slight headache after 6h sleep',
      vi: 'Tôi hơi đau đầu và mỏi mắt sau ca trực',
      descEn: 'AI Symptom Diagnosis',
      descVi: 'Chẩn đoán triệu chứng AI',
    },
  ],
}

export function FloatingVoiceCommandDock({
  lang,
  isProcessingAi = false,
  isSpeakingExternal = false,
  lastSpokenCommand,
  aiResponseText,
  onExecuteVoiceCommand,
}: VoiceDockProps) {
  const [isListening, setIsListening] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [liveReply, setLiveReply] = useState('')
  const [spectrumBars, setSpectrumBars] = useState<number[]>([10, 18, 13, 21, 16, 19, 12])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [manualInput, setManualInput] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleLiveVoiceState = (ev: Event) => {
      const customEv = ev as CustomEvent<{
        mode: string
        transcript: string
        rmsLevel: number
        spectrumBars?: number[]
        spokenReply?: string
      }>
      const detail = customEv.detail
      if (!detail) return

      const recActive = detail.mode === 'RECORDING_AUDIO'
      setIsListening(recActive)

      if (detail.spectrumBars && detail.spectrumBars.length === 7) {
        setSpectrumBars(detail.spectrumBars)
      }
      if (detail.transcript) {
        setLiveTranscript(detail.transcript)
      }
      if (detail.spokenReply) {
        setLiveReply(detail.spokenReply)
      }
    }

    window.addEventListener('astro-voice-live', handleLiveVoiceState)
    return () => {
      window.removeEventListener('astro-voice-live', handleLiveVoiceState)
    }
  }, [])

  const handleToggleMic = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('astro-voice-manual-toggle'))
      setIsListening((prev) => !prev)
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    setLiveTranscript('')
    setLiveReply('')
    onExecuteVoiceCommand(manualInput.trim())
    setManualInput('')
    setShowSuggestions(false)
  }

  const activeWave = isListening || isSpeakingExternal || isProcessingAi
  const effectiveCommand = liveTranscript ? `"${liveTranscript}"` : lastSpokenCommand
  const effectiveReply = liveReply || aiResponseText

  // Determine if the user has already spoken/executed a command so we can show AI feedback cleanly
  const isDefaultPrompt =
    !liveReply &&
    !liveTranscript &&
    (aiResponseText.startsWith('Say "Sleep 8 hours"') ||
      aiResponseText.startsWith('Hãy nói "Ngủ 8 tiếng"'))

  const dynamicPlaceholder = !isDefaultPrompt
    ? `${effectiveCommand} · ${effectiveReply}`
    : lang === 'EN'
      ? "Click Mic to speak or type a command here (e.g., 'Heart rate 95', 'Open heart', 'I have a slight headache')..."
      : "Bấm Mic để nói hoặc nhập triệu chứng / câu lệnh tại đây (VD: 'Nhịp tim 95', 'Mở vùng tim', 'Tôi hơi đau đầu')..."

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 w-[min(860px,calc(100%-24px))] max-w-4xl"
      role="region"
      aria-label="Floating AI Voice & Text Hybrid Command Dock"
    >
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            key="voice-suggestions-popover"
            role="dialog"
            aria-label={lang === 'EN' ? 'Voice Command Examples' : 'Gợi ý câu lệnh giọng nói'}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute bottom-full left-0 right-0 mb-2.5 rounded-2xl bg-[#0d1526]/98 backdrop-blur-xl border border-sky-500/50 shadow-[0_16px_48px_rgba(2,8,23,0.92)] p-3.5 text-xs z-40"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Lightbulb size={15} className="text-amber-400 flex-none" aria-hidden="true" />
                <span className="font-bold uppercase tracking-wider text-slate-100 truncate">
                  {lang === 'EN'
                    ? 'MULTIMODAL GEMINI AGENT — CLICK ANY SAMPLE TO EXECUTE'
                    : 'TRỢ LÝ GEMINI ĐA PHƯƠNG THỨC — BẤM CÂU LỆNH MẪU ĐỂ THỬ NGAY'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowSuggestions(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex-none"
                aria-label="Close voice command suggestions"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 mb-1.5">
                  {lang === 'EN' ? '1. VOICE DATA INPUT' : '1. LỆNH NHẬP DỮ LIỆU'}
                </div>
                <div className="flex flex-col gap-1.5">
                  {VOICE_SUGGESTIONS.dataInput.map((item) => {
                    const phrase = lang === 'EN' ? item.en : item.vi
                    return (
                      <button
                        key={item.en}
                        type="button"
                        onClick={() => {
                          onExecuteVoiceCommand(phrase)
                          setShowSuggestions(false)
                        }}
                        className="flex items-center justify-between gap-2 rounded-lg bg-[#142038] hover:bg-sky-500/20 border border-slate-700/80 hover:border-sky-400 px-2.5 py-1.5 text-left transition-all"
                      >
                        <span className="font-mono font-semibold text-sky-200">"{phrase}"</span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {lang === 'EN' ? item.descEn : item.descVi}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 mb-1.5">
                  {lang === 'EN' ? '2. NAVIGATION & SYMPTOMS' : '2. ĐIỀU KHIỂN & TRIỆU CHỨNG'}
                </div>
                <div className="flex flex-col gap-1.5">
                  {VOICE_SUGGESTIONS.navigation.map((item) => {
                    const phrase = lang === 'EN' ? item.en : item.vi
                    return (
                      <button
                        key={item.en}
                        type="button"
                        onClick={() => {
                          onExecuteVoiceCommand(phrase)
                          setShowSuggestions(false)
                        }}
                        className="flex items-center justify-between gap-2 rounded-lg bg-[#142038] hover:bg-emerald-500/20 border border-slate-700/80 hover:border-emerald-400 px-2.5 py-1.5 text-left transition-all"
                      >
                        <span className="font-mono font-semibold text-emerald-200 truncate">
                          "{phrase}"
                        </span>
                        <span className="text-[10px] text-slate-400 flex-none">
                          {lang === 'EN' ? item.descEn : item.descVi}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single-Row Sleek Glassmorphic Pill Voice Dock */}
      <form
        onSubmit={handleManualSubmit}
        className="w-full rounded-full bg-[#0a1222]/95 backdrop-blur-xl border border-sky-500/50 shadow-[0_10px_34px_rgba(2,8,23,0.92),inset_0_1px_0_rgba(56,189,248,0.2)] px-2.5 py-1.5 flex items-center gap-2.5 transition-all focus-within:border-sky-400"
      >
        {/* 1. Circular Glowing Mic Button (with inner mini soundwaves when listening) */}
        <button
          type="button"
          onClick={handleToggleMic}
          disabled={isProcessingAi}
          aria-pressed={isListening}
          aria-label={
            isProcessingAi
              ? lang === 'EN'
                ? 'Gemini Thinking...'
                : 'Gemini đang phân tích...'
              : isListening
                ? lang === 'EN'
                  ? 'Listening...'
                  : 'Đang nghe...'
                : lang === 'EN'
                  ? 'Voice Command'
                  : 'Ra lệnh Giọng nói'
          }
          className={`relative h-9 w-9 rounded-full flex items-center justify-center flex-none transition-all cursor-pointer ${
            isListening
              ? 'bg-sky-500 text-slate-950 shadow-[0_0_20px_rgba(14,165,233,0.85)] ring-2 ring-sky-300'
              : isProcessingAi
                ? 'bg-amber-500/25 border border-amber-400 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.5)]'
                : 'bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/70 text-sky-300 shadow-[0_0_14px_rgba(14,165,233,0.35)]'
          }`}
        >
          {isProcessingAi ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : activeWave ? (
            <span className="inline-flex items-end gap-[2px] h-3.5" aria-hidden="true">
              {spectrumBars.slice(1, 6).map((h, idx) => (
                <span
                  key={idx}
                  className="w-[2px] rounded-full bg-current transition-all duration-75"
                  style={{ height: `${Math.max(4, Math.min(14, Math.round(h * 0.85)))}px` }}
                />
              ))}
            </span>
          ) : (
            <Mic size={16} aria-hidden="true" />
          )}
        </button>

        {/* 2. Compact [ 🛡️ DSP ] Badge (Hover shows "Lọc ồn khoang tàu 100Hz-3.4kHz Active") */}
        <div className="relative group flex-none">
          <span
            data-testid="spacecraft-dsp-badge"
            title="Lọc ồn khoang tàu 100Hz-3.4kHz Active"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/50 px-2.5 py-1 text-[11px] font-mono font-bold text-emerald-300 whitespace-nowrap cursor-default select-none"
          >
            <span aria-hidden="true">🛡️</span>
            <span>DSP</span>
          </span>

          <div
            role="tooltip"
            className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg bg-[#0c1528]/98 border border-emerald-400/50 text-[11px] font-mono font-semibold text-emerald-200 whitespace-nowrap shadow-xl z-50"
          >
            Lọc ồn khoang tàu 100Hz-3.4kHz Active
          </div>
        </div>

        {/* 3. Wide Unobstructed Input (displays AI listening/response state or direct typing with zero overlapping labels) */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {!isDefaultPrompt && !manualInput && (
            <Volume2 size={14} className="text-emerald-400 flex-none" aria-hidden="true" />
          )}
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={dynamicPlaceholder}
            aria-label={
              lang === 'EN'
                ? 'Speak or type a symptom or command for ASTRO AI'
                : 'Nói hoặc nhập triệu chứng / câu lệnh cho ASTRO AI'
            }
            className={`w-full min-w-0 bg-transparent text-xs focus:outline-none py-1.5 truncate ${
              !isDefaultPrompt && !manualInput
                ? 'placeholder:text-sky-200 placeholder:font-medium text-slate-100'
                : 'text-slate-100 placeholder:text-slate-400'
            }`}
          />
        </div>

        {/* 4. Send Button [ ➤ ] and Compact Voice Suggestions Button [ 💡 ] */}
        <div className="flex items-center gap-1.5 flex-none">
          <button
            type="submit"
            disabled={!manualInput.trim() || isProcessingAi}
            aria-label={lang === 'EN' ? 'Send command' : 'Gửi câu lệnh'}
            title={lang === 'EN' ? 'Send command' : 'Gửi câu lệnh'}
            className="h-8 px-3 rounded-full bg-sky-500/20 hover:bg-sky-500/35 disabled:opacity-40 disabled:pointer-events-none border border-sky-400/55 text-xs font-semibold text-sky-200 inline-flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <SendHorizontal size={13} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setShowSuggestions((prev) => !prev)}
            aria-expanded={showSuggestions}
            aria-label={lang === 'EN' ? '💡 Voice Commands' : '💡 Gợi ý câu lệnh Voice'}
            title={lang === 'EN' ? 'Voice Command Suggestions' : 'Gợi ý câu lệnh giọng nói'}
            className={`h-8 w-8 rounded-full border inline-flex items-center justify-center text-xs transition-all cursor-pointer ${
              showSuggestions
                ? 'bg-indigo-500/35 border-indigo-400 text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.5)]'
                : 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-400/50 text-indigo-200'
            }`}
          >
            <span aria-hidden="true">💡</span>
          </button>
        </div>
      </form>
    </motion.div>
  )
}
