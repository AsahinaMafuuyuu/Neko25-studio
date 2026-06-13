export function buildVoiceSampleTranscriptionInput(audioUrl: string) {
  return {
    task: "transcribe",
    debug: false,
    vad_onset: 0.5,
    audio_file: audioUrl,
    batch_size: 64,
    vad_offset: 0.363,
    diarization: false,
    temperature: 0,
    align_output: false,
    language_detection_min_prob: 0,
    language_detection_max_tries: 5,
  }
}

export function buildQwenVoiceCloneInput(input: {
  language: string
  referenceAudioUrl: string
  speaker: string
  text: string
}) {
  return {
    mode: "voice_clone",
    speaker: input.speaker,
    language: input.language,
    reference_audio: input.referenceAudioUrl,
    text: input.text,
  }
}

export function buildDeepgramSpeakBody(text: string) {
  return { text }
}
