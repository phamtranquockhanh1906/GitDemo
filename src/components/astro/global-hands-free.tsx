import {
  Compass,
  Loader2,
  Mic,
  MicOff,
  Radio,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type CurrentAppStatePayload,
  type Lang,
  type MultimodalControlResponse,
} from '@/lib/astro-data'
import {
  blobToBase64,
  computeVoiceBandEnergy,
  createSpacecraftDspAudioGraph,
  playSciFiCue,
  selectSupportedAudioMimeType,
  sendMultimodalAudioToGemini,
  type SpacecraftDspPipeline,
} from '@/lib/multimodal-audio'

export type HandsFreeMode =
  | 'VAD_STANDBY'
  | 'RECORDING_AUDIO'
  | 'GEMINI_PROCESSING'
  | 'SPEAKING'
  | 'PAUSED'

export type AstroVoiceLiveEventDetail = {
  mode: HandsFreeMode
  transcript: string
  rmsLevel: number
  ambientNoisePct: number
  speechDurationMs: number
  spectrumBars?: number[]
  spokenReply?: string
  dspActive?: boolean
}

type GlobalHandsFreeControllerProps = {
  lang: Lang
  currentAppState: CurrentAppStatePayload
  headless?: boolean
  onApplyMultimodalControl: (
    response: MultimodalControlResponse,
    speakConfirm: (text: string) => void,
  ) => void
}

type SpeechRecognitionAlternativeLike = {
  transcript: string
}

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

const SAMPLE_MULTIMODAL_COMMANDS = [
  {
    tagEn: 'Single Vital Auto-Save via Gemini',
    tagVi: 'Tự chuyển mục & Tự động Lưu qua Gemini',
    cmdEn: 'Blood pressure 120 80 and switch to Body Temp',
    cmdVi: 'Huyết áp 120 80 mạch 70 và chuyển sang mục Thân nhiệt',
    descEn: 'Gemini extracts BP 120/80 · 70 → Auto-saves & jumps to Temp!',
    descVi: 'Gemini lưu HA 120/80 · 70 → Tự lưu Lịch sử & nhảy sang Thân nhiệt!',
  },
  {
    tagEn: 'Batch 6 Vitals in 1 Breath',
    tagVi: 'Đọc gộp 6 Chỉ số trong 1 câu',
    cmdEn:
      'Heart rate 72, SpO2 99, temp 36.7, glucose 92, sleep 7.5 hours, stress level 2',
    cmdVi:
      'Nhịp tim 72, SpO2 99, thân nhiệt 36.7, đường huyết 92, ngủ 7.5 tiếng, căng thẳng mức 2',
    descEn: 'Gemini extracts & auto-saves all 6 vitals to History & Body Model!',
    descVi: 'Gemini bóc tách & tự động lưu cả 6 chỉ số vào Lịch sử & Mô hình cơ thể!',
  },
]

const SAMPLE_NAV_COMMANDS = [
  { en: 'Open Dashboard', vi: 'Mở bảng điều khiển' },
  { en: 'Open Monitoring', vi: 'Mở nhập chỉ số' },
  { en: 'Open Analytics', vi: 'Mở phân tích xu hướng' },
  { en: 'Open AI Assessment', vi: 'Mở chẩn đoán AI' },
  { en: 'Open Missions', vi: 'Mở nhiệm vụ' },
  { en: 'Open Profile', vi: 'Mở hồ sơ' },
  { en: 'Switch to Blood Glucose tab', vi: 'Chuyển mục đường huyết' },
  { en: 'I have a slight headache after EVA', vi: 'Tôi hơi đau đầu sau ca đi bộ không gian' },
]

// Module 2: Smart VAD & Adaptive Noise Floor Constants
const VAD_POLL_INTERVAL_MS = 60
const MIN_VOICE_THRESHOLD = 0.016
const SILENCE_STOP_MS = 1000 // Auto-stop after 1.0s continuous silence
const MIN_SPEECH_DURATION_GATE_MS = 600 // Discard transient clicks/coughs < 600ms
const MAX_RECORD_MS = 14000

function broadcastVoiceLiveState(detail: AstroVoiceLiveEventDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<AstroVoiceLiveEventDetail>('astro-voice-live', {
      detail: {
        ...detail,
        dspActive: true,
      },
    }),
  )
}

export function GlobalHandsFreeController({
  lang,
  currentAppState,
  headless = true,
  onApplyMultimodalControl,
}: GlobalHandsFreeControllerProps) {
  const [vadEnabled, setVadEnabled] = useState(true)
  const [mode, setMode] = useState<HandsFreeMode>('VAD_STANDBY')
  const [rmsLevel, setRmsLevel] = useState(0)
  const [ambientNoisePct, setAmbientNoisePct] = useState(6)
  const [speechDurationMs, setSpeechDurationMs] = useState(0)
  const [discardedCount, setDiscardedCount] = useState(0)
  const [lastTranscript, setLastTranscript] = useState('')
  const [openConsole, setOpenConsole] = useState(false)
  const [customCmd, setCustomCmd] = useState('')
  const [micPermissionOk, setMicPermissionOk] = useState(true)

  const vadEnabledRef = useRef(vadEnabled)
  vadEnabledRef.current = vadEnabled

  const modeRef = useRef<HandsFreeMode>(mode)
  modeRef.current = mode

  const appStateRef = useRef(currentAppState)
  appStateRef.current = currentAppState

  const onApplyRef = useRef(onApplyMultimodalControl)
  onApplyRef.current = onApplyMultimodalControl

  // Module 1: 4-Layer Spacecraft Web Audio DSP Pipeline refs
  const dspPipelineRef = useRef<SpacecraftDspPipeline | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStartMsRef = useRef<number>(0)
  const lastLoudMsRef = useRef<number>(0)
  const speechDurationMsRef = useRef<number>(0)
  const ambientNoiseRef = useRef<number>(0.011)
  const consecutiveVoiceFramesRef = useRef<number>(0)
  const isManualPushToTalkRef = useRef<boolean>(false)
  const isSpeakingTtsRef = useRef(false)

  // Parallel Acoustic Stream (strictly used as raw acoustic transcript buffer alongside DSP-filtered MediaRecorder)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isRecognitionRunningRef = useRef(false)
  const processedResultIndexRef = useRef(0)
  const latestResultLengthRef = useRef(0)
  const activeTranscriptRef = useRef('')
  const silenceCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDispatchingRef = useRef(false)

  /**
   * Module 5 (Step 5): Anti-Echo TTS
   * Pauses Smart VAD before calling window.speechSynthesis.speak(),
   * and automatically resumes VAD on utterance.onend so cabin speakers are never re-recorded.
   */
  const speakWithAntiEcho = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
      setMode(vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED')
      return
    }

    isSpeakingTtsRef.current = true
    setMode('SPEAKING')
    broadcastVoiceLiveState({
      mode: 'SPEAKING',
      transcript: activeTranscriptRef.current,
      rmsLevel: 0,
      ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
      speechDurationMs: 0,
      spokenReply: text,
    })

    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      const hasViChars =
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
          text,
        )
      utterance.lang = hasViChars || appStateRef.current.lang === 'VI' ? 'vi-VN' : 'en-US'
      utterance.rate = 1.05
      utterance.pitch = 0.98

      const resumeAfterTts = () => {
        isSpeakingTtsRef.current = false
        const nextMode = vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED'
        setMode(nextMode)
        broadcastVoiceLiveState({
          mode: nextMode,
          transcript: '',
          rmsLevel: 0,
          ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
          speechDurationMs: 0,
          spokenReply: text,
        })
      }

      utterance.onend = resumeAfterTts
      utterance.onerror = resumeAfterTts
      window.speechSynthesis.speak(utterance)
      setTimeout(() => {
        if (isSpeakingTtsRef.current) {
          resumeAfterTts()
        }
      }, 4500)
    } catch {
      isSpeakingTtsRef.current = false
      setMode(vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED')
    }
  }, [])

  /**
   * Module 3, 4 & 5: Sends DSP-filtered audioBase64 (audio/webm) + currentAppState to Gemini 2.5 Flash
   * and executes the returned Section 4 JSON across all pages.
   */
  const dispatchToGeminiMultimodal = useCallback(
    async (payload: {
      audioBase64?: string | null
      mimeType?: 'audio/webm' | 'audio/mp4' | 'audio/ogg'
      textCommand?: string
      speechDurationMs?: number
    }) => {
      if (isDispatchingRef.current) return
      const cleanText = (payload.textCommand || '').trim()
      const hasAudio = Boolean(payload.audioBase64 && payload.audioBase64.length > 100)
      if (!cleanText && !hasAudio) {
        setMode(vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED')
        return
      }

      isDispatchingRef.current = true
      setMode('GEMINI_PROCESSING')
      const displayTranscript = cleanText
        ? `"${cleanText}"`
        : lang === 'EN'
          ? 'Sending DSP-filtered audio (base64) to Gemini 2.5 Flash...'
          : 'Đang gửi âm thanh đã lọc DSP (base64) lên Gemini 2.5 Flash...'
      setLastTranscript(displayTranscript)
      broadcastVoiceLiveState({
        mode: 'GEMINI_PROCESSING',
        transcript: cleanText || displayTranscript,
        rmsLevel: 0,
        ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
        speechDurationMs: payload.speechDurationMs ?? 0,
      })

      try {
        const result = await sendMultimodalAudioToGemini({
          audioBase64: payload.audioBase64,
          mimeType: payload.mimeType,
          textCommand: cleanText || undefined,
          speechDurationMs: payload.speechDurationMs,
          currentAppState: appStateRef.current,
        })

        isDispatchingRef.current = false

        // Step 1: Semantic Noise Filter (isNoiseOrUnrelated === true -> Ignore completely)
        if (result.isNoiseOrUnrelated || result.shouldIgnore) {
          setDiscardedCount((c) => c + 1)
          const nextMode = vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED'
          setMode(nextMode)
          setLastTranscript(
            lang === 'EN'
              ? '🛡️ Semantic Filter: Ignored unrelated background audio'
              : '🛡️ Lọc ngữ nghĩa AI: Đã bỏ qua tạp âm / hội thoại ngoài lề',
          )
          broadcastVoiceLiveState({
            mode: nextMode,
            transcript: '',
            rmsLevel: 0,
            ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
            speechDurationMs: 0,
          })
          return
        }

        // Step 2: Display userTranscript on the global Voice status bar
        const resolvedTranscript = result.userTranscript || result.transcript || cleanText
        if (resolvedTranscript) {
          setLastTranscript(`"${resolvedTranscript}"`)
        }

        broadcastVoiceLiveState({
          mode: 'SPEAKING',
          transcript: resolvedTranscript,
          rmsLevel: 0,
          ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
          speechDurationMs: payload.speechDurationMs ?? 0,
          spokenReply: result.spokenReply,
        })

        // Steps 3, 4 & 5: Execute Zero-Click navigation, tab switch, auto-save, and anti-echo TTS
        onApplyRef.current(result, speakWithAntiEcho)
      } catch {
        isDispatchingRef.current = false
        const nextMode = vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED'
        setMode(nextMode)
        broadcastVoiceLiveState({
          mode: nextMode,
          transcript: '',
          rmsLevel: 0,
          ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
          speechDurationMs: 0,
        })
      }
    },
    [lang, speakWithAntiEcho],
  )

  /**
   * Initializes the 4-Layer Spacecraft Web Audio DSP Graph (100Hz Highpass -> 3400Hz Lowpass -> Compressor -> Destination).
   */
  const ensureDspPipelineReady = useCallback(async () => {
    if (dspPipelineRef.current) {
      if (dspPipelineRef.current.audioCtx.state === 'suspended') {
        try {
          await dspPipelineRef.current.audioCtx.resume()
        } catch {
          // ignore
        }
      }
      return dspPipelineRef.current
    }

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    ) {
      try {
        const pipeline = await createSpacecraftDspAudioGraph()
        dspPipelineRef.current = pipeline
        setMicPermissionOk(true)
        return pipeline
      } catch {
        setMicPermissionOk(false)
      }
    }
    return null
  }, [])

  /**
   * Starts MediaRecorder on the DSP-filtered MediaStreamDestination (destination.stream).
   */
  const startRecordingFilteredAudio = useCallback(
    async (manualTrigger = false) => {
      if (isSpeakingTtsRef.current || isDispatchingRef.current) return

      const pipeline = await ensureDspPipelineReady()

      if (recognitionRef.current && !isRecognitionRunningRef.current) {
        try {
          recognitionRef.current.start()
        } catch {
          // already started
        }
      }

      if (manualTrigger) {
        isManualPushToTalkRef.current = true
        playSciFiCue('start') // 880Hz 0.12s "Ting"
      }

      if (!pipeline || typeof MediaRecorder === 'undefined') {
        if (manualTrigger) {
          setMode('RECORDING_AUDIO')
          const msg =
            lang === 'EN'
              ? 'DSP Mic Active — Speak your command now...'
              : 'Mạch lọc DSP đang nghe — Mời đọc chỉ số hoặc câu lệnh...'
          setLastTranscript(msg)
          broadcastVoiceLiveState({
            mode: 'RECORDING_AUDIO',
            transcript: msg,
            rmsLevel: 35,
            ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
            speechDurationMs: 0,
          })
        }
        return
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        return
      }

      try {
        const { recorderMimeType, geminiMimeType } = selectSupportedAudioMimeType()
        // CRITICAL (Module 1): Record from pipeline.filteredStream (100Hz-3400Hz + Compressor), NEVER rawStream!
        const recorder = recorderMimeType
          ? new MediaRecorder(pipeline.filteredStream, { mimeType: recorderMimeType })
          : new MediaRecorder(pipeline.filteredStream)

        chunksRef.current = []
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            chunksRef.current.push(ev.data)
          }
        }

        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, {
            type: recorderMimeType || 'audio/webm',
          })
          chunksRef.current = []

          // Allow 150ms for any final acoustic token to settle
          await new Promise((r) => setTimeout(r, 150))

          const capturedTranscript = activeTranscriptRef.current.trim()
          activeTranscriptRef.current = ''
          processedResultIndexRef.current = latestResultLengthRef.current

          const totalSpeechMs = speechDurationMsRef.current
          const wasManual = isManualPushToTalkRef.current
          speechDurationMsRef.current = 0
          isManualPushToTalkRef.current = false
          setSpeechDurationMs(0)

          // Module 2: Minimum Speech Duration Gate (speechDurationMs < 600ms -> Discard transient noise!)
          const wordCount = capturedTranscript
            ? capturedTranscript.split(/\s+/).filter(Boolean).length
            : 0
          const effectiveSpeechMs = Math.max(totalSpeechMs, wordCount * 280)

          if (effectiveSpeechMs < MIN_SPEECH_DURATION_GATE_MS && (!wasManual || !capturedTranscript)) {
            setDiscardedCount((c) => c + 1)
            const nextMode = vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED'
            setMode(nextMode)
            setLastTranscript(
              lang === 'EN'
                ? `🛡️ Gate <600ms: Discarded short click/cough (${effectiveSpeechMs}ms)`
                : `🛡️ Cổng <0.6s: Đã hủy tiếng gõ phím / ho ngắn (${effectiveSpeechMs}ms)`,
            )
            broadcastVoiceLiveState({
              mode: nextMode,
              transcript: '',
              rmsLevel: 0,
              ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
              speechDurationMs: 0,
            })
            return
          }

          playSciFiCue('send')
          try {
            const base64Audio = blob.size >= 200 ? await blobToBase64(blob) : null
            await dispatchToGeminiMultimodal({
              audioBase64: base64Audio,
              mimeType: geminiMimeType,
              textCommand: capturedTranscript || undefined,
              speechDurationMs: effectiveSpeechMs,
            })
          } catch {
            setMode(vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED')
          }
        }

        const now = performance.now()
        recordingStartMsRef.current = now
        lastLoudMsRef.current = now
        speechDurationMsRef.current = manualTrigger ? 250 : VAD_POLL_INTERVAL_MS
        mediaRecorderRef.current = recorder
        recorder.start(100)
        setMode('RECORDING_AUDIO')

        if (!activeTranscriptRef.current) {
          const promptMsg =
            lang === 'EN'
              ? 'DSP 100Hz-3.4kHz Recording (auto-sends after 1.0s silence)...'
              : 'Đang thu âm qua bộ lọc DSP 100Hz-3.4kHz (tự gửi sau 1.0s im lặng)...'
          setLastTranscript(promptMsg)
          broadcastVoiceLiveState({
            mode: 'RECORDING_AUDIO',
            transcript: '',
            rmsLevel: 30,
            ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
            speechDurationMs: speechDurationMsRef.current,
          })
        }
      } catch {
        setMode(vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED')
      }
    },
    [dispatchToGeminiMultimodal, ensureDspPipelineReady, lang],
  )

  /**
   * Stops MediaRecorder after 1.0s silence or Spacebar press.
   */
  const stopRecordingFilteredAudio = useCallback(() => {
    if (silenceCommitTimerRef.current) {
      clearTimeout(silenceCommitTimerRef.current)
      silenceCommitTimerRef.current = null
    }

    const rec = mediaRecorderRef.current
    if (rec && rec.state === 'recording') {
      try {
        rec.stop()
        return
      } catch {
        // fall through
      }
    }

    const capturedTranscript = activeTranscriptRef.current.trim()
    if (capturedTranscript) {
      const wordCount = capturedTranscript.split(/\s+/).filter(Boolean).length
      const effectiveSpeechMs = Math.max(speechDurationMsRef.current, wordCount * 320)
      activeTranscriptRef.current = ''
      processedResultIndexRef.current = latestResultLengthRef.current
      speechDurationMsRef.current = 0
      setSpeechDurationMs(0)

      if (effectiveSpeechMs < MIN_SPEECH_DURATION_GATE_MS && !isManualPushToTalkRef.current) {
        setDiscardedCount((c) => c + 1)
        setMode(vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED')
        return
      }

      isManualPushToTalkRef.current = false
      playSciFiCue('send')
      dispatchToGeminiMultimodal({
        audioBase64: null,
        textCommand: capturedTranscript,
        speechDurationMs: effectiveSpeechMs,
      })
    } else {
      const nextMode = vadEnabledRef.current ? 'VAD_STANDBY' : 'PAUSED'
      setMode(nextMode)
      broadcastVoiceLiveState({
        mode: nextMode,
        transcript: '',
        rmsLevel: 0,
        ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
        speechDurationMs: 0,
      })
    }
  }, [dispatchToGeminiMultimodal])

  // Auto-unlock AudioContext & SpeechRecognition on first user gesture anywhere in the app
  useEffect(() => {
    if (typeof window === 'undefined') return

    const unlockOnGesture = () => {
      if (
        dspPipelineRef.current &&
        dspPipelineRef.current.audioCtx.state === 'suspended'
      ) {
        dspPipelineRef.current.audioCtx.resume().catch(() => {})
      }
      if (
        vadEnabledRef.current &&
        recognitionRef.current &&
        !isRecognitionRunningRef.current &&
        !isSpeakingTtsRef.current
      ) {
        try {
          recognitionRef.current.start()
        } catch {
          // ignore
        }
      }
    }

    window.addEventListener('pointerdown', unlockOnGesture, { passive: true })
    window.addEventListener('keydown', unlockOnGesture, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', unlockOnGesture)
      window.removeEventListener('keydown', unlockOnGesture)
    }
  }, [])

  // Parallel bilingual acoustic stream (vi-VN / en-US) synchronized with DSP MediaRecorder
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition

    if (!SpeechRecCtor) return

    let unmounted = false
    const recognition = new SpeechRecCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'vi-VN'

    recognition.onstart = () => {
      isRecognitionRunningRef.current = true
      processedResultIndexRef.current = 0
      latestResultLengthRef.current = 0
    }

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      if (isSpeakingTtsRef.current || isDispatchingRef.current || !vadEnabledRef.current) {
        processedResultIndexRef.current = event.results.length
        latestResultLengthRef.current = event.results.length
        return
      }

      latestResultLengthRef.current = event.results.length
      let utterance = ''
      const startIdx = Math.max(0, processedResultIndexRef.current)
      for (let i = startIdx; i < event.results.length; i++) {
        const piece = event.results[i]?.[0]?.transcript ?? ''
        if (piece) {
          utterance += ' ' + piece
        }
      }
      utterance = utterance.trim()
      if (!utterance) return

      activeTranscriptRef.current = utterance
      lastLoudMsRef.current = performance.now()
      const words = utterance.split(/\s+/).filter(Boolean).length
      speechDurationMsRef.current = Math.max(speechDurationMsRef.current + 180, words * 280)
      setSpeechDurationMs(speechDurationMsRef.current)
      setLastTranscript(`🎙️ "${utterance}"`)
      setMode('RECORDING_AUDIO')

      broadcastVoiceLiveState({
        mode: 'RECORDING_AUDIO',
        transcript: utterance,
        rmsLevel: 68,
        ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
        speechDurationMs: speechDurationMsRef.current,
      })

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        startRecordingFilteredAudio(false)
      }

      // Module 2: Auto-stop after 1.0s (1000ms) of continuous silence
      if (silenceCommitTimerRef.current) {
        clearTimeout(silenceCommitTimerRef.current)
      }
      silenceCommitTimerRef.current = setTimeout(() => {
        stopRecordingFilteredAudio()
      }, SILENCE_STOP_MS)
    }

    recognition.onerror = () => {
      isRecognitionRunningRef.current = false
    }

    recognition.onend = () => {
      isRecognitionRunningRef.current = false
      if (activeTranscriptRef.current.trim() && !isDispatchingRef.current) {
        stopRecordingFilteredAudio()
      }
      if (!unmounted && vadEnabledRef.current && !isSpeakingTtsRef.current) {
        setTimeout(() => {
          if (!unmounted && vadEnabledRef.current && !isRecognitionRunningRef.current) {
            try {
              recognition.start()
            } catch {
              // ignore
            }
          }
        }, 250)
      }
    }

    recognitionRef.current = recognition
    if (vadEnabled) {
      try {
        recognition.start()
      } catch {
        // Will auto-start on user interaction
      }
    }

    return () => {
      unmounted = true
      if (silenceCommitTimerRef.current) {
        clearTimeout(silenceCommitTimerRef.current)
      }
      try {
        recognition.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
      isRecognitionRunningRef.current = false
    }
  }, [vadEnabled, startRecordingFilteredAudio, stopRecordingFilteredAudio])

  // Module 2: Smart VAD Loop (150Hz - 2500Hz Voice-Band Energy + Adaptive Noise Floor + 1.0s Silence + 600ms Gate)
  useEffect(() => {
    if (typeof window === 'undefined') return

    let mounted = true
    const initDsp = async () => {
      if (!vadEnabled) {
        stopRecordingFilteredAudio()
        setMode('PAUSED')
        return
      }
      if (mounted) {
        await ensureDspPipelineReady()
      }
    }

    initDsp()

    const freqBuf = new Uint8Array(512)
    const timeBuf = new Float32Array(1024)

    const interval = setInterval(() => {
      const pipeline = dspPipelineRef.current
      if (!pipeline) return

      const { voiceEnergy, spectrumBars } = computeVoiceBandEnergy(
        pipeline.analyser,
        pipeline.audioCtx.sampleRate || 16000,
        freqBuf,
        timeBuf,
      )

      const scaledEnergy = Math.min(100, Math.round(voiceEnergy * 480))
      setRmsLevel(scaledEnergy)

      if (isSpeakingTtsRef.current || isDispatchingRef.current) {
        consecutiveVoiceFramesRef.current = 0
        return
      }

      const now = performance.now()
      const rec = mediaRecorderRef.current
      const isRec = rec && rec.state === 'recording'

      // Dynamic trigger threshold = Math.max(ambientNoise * 2.2, MIN_VOICE_THRESHOLD)
      const dynamicTriggerThreshold = Math.max(
        ambientNoiseRef.current * 2.2,
        MIN_VOICE_THRESHOLD,
      )

      if (!isRec) {
        if (vadEnabledRef.current && voiceEnergy >= dynamicTriggerThreshold) {
          consecutiveVoiceFramesRef.current += 1
          if (consecutiveVoiceFramesRef.current >= 2) {
            consecutiveVoiceFramesRef.current = 0
            startRecordingFilteredAudio(false)
          }
        } else {
          consecutiveVoiceFramesRef.current = 0
          // Update Adaptive Noise Floor (ambientNoise) during silence
          ambientNoiseRef.current = Math.max(
            0.005,
            Math.min(0.04, ambientNoiseRef.current * 0.94 + voiceEnergy * 0.06),
          )
          setAmbientNoisePct(Math.min(40, Math.max(3, Math.round(ambientNoiseRef.current * 450))))
        }
      } else {
        // Currently recording: accumulate actual speechDurationMs when voiceEnergy exceeds noise floor
        const activeSpeechThreshold = Math.max(ambientNoiseRef.current * 1.65, 0.011)
        if (voiceEnergy >= activeSpeechThreshold) {
          lastLoudMsRef.current = now
          speechDurationMsRef.current += VAD_POLL_INTERVAL_MS
          setSpeechDurationMs(speechDurationMsRef.current)
        }

        broadcastVoiceLiveState({
          mode: 'RECORDING_AUDIO',
          transcript: activeTranscriptRef.current,
          rmsLevel: scaledEnergy,
          ambientNoisePct: Math.round(ambientNoiseRef.current * 450),
          speechDurationMs: speechDurationMsRef.current,
          spectrumBars,
        })

        const silenceElapsed = now - lastLoudMsRef.current
        const totalElapsed = now - recordingStartMsRef.current

        // Auto-stop after 1.0 second (1000ms) of continuous silence
        if (silenceElapsed >= SILENCE_STOP_MS || totalElapsed >= MAX_RECORD_MS) {
          stopRecordingFilteredAudio()
        }
      }
    }, VAD_POLL_INTERVAL_MS)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [vadEnabled, ensureDspPipelineReady, startRecordingFilteredAudio, stopRecordingFilteredAudio])

  // Listen for manual Mic button triggers from Dashboard Voice Dock or Monitoring Form
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleExternalManualToggle = () => {
      if (!vadEnabledRef.current) {
        setVadEnabled(true)
      }
      if (modeRef.current === 'RECORDING_AUDIO') {
        stopRecordingFilteredAudio()
      } else {
        startRecordingFilteredAudio(true)
      }
    }

    window.addEventListener('astro-voice-manual-toggle', handleExternalManualToggle)
    return () => {
      window.removeEventListener('astro-voice-manual-toggle', handleExternalManualToggle)
    }
  }, [startRecordingFilteredAudio, stopRecordingFilteredAudio])

  // Cleanup DSP pipeline on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          // ignore
        }
      }
      if (dspPipelineRef.current) {
        dspPipelineRef.current.rawStream.getTracks().forEach((t) => t.stop())
        dspPipelineRef.current.audioCtx.close().catch(() => {})
      }
    }
  }, [])

  // Module 2: Global Spacebar Push-to-Talk shortcut (with 880Hz 0.12s "Ting" cue)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target as HTMLElement | null)?.isContentEditable
      ) {
        return
      }
      e.preventDefault()
      if (modeRef.current === 'RECORDING_AUDIO') {
        playSciFiCue('start')
        stopRecordingFilteredAudio()
      } else {
        startRecordingFilteredAudio(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [startRecordingFilteredAudio, stopRecordingFilteredAudio])

  const handleToggleManualRecord = () => {
    if (mode === 'RECORDING_AUDIO') {
      stopRecordingFilteredAudio()
    } else {
      startRecordingFilteredAudio(true)
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customCmd.trim() || mode === 'GEMINI_PROCESSING') return
    playSciFiCue('start')
    dispatchToGeminiMultimodal({
      textCommand: customCmd.trim(),
      speechDurationMs: 1200,
    })
    setCustomCmd('')
  }

  const badgeTone =
    mode === 'RECORDING_AUDIO'
      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.45)]'
      : mode === 'GEMINI_PROCESSING'
        ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.35)]'
        : mode === 'SPEAKING'
          ? 'bg-indigo-500/20 border-indigo-400/70 text-indigo-200'
          : vadEnabled
            ? 'bg-sky-500/15 border-sky-400/50 text-sky-200 hover:bg-sky-500/25'
            : 'bg-slate-800/80 border-slate-700 text-slate-400'

  if (headless) {
    return null
  }

  return (
    <div className="relative flex-none">
      {/* Compact Global 4-Layer DSP Audio AI Pill in Top Header */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="global-hands-free-trigger"
          onClick={() => setOpenConsole((v) => !v)}
          aria-expanded={openConsole}
          aria-label={
            lang === 'EN'
              ? 'Global Multimodal Audio AI Controller'
              : 'Bộ điều khiển Giọng nói Đa phương thức Gemini AI'
          }
          title={
            lang === 'EN'
              ? '4-Layer Spacecraft DSP (100Hz-3.4kHz) + Smart VAD → Gemini 2.5 Flash'
              : 'Lọc ồn khoang tàu 4 lớp DSP (100Hz-3.4kHz) + Smart VAD → Gemini 2.5 Flash'
          }
          className={`inline-flex items-center gap-1.5 h-[34px] px-2.5 rounded-full border text-[11px] font-mono font-bold tracking-wider transition-all cursor-pointer ${badgeTone}`}
        >
          {mode === 'RECORDING_AUDIO' ? (
            <Radio size={13} className="text-emerald-400 animate-spin" aria-hidden="true" />
          ) : mode === 'GEMINI_PROCESSING' ? (
            <Loader2 size={13} className="text-amber-300 animate-spin" aria-hidden="true" />
          ) : mode === 'SPEAKING' ? (
            <Volume2 size={13} className="text-indigo-300 animate-pulse" aria-hidden="true" />
          ) : vadEnabled ? (
            <Mic size={13} className="text-sky-400" aria-hidden="true" />
          ) : (
            <MicOff size={13} className="text-slate-400" aria-hidden="true" />
          )}

          <span className="whitespace-nowrap">
            {mode === 'RECORDING_AUDIO'
              ? lang === 'EN'
                ? 'DSP REC...'
                : 'ĐANG THU DSP...'
              : mode === 'GEMINI_PROCESSING'
                ? lang === 'EN'
                  ? 'GEMINI 2.5...'
                  : 'GEMINI XỬ LÝ...'
                : mode === 'SPEAKING'
                  ? lang === 'EN'
                    ? 'AI SPEAKING'
                    : 'AI ĐANG ĐỌC'
                  : vadEnabled
                    ? lang === 'EN'
                      ? 'DSP VOICE AI'
                      : 'AI GIỌNG NÓI'
                    : lang === 'EN'
                      ? 'MIC OFF'
                      : 'ĐÃ TẮT MIC'}
          </span>

          <span
            className={`w-1.5 h-1.5 rounded-full ${
              mode === 'RECORDING_AUDIO'
                ? 'bg-emerald-400 animate-ping'
                : mode === 'GEMINI_PROCESSING'
                  ? 'bg-amber-400 animate-ping'
                  : mode === 'SPEAKING'
                    ? 'bg-indigo-400'
                    : vadEnabled
                      ? 'bg-sky-400 animate-pulse'
                      : 'bg-slate-500'
            }`}
          />
        </button>
      </div>

      {/* Global 4-Layer Spacecraft DSP & Native Audio AI Console Popover */}
      {openConsole && (
        <div
          role="dialog"
          aria-label={
            lang === 'EN'
              ? 'Spacecraft 4-Layer DSP & Gemini 2.5 Flash Voice Console'
              : 'Bảng điều khiển Giọng nói AI & Bộ lọc tạp âm 4 lớp chuẩn Tàu Vũ Trụ'
          }
          className="absolute right-0 top-[calc(100%+8px)] w-[450px] rounded-2xl bg-[#0b1324]/98 backdrop-blur-xl border border-sky-500/60 shadow-[0_20px_60px_rgba(2,8,23,0.95)] p-3.5 z-50 text-xs"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck
                size={16}
                className={
                  mode === 'RECORDING_AUDIO' ? 'text-emerald-400 animate-pulse' : 'text-sky-400'
                }
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="font-bold uppercase tracking-wider text-slate-100 truncate">
                  {lang === 'EN'
                    ? 'ZERO-CLICK AUDIO AI · 4-LAYER SPACECRAFT DSP'
                    : 'GIỌNG NÓI AI ZERO-CLICK · LỌC TẠP ÂM 4 LỚP'}
                </div>
                <div className="text-[10px] font-mono text-emerald-300 truncate">
                  🛡️ Lọc ồn khoang tàu (DSP 100Hz-3.4kHz Active) · Gate &ge;0.6s
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-none">
              <button
                type="button"
                onClick={handleToggleManualRecord}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold border transition-colors ${
                  mode === 'RECORDING_AUDIO'
                    ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/60 text-emerald-200'
                }`}
              >
                <Zap size={11} aria-hidden="true" />
                <span>
                  {mode === 'RECORDING_AUDIO'
                    ? lang === 'EN'
                      ? 'Stop & Send'
                      : 'Chốt câu (Space)'
                    : lang === 'EN'
                      ? 'Speak (Space)'
                      : 'Thu âm (Space)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !vadEnabled
                  setVadEnabled(next)
                  setMode(next ? 'VAD_STANDBY' : 'PAUSED')
                }}
                className={`rounded-lg px-2 py-1 text-[11px] font-mono font-bold border ${
                  vadEnabled
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {vadEnabled ? 'VAD ON' : 'VAD OFF'}
              </button>

              <button
                type="button"
                onClick={() => setOpenConsole(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                aria-label="Close hands-free console"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* 4-Layer DSP Telemetry & Smart VAD Status */}
          <div className="rounded-xl bg-[#070d19] border border-slate-800 px-3 py-2 mb-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles size={13} className="text-sky-400 flex-none" aria-hidden="true" />
                <span className="font-mono text-[11px] text-slate-200 truncate">
                  {lastTranscript ||
                    (lang === 'EN'
                      ? 'Speak naturally (1.0s silence auto-stop · <0.6s click gate)'
                      : 'Hãy nói tự nhiên (tự ngắt sau 1.0s im lặng · chặn tiếng gõ <0.6s)')}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 flex-none">
                {mode}
              </span>
            </div>

            {/* Real-time 150Hz-2500Hz Voice Band Energy & Adaptive Noise Floor Bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 w-24 flex-none">
                {lang === 'EN' ? 'Voice 150-2.5k:' : 'Dải giọng nói:'} {rmsLevel}%
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-75 ${
                    mode === 'RECORDING_AUDIO' ? 'bg-emerald-400' : 'bg-sky-400'
                  }`}
                  style={{ width: `${Math.max(4, rmsLevel)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-slate-400 flex-none">
                {lang === 'EN' ? 'Noise Floor:' : 'Ồn nền:'} {ambientNoisePct}%
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5 border-t border-slate-800/80">
              <span>
                {lang === 'EN'
                  ? `Speech Gate: ${speechDurationMs}ms / 600ms min`
                  : `Thời lượng nói: ${speechDurationMs}ms (Tối thiểu 600ms)`}
              </span>
              <span className="text-emerald-400">
                {lang === 'EN'
                  ? `Filtered Transients: ${discardedCount}`
                  : `Đã chặn tạp âm: ${discardedCount}`}
              </span>
              {!micPermissionOk && (
                <span className="text-amber-300">
                  {lang === 'EN' ? 'Use Text/Samples' : 'Dùng Text/Mẫu'}
                </span>
              )}
            </div>
          </div>

          {/* Direct Command Input to Gemini 2.5 Flash Endpoint */}
          <form onSubmit={handleManualSubmit} className="flex items-center gap-1.5 mb-3">
            <input
              type="text"
              value={customCmd}
              onChange={(e) => setCustomCmd(e.target.value)}
              placeholder={
                lang === 'EN'
                  ? 'Send natural language command to Gemini 2.5 Flash...'
                  : 'Gửi câu lệnh tự nhiên lên Gemini 2.5 Flash (VD: "Huyết áp 120 80 mạch 65")...'
              }
              className="flex-1 min-w-0 rounded-xl bg-[#070d19] border border-slate-700/80 focus:border-sky-400 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!customCmd.trim() || mode === 'GEMINI_PROCESSING'}
              className="inline-flex items-center gap-1 rounded-xl bg-sky-500/25 hover:bg-sky-500/40 disabled:opacity-40 border border-sky-400/60 px-2.5 py-1.5 text-xs font-semibold text-sky-100 flex-none"
            >
              <span>{lang === 'EN' ? 'Send' : 'Gửi AI'}</span>
              <SendHorizontal size={12} aria-hidden="true" />
            </button>
          </form>

          {/* 1-Click Zero-Click Auto-Save & Batch Presets */}
          <div className="space-y-1.5 mb-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Zap size={11} aria-hidden="true" />
              <span>
                {lang === 'EN'
                  ? 'ZERO-CLICK GEMINI AUTO-SWITCH, FILL & AUTO-SAVE (CLICK TO TEST)'
                  : 'GEMINI TỰ ĐỘNG CHUYỂN MỤC, ĐIỀN SỐ & LƯU (BẤM ĐỂ TEST)'}
              </span>
            </div>

            {SAMPLE_MULTIMODAL_COMMANDS.map((item, idx) => {
              const phrase = lang === 'EN' ? item.cmdEn : item.cmdVi
              return (
                <button
                  key={item.tagEn}
                  type="button"
                  data-testid={`sample-batch-cmd-${idx}`}
                  onClick={() => {
                    playSciFiCue('start')
                    dispatchToGeminiMultimodal({
                      textCommand: phrase,
                      speechDurationMs: 1800,
                    })
                    setOpenConsole(false)
                  }}
                  className="w-full rounded-xl bg-[#101c33] hover:bg-emerald-500/15 border border-slate-700/80 hover:border-emerald-400/70 p-2 text-left transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[10px] font-mono font-bold uppercase text-emerald-300">
                      ⚡ {lang === 'EN' ? item.tagEn : item.tagVi}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {lang === 'EN' ? item.descEn : item.descVi}
                    </span>
                  </div>
                  <div className="font-mono font-semibold text-sky-200 text-[11px]">
                    "{phrase}"
                  </div>
                </button>
              )
            })}
          </div>

          {/* Cross-Page & Metric Tab Voice Navigation Samples */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5 mb-1.5">
              <Compass size={11} aria-hidden="true" />
              <span>
                {lang === 'EN'
                  ? 'GLOBAL NAVIGATION & SYMPTOM COMMANDS VIA GEMINI'
                  : 'ĐIỀU HƯỚNG TOÀN CỤC & CHẨN ĐOÁN TRIỆU CHỨNG QUA GEMINI'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SAMPLE_NAV_COMMANDS.map((nav) => {
                const phrase = lang === 'EN' ? nav.en : nav.vi
                return (
                  <button
                    key={nav.en}
                    type="button"
                    onClick={() => {
                      playSciFiCue('start')
                      dispatchToGeminiMultimodal({
                        textCommand: phrase,
                        speechDurationMs: 1400,
                      })
                      setOpenConsole(false)
                    }}
                    className="rounded-lg bg-[#101c33] hover:bg-sky-500/20 border border-slate-700/70 hover:border-sky-400 px-2 py-1 text-left font-mono text-[11px] text-slate-200 truncate transition-colors"
                  >
                    "{phrase}"
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
