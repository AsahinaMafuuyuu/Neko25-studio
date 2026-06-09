export const videoAvatarAspectRatios = ["16:9", "9:16"] as const

export const videoAvatarDurations = [5, 10, 20, 30, 60] as const

export const videoAvatarStatuses = [
  "queued",
  "running",
  "generating",
  "uploading",
  "completed",
  "failed",
] as const

export const scriptToneOptions = [
  "professional",
  "friendly",
  "energetic",
  "educational",
  "promotional",
] as const

export type VideoAvatarAspectRatio = (typeof videoAvatarAspectRatios)[number]
export type VideoAvatarDuration = (typeof videoAvatarDurations)[number]
export type VideoAvatarStatus = (typeof videoAvatarStatuses)[number]
export type ScriptTone = (typeof scriptToneOptions)[number]

export type AiVideoAvatarVideo = {
  id: string
  user_id: string
  title: string
  script: string
  avatar_id: string | null
  avatar_name: string
  avatar_image_url: string
  avatar_image_key: string
  avatar_source: string
  voice_clone_id: string | null
  voice_name: string
  voice_source: "custom" | "default"
  provider_voice_id: string
  voice_audio_url: string
  aspect_ratio: VideoAvatarAspectRatio
  duration_seconds: VideoAvatarDuration
  credits_cost: number
  status: VideoAvatarStatus
  progress: number
  message: string
  error: string
  video_url: string
  video_key: string
  thumbnail_url: string
  thumbnail_key: string
  created_at: string
  updated_at: string
}

export type AiVideoAvatarJob = {
  id: string
  user_id: string
  video_id: string
  trigger_run_id: string | null
  provider_task_id: string
  provider_video_id: string
  provider_status: string
  status: VideoAvatarStatus
  progress: number
  message: string
  error: string
  credits_refunded: boolean
  callback_payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AiVideoAvatarJobResponse = {
  job: AiVideoAvatarJob
  video: AiVideoAvatarVideo | null
  creditBalance: number | null
}

export function isVideoAvatarAspectRatio(value: unknown): value is VideoAvatarAspectRatio {
  return typeof value === "string" && videoAvatarAspectRatios.includes(value as VideoAvatarAspectRatio)
}

export function isVideoAvatarDuration(value: unknown): value is VideoAvatarDuration {
  return typeof value === "number" && videoAvatarDurations.includes(value as VideoAvatarDuration)
}

export function isScriptTone(value: unknown): value is ScriptTone {
  return typeof value === "string" && scriptToneOptions.includes(value as ScriptTone)
}

export function getVideoAvatarCreditCost(input: {
  durationSeconds: number
  avatarSource?: string
  voiceSource?: string
}) {
  const durationCosts: Record<number, number> = {
    5: 20,
    10: 35,
    20: 60,
    30: 85,
    60: 150,
  }

  const durationCost = durationCosts[input.durationSeconds] || 0
  const voiceCost = input.voiceSource === "custom" ? 10 : 0
  const avatarCost = input.avatarSource && input.avatarSource !== "default" ? 5 : 0

  return durationCost + voiceCost + avatarCost
}

export function getVideoAvatarStatusLabel(status: VideoAvatarStatus) {
  const labels: Record<VideoAvatarStatus, string> = {
    queued: "Queued",
    running: "Preparing",
    generating: "Generating",
    uploading: "Uploading",
    completed: "Completed",
    failed: "Failed",
  }

  return labels[status]
}
