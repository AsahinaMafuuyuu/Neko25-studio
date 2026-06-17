import {
  avatarErrorStatus,
  getDefaultAvatarById,
  getBackendAdmin,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/avatar-server"
import { getAvatarById } from "@/lib/avatar-server"
import {
  deductCredits,
  ensureCreditBalance,
  getDefaultVoiceById,
  getVoiceCloneById,
  listAllVoices,
  refundCredits,
} from "@/lib/voice-server"
import { listAvatars } from "@/lib/avatar-server"
import type { VoiceSource } from "@/lib/voice-types"
import type {
  AiVideoAgentAsset,
  AiVideoAgentAssetType,
  AiVideoAgentCaptionCue,
  AiVideoAgentCaptionEffect,
  AiVideoAgentCaptionStyle,
  AiVideoAgentComposition,
  AiVideoAgentDialogue,
  AiVideoAgentDuration,
  AiVideoAgentAspectRatio,
  AiVideoAgentBRollStyle,
  AiVideoAgentGenerationMode,
  AiVideoAgentJob,
  AiVideoAgentLipSyncMode,
  AiVideoAgentPresentationFormat,
  AiVideoAgentProject,
  AiVideoAgentScene,
  AiVideoAgentScriptMode,
  AiVideoAgentStatus,
  AiVideoAgentTimeline,
  AiVideoAgentVisualStyle,
} from "@/lib/ai-video-agent"
export const AI_VIDEO_V2_TABLES = {
  projects: "ai_video_v2_projects",
  scenes: "ai_video_v2_scenes",
  dialogues: "ai_video_v2_dialogues",
  assets: "ai_video_v2_assets",
  jobs: "ai_video_v2_jobs",
} as const

export {
  avatarErrorStatus,
  deductCredits,
  ensureCreditBalance,
  jsonError,
  refundCredits,
  requireBearerToken,
  requireCurrentUserId,
}

type SdkResponse<T> = {
  data?: T
  error?: unknown
}

type SceneInput = {
  scene_index: number
  start_seconds: number
  end_seconds: number
  title: string
  summary: string
  narration: string
  caption_text: string
  b_roll_request: string
  prompt: string
  keyword: string
  avatar_clip_required: boolean
  remotion_scene: Record<string, unknown>
}

type DialogueInput = {
  scene_id: string
  dialogue_index: number
  start_seconds: number
  end_seconds: number
  text: string
  emotion: string
  audio_asset_id?: string
}

type V2ProjectRow = {
  id: string
  user_id: string
  title: string
  prompt: string
  script: string
  timeline: AiVideoAgentTimeline | Record<string, unknown>
  status: string
  aspect_ratio: AiVideoAgentAspectRatio
  workflow_version: number
  generation_mode: AiVideoAgentGenerationMode
  lip_sync_mode: AiVideoAgentLipSyncMode
  caption_effect: AiVideoAgentCaptionEffect
  avatar_asset_id: string | null
  voice_asset_id: string | null
  trigger_job_id: string | null
  final_video_url: string | null
  final_video_key: string | null
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type V2SceneRow = {
  id: string
  project_id: string
  user_id: string
  scene_index: number
  start_seconds: number
  end_seconds: number
  title: string
  summary: string
  visual_source: string
  visual_prompt: string
  uploaded_asset_id: string | null
  resolved_asset_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type V2DialogueRow = {
  id: string
  project_id: string
  scene_id: string | null
  user_id: string
  dialogue_index: number
  start_seconds: number
  end_seconds: number
  text: string
  emotion: string | null
  audio_asset_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type V2AssetRow = {
  id: string
  project_id: string
  scene_id: string | null
  dialogue_id: string | null
  user_id: string
  asset_type: string
  provider: string
  storage_key: string | null
  public_url: string | null
  mime_type: string | null
  duration_seconds: number | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type V2JobRow = {
  id: string
  project_id: string
  user_id: string
  trigger_job_id: string | null
  status: string
  progress: number
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type V2JobStatus = "queued" | "generating" | "rendering" | "completed" | "failed" | "cancelled"

type AiVideoAgentProjectUpdateValues = Partial<{
  status: AiVideoAgentStatus
  progress: number
  message: string
  error: string
  credits_refunded: boolean
  trigger_run_id: string | null
  render_trigger_run_id: string | null
  final_video_url: string
  final_video_key: string
  thumbnail_url: string
  thumbnail_key: string
  captions: AiVideoAgentCaptionCue[]
  composition: AiVideoAgentComposition
  timeline: AiVideoAgentTimeline
  lip_sync_mode: AiVideoAgentLipSyncMode
}>

const primaryVideoAgentBucket = "ai-video-agent"
const fallbackVideoAgentBucket = "ai-video-avatars"

function sdkErrorMessage(error: unknown, fallback: string): string {
  const message = errorMessageParts(error).filter(Boolean).join(" ")
  return message || fallback
}

function throwIfSdkError(error: unknown, fallback: string) {
  if (error) throw new Error(sdkErrorMessage(error, fallback))
}

function isMissingAiVideoAgentTable(error: unknown) {
  const message = sdkErrorMessage(error, "").toLowerCase()
  return Object.values(AI_VIDEO_V2_TABLES).some((table) => message.includes(table)) && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the")
  )
}

function aiVideoAgentMigrationMessage() {
  return "AI Video Agent v2 database tables are not available in the current Supabase project. Apply migrations/20260611130000_ai-video-agent-v2-main-tables.sql."
}

function firstRecord<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null
  if (value && typeof value === "object") return value as T
  return null
}

function safeFileName(filename: string, fallback: string) {
  return filename.replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || fallback
}

function getExtension(contentType: string, fallback = "bin") {
  if (contentType.includes("mp4")) return "mp4"
  if (contentType.includes("webm")) return "webm"
  if (contentType.includes("quicktime")) return "mov"
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3"
  if (contentType.includes("wav") || contentType.includes("wave")) return "wav"
  if (contentType.includes("jpeg")) return "jpg"
  if (contentType.includes("webp")) return "webp"
  if (contentType.includes("png")) return "png"
  if (contentType.includes("json")) return "json"
  return fallback
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback
}

function captionsValue(value: unknown): AiVideoAgentCaptionCue[] {
  return Array.isArray(value) ? value as AiVideoAgentCaptionCue[] : []
}

function compositionValue(value: unknown): AiVideoAgentComposition {
  return recordValue(value) as AiVideoAgentComposition
}

function isAiVideoAgentStatus(value: unknown): value is AiVideoAgentStatus {
  return (
    value === "queued" ||
    value === "running" ||
    value === "generating" ||
    value === "rendering" ||
    value === "uploading" ||
    value === "completed" ||
    value === "failed"
  )
}

function toV2JobStatus(status: AiVideoAgentStatus | undefined): V2JobStatus {
  if (status === "queued") return "queued"
  if (status === "rendering") return "rendering"
  if (status === "completed") return "completed"
  if (status === "failed") return "failed"
  return "generating"
}

function fromV2ProjectStatus(rowStatus: string, metadata: Record<string, unknown>): AiVideoAgentStatus {
  const metadataStatus = metadata.status
  if (isAiVideoAgentStatus(metadataStatus)) return metadataStatus
  if (rowStatus === "draft" || rowStatus === "queued") return "queued"
  if (rowStatus === "rendering") return "rendering"
  if (rowStatus === "completed") return "completed"
  if (rowStatus === "failed" || rowStatus === "cancelled") return "failed"
  return "generating"
}

function fromV2JobStatus(rowStatus: string, metadata: Record<string, unknown>): AiVideoAgentStatus {
  const metadataStatus = metadata.status
  if (isAiVideoAgentStatus(metadataStatus)) return metadataStatus
  if (rowStatus === "queued") return "queued"
  if (rowStatus === "rendering") return "rendering"
  if (rowStatus === "completed") return "completed"
  if (rowStatus === "failed" || rowStatus === "cancelled") return "failed"
  return "generating"
}

function toV2AssetType(assetType: AiVideoAgentAssetType) {
  if (assetType === "b_roll_image" || assetType === "thumbnail" || assetType === "preview") return "scene_image"
  if (assetType === "b_roll_video" || assetType === "avatar_clip") return "scene_video"
  return assetType
}

function mapV2Project(row: V2ProjectRow): AiVideoAgentProject {
  const metadata = recordValue(row.metadata)
  const timeline = recordValue(row.timeline)
  const durationSeconds = numberValue(metadata.duration_seconds ?? metadata.durationSeconds ?? (timeline.durationSeconds as number | undefined), 30) as AiVideoAgentDuration
  const sceneCount = numberValue(metadata.scene_count ?? metadata.sceneCount, Array.isArray(timeline.scenes) ? timeline.scenes.length : 4)

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    script_mode: stringValue(metadata.script_mode ?? metadata.scriptMode, "manual") as AiVideoAgentScriptMode,
    topic: stringValue(metadata.topic, row.prompt || ""),
    script: row.script || "",
    avatar_id: stringValue(metadata.avatar_id ?? metadata.avatarId),
    avatar_name: stringValue(metadata.avatar_name ?? metadata.avatarName),
    avatar_image_url: stringValue(metadata.avatar_image_url ?? metadata.avatarImageUrl),
    avatar_source: stringValue(metadata.avatar_source ?? metadata.avatarSource),
    voice_id: stringValue(metadata.voice_id ?? metadata.voiceId),
    voice_name: stringValue(metadata.voice_name ?? metadata.voiceName),
    voice_source: stringValue(metadata.voice_source ?? metadata.voiceSource, "default") as "custom" | "default",
    provider_voice_id: stringValue(metadata.provider_voice_id ?? metadata.providerVoiceId),
    voice_audio_url: stringValue(metadata.voice_audio_url ?? metadata.voiceAudioUrl),
    duration_seconds: durationSeconds,
    aspect_ratio: row.aspect_ratio,
    caption_style: stringValue(metadata.caption_style ?? metadata.captionStyle, "clean_lower") as AiVideoAgentCaptionStyle,
    b_roll_style: stringValue(metadata.b_roll_style ?? metadata.bRollStyle, "stock") as AiVideoAgentBRollStyle,
    visual_style: stringValue(metadata.visual_style ?? metadata.visualStyle, "2d_cel") as AiVideoAgentVisualStyle,
    presentation_format: stringValue(metadata.presentation_format ?? metadata.presentationFormat, "podcast") as AiVideoAgentPresentationFormat,
    workflow_version: row.workflow_version,
    timeline: row.timeline || {},
    generation_mode: row.generation_mode,
    lip_sync_mode: row.lip_sync_mode,
    caption_effect: row.caption_effect,
    scene_count: sceneCount,
    credits_cost: numberValue(metadata.credits_cost ?? metadata.creditsCost, 0),
    status: fromV2ProjectStatus(row.status, metadata),
    progress: numberValue(metadata.progress, 0),
    message: stringValue(metadata.message),
    error: row.error_message || stringValue(metadata.error),
    credits_refunded: booleanValue(metadata.credits_refunded ?? metadata.creditsRefunded),
    trigger_run_id: row.trigger_job_id || stringValue(metadata.trigger_run_id ?? metadata.triggerRunId) || null,
    render_trigger_run_id: stringValue(metadata.render_trigger_run_id ?? metadata.renderTriggerRunId) || null,
    final_video_url: row.final_video_url || "",
    final_video_key: row.final_video_key || "",
    thumbnail_url: stringValue(metadata.thumbnail_url ?? metadata.thumbnailUrl),
    thumbnail_key: stringValue(metadata.thumbnail_key ?? metadata.thumbnailKey),
    captions: captionsValue(metadata.captions),
    composition: compositionValue(metadata.composition),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapV2Scene(row: V2SceneRow): AiVideoAgentScene {
  const metadata = recordValue(row.metadata)
  return {
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    scene_index: row.scene_index,
    start_seconds: Number(row.start_seconds),
    end_seconds: Number(row.end_seconds),
    title: row.title,
    summary: row.summary,
    narration: stringValue(metadata.narration),
    caption_text: stringValue(metadata.caption_text ?? metadata.captionText ?? metadata.narration),
    b_roll_request: stringValue(metadata.b_roll_request ?? metadata.bRollRequest ?? row.visual_prompt),
    prompt: stringValue(metadata.prompt ?? row.visual_prompt),
    keyword: stringValue(metadata.keyword, row.title),
    avatar_clip_required: booleanValue(metadata.avatar_clip_required ?? metadata.avatarClipRequired, true),
    remotion_scene: recordValue(metadata.remotion_scene ?? metadata.remotionScene),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapV2Dialogue(row: V2DialogueRow): AiVideoAgentDialogue {
  return {
    id: row.id,
    project_id: row.project_id,
    scene_id: row.scene_id || "",
    user_id: row.user_id,
    dialogue_index: row.dialogue_index,
    start_seconds: Number(row.start_seconds),
    end_seconds: Number(row.end_seconds),
    text: row.text,
    emotion: row.emotion || "",
    audio_asset_id: row.audio_asset_id || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapV2Asset(row: V2AssetRow): AiVideoAgentAsset {
  const metadata = recordValue(row.metadata)
  return {
    id: row.id,
    project_id: row.project_id,
    scene_id: row.scene_id,
    user_id: row.user_id,
    asset_type: stringValue(metadata.asset_type ?? metadata.assetType, row.asset_type) as AiVideoAgentAssetType,
    provider: row.provider,
    url: row.public_url || "",
    key: row.storage_key || "",
    content_type: row.mime_type || "",
    metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapV2Job(row: V2JobRow): AiVideoAgentJob {
  const metadata = recordValue(row.metadata)
  return {
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    trigger_job_id: row.trigger_job_id,
    status: fromV2JobStatus(row.status, metadata),
    progress: row.progress,
    error_message: row.error_message || "",
    metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getAiVideoAgentInitialData(userId: string, accessToken: string) {
  const [projects, avatars, voices, creditBalance] = await Promise.all([
    listAiVideoAgentProjects(userId),
    listAvatars(userId, accessToken),
    listAllVoices(userId),
    ensureCreditBalance(userId),
  ])

  return {
    projects,
    avatars,
    voices: voices.voices,
    creditBalance,
  }
}

export async function listAiVideoAgentProjects(userId: string) {
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.projects)
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (isMissingAiVideoAgentTable(error)) return []
  throwIfSdkError(error, "Could not load AI video projects.")
  return ((data || []) as V2ProjectRow[]).map(mapV2Project)
}

export async function getAiVideoAgentProject(projectId: string, userId: string) {
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.projects)
    .select()
    .eq("id", projectId)
    .eq("user_id", userId)
    .limit(1)

  if (isMissingAiVideoAgentTable(error)) return null
  throwIfSdkError(error, "Could not load AI video project.")
  const project = ((data || []) as V2ProjectRow[])[0]
  return project ? mapV2Project(project) : null
}

export async function getAiVideoAgentProjectDetail(projectId: string, userId: string) {
  const [project, scenes, dialogues, assets, latestJob, creditBalance] = await Promise.all([
    getAiVideoAgentProject(projectId, userId),
    listAiVideoAgentScenes(projectId, userId),
    listAiVideoAgentDialogues(projectId, userId),
    listAiVideoAgentAssets(projectId, userId),
    getLatestAiVideoAgentJob(projectId, userId),
    ensureCreditBalance(userId).catch(() => null),
  ])

  if (!project) return null
  return { project, scenes, dialogues, assets, latestJob, creditBalance }
}

export async function deleteAiVideoAgentProject(projectId: string, userId: string) {
  const admin = await getBackendAdmin()
  const project = await getAiVideoAgentProject(projectId, userId)
  if (!project) return false

  for (const table of [
    AI_VIDEO_V2_TABLES.jobs,
    AI_VIDEO_V2_TABLES.assets,
    AI_VIDEO_V2_TABLES.dialogues,
    AI_VIDEO_V2_TABLES.scenes,
    AI_VIDEO_V2_TABLES.projects,
  ]) {
    const result = await admin
      .database
      .from(table)
      .delete()
      .eq(table === AI_VIDEO_V2_TABLES.projects ? "id" : "project_id", projectId)
      .eq("user_id", userId)

    if (isMissingAiVideoAgentTable(result.error)) throw new Error(aiVideoAgentMigrationMessage())
    throwIfSdkError(result.error, "Could not delete AI video project.")
  }

  return true
}

export async function createAiVideoAgentJob(input: {
  projectId: string
  userId: string
  triggerJobId?: string | null
  status: AiVideoAgentStatus
  progress: number
  message: string
  kind: "generation" | "render"
}) {
  const admin = await getBackendAdmin()
  const metadata = {
    kind: input.kind,
    status: input.status,
    message: input.message,
  }
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.jobs)
    .insert([
      {
        project_id: input.projectId,
        user_id: input.userId,
        trigger_job_id: input.triggerJobId || null,
        status: toV2JobStatus(input.status),
        progress: input.progress,
        error_message: "",
        metadata,
      },
    ])
    .select()

  if (isMissingAiVideoAgentTable(error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(error, "Could not create AI video job.")
  const job = ((data || []) as V2JobRow[])[0]
  return job ? mapV2Job(job) : null
}

export async function getLatestAiVideoAgentJob(projectId: string, userId: string) {
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.jobs)
    .select()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (isMissingAiVideoAgentTable(error)) return null
  throwIfSdkError(error, "Could not load AI video job.")
  const job = ((data || []) as V2JobRow[])[0]
  return job ? mapV2Job(job) : null
}

async function syncLatestAiVideoAgentJob(
  projectId: string,
  projectMetadata: Record<string, unknown>,
  values: AiVideoAgentProjectUpdateValues
) {
  if (values.status === undefined && values.progress === undefined && values.message === undefined && values.error === undefined) {
    return
  }

  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.jobs)
    .select()
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (isMissingAiVideoAgentTable(error)) return
  throwIfSdkError(error, "Could not load AI video job for update.")

  const latest = ((data || []) as V2JobRow[])[0]
  if (!latest) return

  const metadata = {
    ...recordValue(latest.metadata),
    status: values.status ?? projectMetadata.status,
    message: values.message ?? projectMetadata.message,
  }
  const updateValues = {
    status: toV2JobStatus((values.status ?? projectMetadata.status) as AiVideoAgentStatus | undefined),
    progress: numberValue(values.progress ?? projectMetadata.progress, latest.progress),
    error_message: stringValue(values.error ?? projectMetadata.error ?? latest.error_message),
    metadata,
  }
  const updateResult = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.jobs)
    .update(updateValues)
    .eq("id", latest.id)

  if (isMissingAiVideoAgentTable(updateResult.error)) return
  throwIfSdkError(updateResult.error, "Could not update AI video job.")
}

export async function listAiVideoAgentScenes(projectId: string, userId: string) {
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.scenes)
    .select()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("scene_index", { ascending: true })

  if (isMissingAiVideoAgentTable(error)) return []
  throwIfSdkError(error, "Could not load AI video scenes.")
  return ((data || []) as V2SceneRow[]).map(mapV2Scene)
}

export async function listAiVideoAgentDialogues(projectId: string, userId: string) {
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.dialogues)
    .select()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("start_seconds", { ascending: true })

  if (isMissingAiVideoAgentTable(error)) return []
  throwIfSdkError(error, "Could not load AI video dialogues.")
  return ((data || []) as V2DialogueRow[]).map(mapV2Dialogue).sort(compareAiVideoAgentDialogues)
}

function compareAiVideoAgentDialogues(a: AiVideoAgentDialogue, b: AiVideoAgentDialogue) {
  return (
    Number(a.start_seconds) - Number(b.start_seconds) ||
    Number(a.end_seconds) - Number(b.end_seconds) ||
    Number(a.dialogue_index) - Number(b.dialogue_index) ||
    a.id.localeCompare(b.id)
  )
}

export async function listAiVideoAgentAssets(projectId: string, userId: string) {
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.assets)
    .select()
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (isMissingAiVideoAgentTable(error)) return []
  throwIfSdkError(error, "Could not load AI video assets.")
  return ((data || []) as V2AssetRow[]).map(mapV2Asset)
}

export async function createAiVideoAgentProject(input: {
  accessToken: string
  userId: string
  title: string
  scriptMode: AiVideoAgentScriptMode
  topic: string
  script: string
  avatarId: string
  avatarName: string
  avatarImageUrl: string
  avatarSource: string
  voiceId: string
  voiceName: string
  voiceSource: VoiceSource
  providerVoiceId: string
  voiceAudioUrl: string
  durationSeconds: AiVideoAgentDuration
  aspectRatio: AiVideoAgentAspectRatio
  captionStyle: AiVideoAgentCaptionStyle
  bRollStyle: AiVideoAgentBRollStyle
  visualStyle: AiVideoAgentVisualStyle
  presentationFormat: AiVideoAgentPresentationFormat
  workflowVersion?: number
  timeline?: AiVideoAgentTimeline
  generationMode?: AiVideoAgentGenerationMode
  lipSyncMode?: AiVideoAgentLipSyncMode
  captionEffect?: AiVideoAgentCaptionEffect
  sceneCount: number
  creditsCost: number
}) {
  const metadata = {
    script_mode: input.scriptMode,
    topic: input.topic,
    avatar_id: input.avatarId,
    avatar_name: input.avatarName,
    avatar_image_url: input.avatarImageUrl,
    avatar_source: input.avatarSource,
    voice_id: input.voiceId,
    voice_name: input.voiceName,
    voice_source: input.voiceSource,
    provider_voice_id: input.providerVoiceId,
    voice_audio_url: input.voiceAudioUrl,
    duration_seconds: input.durationSeconds,
    caption_style: input.captionStyle,
    b_roll_style: input.bRollStyle,
    visual_style: input.visualStyle,
    presentation_format: input.presentationFormat,
    scene_count: input.sceneCount,
    credits_cost: input.creditsCost,
    status: "queued",
    progress: 5,
    message: "Queued for AI video agent generation.",
    error: "",
    credits_refunded: false,
    captions: [],
    composition: {},
  }
  const payload = {
    user_id: input.userId,
    title: input.title,
    prompt: input.topic,
    script: input.script,
    aspect_ratio: input.aspectRatio,
    workflow_version: input.workflowVersion || 2,
    timeline: input.timeline || {},
    generation_mode: input.generationMode || "scene_segments",
    lip_sync_mode: input.lipSyncMode || "compatible",
    caption_effect: input.captionEffect || "system_bold",
    status: "queued",
    metadata,
  }
  void input.accessToken
  const admin = await getBackendAdmin()
  const result = await admin.database.from(AI_VIDEO_V2_TABLES.projects).insert([payload]).select()
  if (isMissingAiVideoAgentTable(result.error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(result.error, "Could not create AI video project.")

  const project = firstRecord<V2ProjectRow>(result.data)
  if (!project) throw new Error("Supabase did not return the created AI video project.")
  return mapV2Project(project)
}

export async function updateAiVideoAgentProject(
  projectId: string,
  values: AiVideoAgentProjectUpdateValues,
  accessToken?: string
) {
  void accessToken
  const admin = await getBackendAdmin()
  const existingResult = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.projects)
    .select()
    .eq("id", projectId)
    .limit(1)

  if (isMissingAiVideoAgentTable(existingResult.error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(existingResult.error, "Could not load AI video project for update.")

  const existing = ((existingResult.data || []) as V2ProjectRow[])[0]
  const metadata = {
    ...recordValue(existing?.metadata),
  }
  const updateValues: Record<string, unknown> = {}

  if (values.status !== undefined) {
    metadata.status = values.status
    updateValues.status = toV2JobStatus(values.status)
  }
  if (values.progress !== undefined) metadata.progress = values.progress
  if (values.message !== undefined) metadata.message = values.message
  if (values.error !== undefined) {
    metadata.error = values.error
    updateValues.error_message = values.error
  }
  if (values.credits_refunded !== undefined) metadata.credits_refunded = values.credits_refunded
  if (values.trigger_run_id !== undefined) {
    metadata.trigger_run_id = values.trigger_run_id
    updateValues.trigger_job_id = values.trigger_run_id
  }
  if (values.render_trigger_run_id !== undefined) metadata.render_trigger_run_id = values.render_trigger_run_id
  if (values.final_video_url !== undefined) updateValues.final_video_url = values.final_video_url
  if (values.final_video_key !== undefined) updateValues.final_video_key = values.final_video_key
  if (values.thumbnail_url !== undefined) metadata.thumbnail_url = values.thumbnail_url
  if (values.thumbnail_key !== undefined) metadata.thumbnail_key = values.thumbnail_key
  if (values.captions !== undefined) metadata.captions = values.captions
  if (values.composition !== undefined) metadata.composition = values.composition
  if (values.timeline !== undefined) updateValues.timeline = values.timeline
  if (values.lip_sync_mode !== undefined) updateValues.lip_sync_mode = values.lip_sync_mode

  updateValues.metadata = metadata

  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.projects)
    .update(updateValues)
    .eq("id", projectId)
    .select()

  if (isMissingAiVideoAgentTable(error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(error, "Could not update AI video project.")
  await syncLatestAiVideoAgentJob(projectId, metadata, values).catch(() => undefined)
  const project = ((data || []) as V2ProjectRow[])[0]
  return project ? mapV2Project(project) : null
}

export async function replaceAiVideoAgentScenes(input: {
  projectId: string
  userId: string
  scenes: SceneInput[]
}) {
  const admin = await getBackendAdmin()
  const deleteResult = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.scenes)
    .delete()
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId)

  if (isMissingAiVideoAgentTable(deleteResult.error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(deleteResult.error, "Could not clear AI video scenes.")
  if (!input.scenes.length) return []

  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.scenes)
    .insert(input.scenes.map((scene) => ({
      project_id: input.projectId,
      user_id: input.userId,
      scene_index: scene.scene_index,
      start_seconds: scene.start_seconds,
      end_seconds: scene.end_seconds,
      title: scene.title,
      summary: scene.summary,
      visual_source: stringValue(scene.remotion_scene.visualSource, "auto"),
      visual_prompt: scene.prompt || scene.b_roll_request || scene.summary,
      metadata: {
        narration: scene.narration,
        caption_text: scene.caption_text,
        b_roll_request: scene.b_roll_request,
        prompt: scene.prompt,
        keyword: scene.keyword,
        avatar_clip_required: scene.avatar_clip_required,
        remotion_scene: scene.remotion_scene,
      },
    })))
    .select()

  if (isMissingAiVideoAgentTable(error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(error, "Could not save AI video scenes.")
  return ((data || []) as V2SceneRow[]).map(mapV2Scene)
}

export async function replaceAiVideoAgentDialogues(input: {
  projectId: string
  userId: string
  dialogues: DialogueInput[]
}) {
  const admin = await getBackendAdmin()
  const deleteResult = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.dialogues)
    .delete()
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId)

  if (isMissingAiVideoAgentTable(deleteResult.error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(deleteResult.error, "Could not clear AI video dialogues.")
  if (!input.dialogues.length) return []

  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.dialogues)
    .insert(input.dialogues.map((dialogue) => ({
      project_id: input.projectId,
      user_id: input.userId,
      scene_id: dialogue.scene_id,
      dialogue_index: dialogue.dialogue_index,
      start_seconds: dialogue.start_seconds,
      end_seconds: dialogue.end_seconds,
      text: dialogue.text,
      emotion: dialogue.emotion || null,
      audio_asset_id: dialogue.audio_asset_id || null,
      metadata: {},
    })))
    .select()

  if (isMissingAiVideoAgentTable(error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(error, "Could not save AI video dialogues.")
  return ((data || []) as V2DialogueRow[]).map(mapV2Dialogue)
}

export async function updateAiVideoAgentDialogue(
  dialogueId: string,
  values: Partial<{
    audio_asset_id: string
  }>
) {
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.dialogues)
    .update({
      audio_asset_id: values.audio_asset_id || null,
    })
    .eq("id", dialogueId)
    .select()

  if (isMissingAiVideoAgentTable(error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(error, "Could not update AI video dialogue.")
  const dialogue = ((data || []) as V2DialogueRow[])[0]
  return dialogue ? mapV2Dialogue(dialogue) : null
}

export async function createAiVideoAgentAsset(input: {
  projectId: string
  sceneId?: string | null
  userId: string
  assetType: AiVideoAgentAssetType
  provider: string
  url: string
  key: string
  contentType: string
  metadata?: Record<string, unknown>
}) {
  const admin = await getBackendAdmin()
  const metadata: Record<string, unknown> = {
    ...(input.metadata || {}),
    asset_type: input.assetType,
  }
  const { data, error } = await admin
    .database
    .from(AI_VIDEO_V2_TABLES.assets)
    .insert([
      {
        project_id: input.projectId,
        scene_id: input.sceneId || null,
        user_id: input.userId,
        asset_type: toV2AssetType(input.assetType),
        provider: input.provider,
        storage_key: input.key,
        public_url: input.url,
        mime_type: input.contentType,
        duration_seconds: numberValue(metadata.durationSeconds, 0) || null,
        metadata,
      },
    ])
    .select()

  if (isMissingAiVideoAgentTable(error)) throw new Error(aiVideoAgentMigrationMessage())
  throwIfSdkError(error, "Could not save AI video asset.")
  const asset = ((data || []) as V2AssetRow[])[0]
  return asset ? mapV2Asset(asset) : null
}

export async function uploadAiVideoAgentBlob(input: {
  blob: Blob
  userId: string
  projectId: string
  folder: string
  filename: string
}) {
  const contentType = input.blob.type || "application/octet-stream"
  const fallback = `asset.${getExtension(contentType)}`
  const key = `${input.userId}/ai-video-agent/${input.projectId}/${input.folder}/${Date.now()}-${safeFileName(input.filename, fallback)}`
  const admin = await getBackendAdmin()

  for (const bucket of [primaryVideoAgentBucket, fallbackVideoAgentBucket]) {
    const result = (await admin.storage.from(bucket).upload(key, input.blob)) as SdkResponse<{
      url?: string
      key?: string
    }>

    if (!result.error && result.data?.url && result.data?.key) {
      return { bucket, url: result.data.url, key: result.data.key, contentType }
    }
  }

  throw new Error("Could not upload AI video agent asset.")
}

export async function uploadAiVideoAgentJson(input: {
  data: unknown
  userId: string
  projectId: string
  folder: string
  filename: string
}) {
  return uploadAiVideoAgentBlob({
    blob: new Blob([JSON.stringify(input.data, null, 2)], { type: "application/json" }),
    filename: input.filename,
    folder: input.folder,
    projectId: input.projectId,
    userId: input.userId,
  })
}

export async function resolveAiVideoAgentInputs(input: {
  avatarId: string
  voiceId: string
  userId: string
}) {
  const defaultAvatar = await getDefaultAvatarById(input.avatarId)
  const customAvatar = defaultAvatar || !isUuid(input.avatarId)
    ? null
    : await getAvatarById(input.avatarId, input.userId)
  const avatar = customAvatar || defaultAvatar
  if (!avatar) throw new Error("Avatar not found.")

  const defaultVoice = await getDefaultVoiceById(input.voiceId)
  const customVoice = defaultVoice || !isUuid(input.voiceId)
    ? null
    : await getVoiceCloneById(input.voiceId, input.userId)
  if (!defaultVoice && !customVoice) throw new Error("Voice not found.")

  return {
    avatar,
    voice: {
      id: customVoice?.id || defaultVoice?.id || "",
      name: customVoice?.name || defaultVoice?.name || "Voice",
      source: (customVoice ? "custom" : "default") as VoiceSource,
      providerVoiceId: defaultVoice?.provider_voice_id || "",
      sampleAudioUrl: customVoice?.sample_audio_url || "",
      voiceAudioUrl: customVoice?.sample_audio_url || "",
      language: customVoice?.language || defaultVoice?.language || "en",
    },
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function errorMessageParts(value: unknown, seen = new Set<unknown>()): string[] {
  if (!value || seen.has(value)) return []
  if (typeof value === "string") return value.trim() ? [value.trim()] : []
  if (!(typeof value === "object")) return []
  seen.add(value)

  const record = value as Record<string, unknown>
  const parts: string[] = []
  for (const key of ["message", "error", "details", "hint", "code", "statusCode"]) {
    const item = record[key]
    if (typeof item === "string" && item.trim()) parts.push(item.trim())
    if (typeof item === "number") parts.push(String(item))
  }

  for (const key of ["error", "cause", "data"]) {
    const item = record[key]
    if (item && typeof item === "object") parts.push(...errorMessageParts(item, seen))
  }

  return Array.from(new Set(parts))
}

export async function refundAiVideoAgentCreditsOnce(input: {
  project: AiVideoAgentProject
  description: string
}) {
  if (input.project.credits_refunded || input.project.credits_cost <= 0) return null

  await refundCredits({
    userId: input.project.user_id,
    amount: input.project.credits_cost,
    description: input.description,
    referenceType: AI_VIDEO_V2_TABLES.projects,
    referenceId: input.project.id,
  })

  return await updateAiVideoAgentProject(input.project.id, {
    credits_refunded: true,
  })
}

export async function downloadRemoteBlob(url: string) {
  const response = await fetch(toPublicUrl(url))
  if (!response.ok) throw new Error(`Could not download media (${response.status}).`)

  const contentType = response.headers.get("content-type") || "application/octet-stream"
  const filename = getFilenameFromUrl(url, contentType)

  return {
    blob: new Blob([await response.arrayBuffer()], { type: contentType }),
    contentType,
    filename,
  }
}

export function toPublicUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url

  const appBaseUrl = process.env.APP_BASE_URL?.trim()
  if (!appBaseUrl) throw new Error("APP_BASE_URL is required to read relative media assets.")

  return `${appBaseUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`
}

function getFilenameFromUrl(url: string, contentType: string) {
  try {
    const pathname = new URL(toPublicUrl(url)).pathname
    const name = pathname.split("/").filter(Boolean).pop()
    if (name) return name
  } catch {
    // Use the content type fallback below.
  }

  return `asset.${getExtension(contentType)}`
}
