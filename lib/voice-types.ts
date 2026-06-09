export const voiceJobStatuses = ["queued", "running", "generating", "uploading", "completed", "failed"] as const

export type VoiceJobStatus = (typeof voiceJobStatuses)[number]

export type VoiceSource = "custom" | "default"

export type VoiceGender = "female" | "male"

export type VoiceLanguage = {
  code: string
  label: string
}

export type AiVoiceClone = {
  id: string
  user_id: string
  name: string
  source: "custom"
  language: string
  sample_audio_url: string
  sample_audio_key: string
  sample_transcript: string
  sample_detected_language: string
  preview_audio_url: string
  preview_audio_key: string
  avatar_image_url: string
  is_selected: boolean
  created_at: string
  updated_at: string
}

export type DefaultVoice = {
  id: string
  slug?: string
  name: string
  source: "default"
  provider: "deepgram"
  provider_voice_id: string
  language: string
  gender: VoiceGender
  preview_text: string
  avatar_image_url: string
}

export type VoiceListItem = {
  id: string
  name: string
  source: VoiceSource
  provider?: "deepgram" | "qwen3-tts"
  provider_voice_id?: string
  language: string
  gender?: VoiceGender
  preview_text?: string
  sample_audio_url?: string
  sample_transcript?: string
  sample_detected_language?: string
  preview_audio_url?: string
  avatar_image_url: string
  is_selected?: boolean
}

export type AiVoiceCloneJob = {
  id: string
  user_id: string
  voice_clone_id: string | null
  trigger_run_id: string | null
  name: string
  language: string
  sample_audio_url: string
  sample_audio_key: string
  status: VoiceJobStatus
  progress: number
  message: string
  error: string
  created_at: string
  updated_at: string
}

export type AiTtsOutput = {
  id: string
  user_id: string
  voice_clone_id: string | null
  voice_name: string
  voice_source: VoiceSource
  provider_voice_id: string
  language: string
  text: string
  character_count: number
  credits_cost: number
  audio_url: string
  audio_key: string
  audio_format: "mp3" | "wav" | "audio"
  created_at: string
  updated_at: string
}

export type AiTtsJob = {
  id: string
  user_id: string
  tts_output_id: string | null
  voice_clone_id: string | null
  trigger_run_id: string | null
  voice_name: string
  voice_source: VoiceSource
  provider_voice_id: string
  language: string
  text: string
  character_count: number
  credits_cost: number
  status: VoiceJobStatus
  progress: number
  message: string
  error: string
  credits_refunded: boolean
  created_at: string
  updated_at: string
}

export type VoiceCloneJobResponse = {
  job: AiVoiceCloneJob
  voice: AiVoiceClone | null
}

export type TtsJobResponse = {
  job: AiTtsJob
  output: AiTtsOutput | null
  creditBalance: number | null
}

export const customTtsLanguages: VoiceLanguage[] = [
  { code: "auto", label: "Auto" },
  { code: "Chinese", label: "Chinese" },
  { code: "English", label: "English" },
  { code: "Japanese", label: "Japanese" },
  { code: "Korean", label: "Korean" },
  { code: "French", label: "French" },
  { code: "German", label: "German" },
  { code: "Italian", label: "Italian" },
  { code: "Spanish", label: "Spanish" },
  { code: "Portuguese", label: "Portuguese" },
  { code: "Russian", label: "Russian" },
]

export const defaultCustomTtsLanguage = "auto"
export const defaultVoiceLanguage = "en"

export function getVoiceLanguageLabel(language: string) {
  if (language === "en-us") return "English"
  if (language === "multilingual") return "Multilingual"
  if (language === "auto") return "Auto"
  return customTtsLanguages.find((item) => item.code === language)?.label || language
}

export function isSupportedCustomTtsLanguage(language: string) {
  return customTtsLanguages.some((item) => item.code === language)
}

export function getTtsCreditCost(text: string) {
  const characterCount = Array.from(text.trim()).length
  return {
    characterCount,
    creditsCost: characterCount ? Math.ceil(characterCount / 500) * 10 : 0,
  }
}
