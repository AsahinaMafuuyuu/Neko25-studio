import {
  getAvatarById,
  getDefaultAvatarById,
  getInsForgeAdmin,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  avatarErrorStatus,
} from "@/lib/avatar-server"
import {
  deductCredits,
  ensureCreditBalance,
  getDefaultVoiceById,
  getVoiceCloneById,
  refundCredits,
} from "@/lib/voice-server"
import { type VoiceSource } from "@/lib/voice-types"
import type {
  AiVideoAvatarJob,
  AiVideoAvatarVideo,
  VideoAvatarAspectRatio,
  VideoAvatarDuration,
  VideoAvatarStatus,
} from "@/lib/video-avatar-types"

export {
  avatarErrorStatus,
  deductCredits,
  ensureCreditBalance,
  jsonError,
  refundCredits,
  requireBearerToken,
  requireCurrentUserId,
}

const videoAvatarBucket = "ai-video-avatars"

type SdkResponse<T> = {
  data?: T
  error?: unknown
}

function sdkErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    return String(record.message || record.error || fallback)
  }

  if (typeof error === "string" && error.trim()) return error
  return fallback
}

function throwIfSdkError(error: unknown, fallback: string) {
  if (error) throw new Error(sdkErrorMessage(error, fallback))
}

function safeFileName(filename: string, fallback: string) {
  return filename.replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || fallback
}

function getExtension(contentType: string, fallback = "bin") {
  if (contentType.includes("mp4")) return "mp4"
  if (contentType.includes("webm")) return "webm"
  if (contentType.includes("quicktime")) return "mov"
  if (contentType.includes("jpeg")) return "jpg"
  if (contentType.includes("webp")) return "webp"
  if (contentType.includes("png")) return "png"
  return fallback
}

export async function listVideoAvatarVideos(userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_video_avatar_videos")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  throwIfSdkError(error, "Could not load AI video avatars.")
  return (data || []) as AiVideoAvatarVideo[]
}

export async function getVideoAvatarVideo(videoId: string, userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_video_avatar_videos")
    .select()
    .eq("id", videoId)
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load AI video avatar.")
  return ((data || []) as AiVideoAvatarVideo[])[0] || null
}

export async function deleteVideoAvatarVideo(videoId: string, userId: string) {
  const video = await getVideoAvatarVideo(videoId, userId)
  if (!video) return null

  const admin = await getInsForgeAdmin()
  const { error } = await admin
    .database
    .from("ai_video_avatar_videos")
    .delete()
    .eq("id", videoId)
    .eq("user_id", userId)

  throwIfSdkError(error, "Could not delete AI video avatar.")
  await removeVideoAvatarStorageKeys([video.video_key, video.thumbnail_key])

  return video
}

export async function getVideoAvatarJob(jobId: string, userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_video_avatar_jobs")
    .select()
    .eq("id", jobId)
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load AI video avatar job.")
  return ((data || []) as AiVideoAvatarJob[])[0] || null
}

export async function getVideoAvatarJobByProviderTaskId(providerTaskId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_video_avatar_jobs")
    .select()
    .eq("provider_task_id", providerTaskId)
    .limit(1)

  throwIfSdkError(error, "Could not load provider video job.")
  return ((data || []) as AiVideoAvatarJob[])[0] || null
}

export async function createVideoAvatarVideo(input: {
  userId: string
  title: string
  script: string
  avatarId: string | null
  avatarName: string
  avatarImageUrl: string
  avatarImageKey: string
  avatarSource: string
  voiceCloneId: string | null
  voiceName: string
  voiceSource: VoiceSource
  providerVoiceId: string
  voiceAudioUrl: string
  aspectRatio: VideoAvatarAspectRatio
  durationSeconds: VideoAvatarDuration
  creditsCost: number
}) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_video_avatar_videos")
    .insert([
      {
        user_id: input.userId,
        title: input.title,
        script: input.script,
        avatar_id: input.avatarId,
        avatar_name: input.avatarName,
        avatar_image_url: input.avatarImageUrl,
        avatar_image_key: input.avatarImageKey,
        avatar_source: input.avatarSource,
        voice_clone_id: input.voiceCloneId,
        voice_name: input.voiceName,
        voice_source: input.voiceSource,
        provider_voice_id: input.providerVoiceId,
        voice_audio_url: input.voiceAudioUrl,
        aspect_ratio: input.aspectRatio,
        duration_seconds: input.durationSeconds,
        credits_cost: input.creditsCost,
        status: "queued",
        progress: 5,
        message: "Queued for AI avatar video generation.",
      },
    ])
    .select()

  throwIfSdkError(error, "Could not create AI video avatar.")
  const video = ((data || []) as AiVideoAvatarVideo[])[0] || null
  if (!video) throw new Error("InsForge did not return the created AI video avatar.")
  return video
}

export async function createVideoAvatarJob(input: {
  userId: string
  videoId: string
}) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_video_avatar_jobs")
    .insert([
      {
        user_id: input.userId,
        video_id: input.videoId,
        status: "queued",
        progress: 5,
        message: "Queued for Trigger.dev.",
      },
    ])
    .select()

  throwIfSdkError(error, "Could not create AI video avatar job.")
  const job = ((data || []) as AiVideoAvatarJob[])[0] || null
  if (!job) throw new Error("InsForge did not return the created AI video avatar job.")
  return job
}

export async function updateVideoAvatarVideo(
  videoId: string,
  values: Partial<{
    status: VideoAvatarStatus
    progress: number
    message: string
    error: string
    video_url: string
    video_key: string
    thumbnail_url: string
    thumbnail_key: string
  }>
) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_video_avatar_videos")
    .update(values)
    .eq("id", videoId)
    .select()

  throwIfSdkError(error, "Could not update AI video avatar.")
  return ((data || []) as AiVideoAvatarVideo[])[0] || null
}

export async function updateVideoAvatarJob(
  jobId: string,
  values: Partial<{
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
  }>
) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_video_avatar_jobs")
    .update(values)
    .eq("id", jobId)
    .select()

  throwIfSdkError(error, "Could not update AI video avatar job.")
  return ((data || []) as AiVideoAvatarJob[])[0] || null
}

export async function resolveVideoAvatarInputs(input: {
  avatarId: string
  voiceId: string
  userId: string
}) {
  const avatar = await getAvatarById(input.avatarId, input.userId) || await getDefaultAvatarById(input.avatarId)
  if (!avatar) throw new Error("Avatar not found.")

  const defaultVoice = await getDefaultVoiceById(input.voiceId)
  const customVoice = defaultVoice ? null : await getVoiceCloneById(input.voiceId, input.userId)
  if (!defaultVoice && !customVoice) throw new Error("Voice not found.")

  const voiceSource: VoiceSource = customVoice ? "custom" : "default"

  return {
    avatar,
    voice: {
      id: customVoice?.id || defaultVoice?.id || "",
      voiceCloneId: customVoice?.id || null,
      name: customVoice?.name || defaultVoice?.name || "Voice",
      source: voiceSource,
      providerVoiceId: defaultVoice?.provider_voice_id || "",
      sampleAudioUrl: customVoice?.sample_audio_url || "",
      voiceAudioUrl: customVoice?.sample_audio_url || "",
    },
  }
}

export async function uploadVideoAvatarBlob(blob: Blob, keyPrefix: string, filename: string) {
  const contentType = blob.type || "application/octet-stream"
  const fallback = `asset.${getExtension(contentType)}`
  const key = `${keyPrefix}/${Date.now()}-${safeFileName(filename, fallback)}`
  const admin = await getInsForgeAdmin()
  const result = (await admin.storage.from(videoAvatarBucket).upload(key, blob)) as SdkResponse<{
    url?: string
    key?: string
  }>

  throwIfSdkError(result.error, "Could not upload AI video avatar asset.")
  if (!result.data?.url || !result.data?.key) {
    throw new Error("InsForge did not return the uploaded video avatar URL and key.")
  }

  return {
    url: result.data.url,
    key: result.data.key,
  }
}

async function removeVideoAvatarStorageKeys(keys: Array<string | null | undefined>) {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean))) as string[]
  if (!uniqueKeys.length) return

  try {
    const admin = await getInsForgeAdmin()
    await Promise.all(uniqueKeys.map((key) => admin.storage.from(videoAvatarBucket).remove(key)))
  } catch {
    // Storage cleanup is best-effort; the database record is the source of truth for the library.
  }
}

export async function refundVideoAvatarCreditsOnce(input: {
  job: AiVideoAvatarJob
  video: AiVideoAvatarVideo
  description: string
}) {
  if (input.job.credits_refunded || input.video.credits_cost <= 0) return null

  await refundCredits({
    userId: input.video.user_id,
    amount: input.video.credits_cost,
    description: input.description,
    referenceType: "ai_video_avatar_jobs",
    referenceId: input.job.id,
  })

  return await updateVideoAvatarJob(input.job.id, {
    credits_refunded: true,
  })
}
