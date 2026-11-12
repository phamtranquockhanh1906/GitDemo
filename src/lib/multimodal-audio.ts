import {
  normalizeSpacecraftVoiceResponse,
  type CurrentAppStatePayload,
  type MultimodalControlResponse,
  type SpacecraftVoiceAiResponse,
} from './astro-data'

/**
 * Generates a pure Sci-Fi "Ting" cue using Web Audio API OscillatorNode (880Hz for 0.12s).
 */
export function playSciFiCue(type: 'start' | 'send' | 'discard' = 'start'): void {
  if (typeof window === 'undefined') return
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  try {
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    if (type === 'start') {
      // Exact 880Hz "Ting" for 0.12s
      osc.frequency.setValueAtTime(880, now)
    } else if (type === 'send') {
      osc.frequency.setValueAtTime(1046.5, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.11)
    } else {
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.09)
    }

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.12)

    setTimeout(() => {
      ctx.close().catch(() => {})
    }, 180)
  } catch {
    // Ignore autoplay restriction errors
  }
}

export type SpacecraftDspPipeline = {
  rawStream: MediaStream
  filteredStream: MediaStream
  audioCtx: AudioContext
  analyser: AnalyserNode
  highpassFilter: BiquadFilterNode
  lowpassFilter: BiquadFilterNode
  compressor: DynamicsCompressorNode
}

/**
 * Module 1: 4-Layer Spacecraft Web Audio DSP Filter Pipeline
 * 1) Hardware getUserMedia constraints (echoCancellation, noiseSuppression, autoGainControl, channelCount: 1, sampleRate: 16000)
 * 2) High-pass BiquadFilter (100Hz) -> cuts fan, AC, and desk vibration rumble (< 100Hz)
 * 3) Low-pass BiquadFilter (3400Hz) -> cuts mouse clicks, keyboard clatter, and hiss (> 3400Hz)
 * 4) DynamicsCompressorNode -> normalizes astronaut vocal amplitude
 * Outputs a clean filtered MediaStream via MediaStreamDestination for MediaRecorder.
 */
export async function createSpacecraftDspAudioGraph(): Promise<SpacecraftDspPipeline> {
  const rawStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 16000,
    },
  })

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) {
    throw new Error('Web Audio API AudioContext is not supported in this browser')
  }

  const audioCtx = new AudioCtx({ sampleRate: 16000 })
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }

  const micSource = audioCtx.createMediaStreamSource(rawStream)

  // High-pass filter at 100Hz to eliminate fan/AC/vibration rumble (< 100Hz)
  const highpassFilter = audioCtx.createBiquadFilter()
  highpassFilter.type = 'highpass'
  highpassFilter.frequency.value = 100
  highpassFilter.Q.value = 0.707

  // Low-pass filter at 3400Hz to eliminate mouse clicks, keystrokes & high-frequency hiss (> 3400Hz)
  const lowpassFilter = audioCtx.createBiquadFilter()
  lowpassFilter.type = 'lowpass'
  lowpassFilter.frequency.value = 3400
  lowpassFilter.Q.value = 0.707

  // DynamicsCompressorNode to level vocal dynamics in cabin environment
  const compressor = audioCtx.createDynamicsCompressor()
  compressor.threshold.value = -24
  compressor.knee.value = 30
  compressor.ratio.value = 6
  compressor.attack.value = 0.003
  compressor.release.value = 0.25

  // AnalyserNode for Smart VAD (150Hz - 2500Hz human vocal band energy measurement)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.35

  // MediaStreamDestination for clean DSP-filtered MediaRecorder input
  const destination = audioCtx.createMediaStreamDestination()

  // Connect graph: Mic Source -> Highpass (100Hz) -> Lowpass (3400Hz) -> Compressor -> AnalyserNode & MediaStreamDestination
  micSource.connect(highpassFilter)
  highpassFilter.connect(lowpassFilter)
  lowpassFilter.connect(compressor)
  compressor.connect(analyser)
  compressor.connect(destination)

  return {
    rawStream,
    filteredStream: destination.stream,
    audioCtx,
    analyser,
    highpassFilter,
    lowpassFilter,
    compressor,
  }
}

/**
 * Module 2: Smart VAD Voice-Band Energy Calculator (150Hz - 2500Hz)
 * Measures acoustic energy strictly within the core human speech frequency band (150Hz - 2500Hz)
 * and computes a 7-band visual spectrum for the HUD Voice Dock.
 */
export function computeVoiceBandEnergy(
  analyser: AnalyserNode,
  sampleRate: number,
  freqBuffer: Uint8Array<ArrayBuffer>,
  timeBuffer: Float32Array<ArrayBuffer>,
): {
  voiceEnergy: number
  spectrumBars: number[]
} {
  analyser.getByteFrequencyData(freqBuffer)
  analyser.getFloatTimeDomainData(timeBuffer)

  const fftSize = analyser.fftSize
  const binHz = sampleRate / fftSize
  const startBin = Math.max(1, Math.floor(150 / binHz))
  const endBin = Math.min(freqBuffer.length - 1, Math.ceil(2500 / binHz))

  let bandSum = 0
  let binCount = 0
  for (let i = startBin; i <= endBin; i++) {
    bandSum += freqBuffer[i] / 255
    binCount++
  }
  const freqEnergy = binCount > 0 ? bandSum / binCount : 0

  let sumSq = 0
  for (let i = 0; i < timeBuffer.length; i++) {
    const s = timeBuffer[i]
    sumSq += s * s
  }
  const timeRms = Math.sqrt(sumSq / timeBuffer.length)

  // Combine 150Hz-2500Hz spectral energy with filtered time-domain RMS
  const voiceEnergy = Math.max(freqEnergy * 0.65 + timeRms * 0.85, timeRms)

  // Compute 7 visual spectrum bars across 150Hz - 2500Hz for the HUD waveform
  const totalBins = Math.max(7, endBin - startBin + 1)
  const step = Math.max(1, Math.floor(totalBins / 7))
  const spectrumBars: number[] = []
  for (let b = 0; b < 7; b++) {
    const bStart = startBin + b * step
    const bEnd = Math.min(endBin, bStart + step)
    let subSum = 0
    let subCnt = 0
    for (let k = bStart; k <= bEnd; k++) {
      subSum += freqBuffer[k] / 255
      subCnt++
    }
    const avg = subCnt > 0 ? subSum / subCnt : 0
    spectrumBars.push(Math.min(22, Math.max(4, Math.round(avg * 28 + timeRms * 45))))
  }

  return { voiceEnergy, spectrumBars }
}

/**
 * Selects the best supported MediaRecorder audio MIME type and normalizes it for Gemini inlineData.
 */
export function selectSupportedAudioMimeType(): {
  recorderMimeType: string
  geminiMimeType: 'audio/webm' | 'audio/mp4' | 'audio/ogg'
} {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { recorderMimeType: 'audio/webm', geminiMimeType: 'audio/webm' }
  }

  const candidates: Array<{
    test: string
    gemini: 'audio/webm' | 'audio/mp4' | 'audio/ogg'
  }> = [
    { test: 'audio/webm;codecs=opus', gemini: 'audio/webm' },
    { test: 'audio/webm', gemini: 'audio/webm' },
    { test: 'audio/mp4', gemini: 'audio/mp4' },
    { test: 'audio/ogg;codecs=opus', gemini: 'audio/ogg' },
  ]

  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.test)) {
        return { recorderMimeType: c.test, geminiMimeType: c.gemini }
      }
    } catch {
      // continue
    }
  }

  return { recorderMimeType: '', geminiMimeType: 'audio/webm' }
}

/**
 * Converts a recorded DSP-filtered audio Blob into a raw Base64 string (without data:... prefix)
 * for Gemini API's inlineData.data field.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1] ?? ''
        resolve(base64)
      } else {
        reject(new Error('Failed to encode audio blob to base64'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Module 3 & 4: Sends DSP-filtered native audio (base64 inlineData: audio/webm) and currentAppState
 * to Gemini 2.5 Flash (/api/astro-multimodal-voice) and normalizes the Section 4 JSON response.
 */
export async function sendMultimodalAudioToGemini(params: {
  audioBase64?: string | null
  mimeType?: 'audio/webm' | 'audio/mp4' | 'audio/ogg'
  textCommand?: string
  speechDurationMs?: number
  webcamBase64?: string | null
  currentAppState: CurrentAppStatePayload
}): Promise<MultimodalControlResponse> {
  const response = await fetch('/api/astro-multimodal-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`Multimodal API error: ${response.status}`)
  }

  const rawJson = (await response.json()) as Partial<
    SpacecraftVoiceAiResponse & MultimodalControlResponse
  >
  return normalizeSpacecraftVoiceResponse(rawJson, params.currentAppState)
}
