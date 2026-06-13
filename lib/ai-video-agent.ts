import type { AiAvatar } from "@/lib/avatar-types"
import type { VoiceListItem } from "@/lib/voice-types"

export const aiVideoAgentDurations = [5, 10, 15] as const
export const aiVideoAgentSceneCounts = [1, 2, 3, 4] as const
export const aiVideoAgentAspectRatios = ["16:9", "9:16"] as const
export const aiVideoAgentScriptModes = ["manual", "topic"] as const
export const aiVideoAgentCaptionStyles = [
  "clean_lower",
  "cinematic_gold",
  "neon_pop",
  "editorial_stack",
  "minimal_box",
  "karaoke_wave",
] as const
export const aiVideoAgentCaptionEffects = [
  "system_bold",
  "rounded_sans",
  "serif_song",
  "gothic_hei",
  "mono_tech",
  "handwritten_play",
] as const
export const aiVideoAgentBRollStyles = [
  "ai_images",
  "stock",
  "ai_video",
  "illustration_animation",
] as const
export const aiVideoAgentVisualStyles = [
  "2d_cel",
  "3d_blindbox_clay",
  "cyberpunk",
  "realistic_cinematic",
] as const
export const aiVideoAgentPresentationFormats = [
  "podcast",
  "commentary",
  "visual_novel",
  "realistic",
] as const
export const aiVideoAgentTransitionEffects = [
  "none",
  "crossfade",
  "fade_to_black",
  "slide",
  "wipe",
] as const
export const aiVideoAgentTransitionDurations = [0.5, 1, 1.5, 2] as const
export const aiVideoAgentVisualSources = ["upload", "pixabay", "ai", "auto"] as const
export const aiVideoAgentGenerationModes = ["scene_segments"] as const
export const aiVideoAgentLipSyncModes = ["compatible", "audio_driven", "fallback_text_only"] as const
export const aiVideoAgentStatuses = [
  "queued",
  "running",
  "generating",
  "rendering",
  "uploading",
  "completed",
  "failed",
] as const
export const aiVideoAgentAssetTypes = [
  "avatar_clip",
  "b_roll_image",
  "b_roll_video",
  "voiceover",
  "captions_json",
  "composition_json",
  "preview",
  "thumbnail",
  "final_render",
  "scene_image",
  "scene_video",
  "dialogue_audio",
  "avatar_scene_video",
] as const

export type AiVideoAgentDuration = (typeof aiVideoAgentDurations)[number]
export type AiVideoAgentSceneCount = (typeof aiVideoAgentSceneCounts)[number]
export type AiVideoAgentAspectRatio = (typeof aiVideoAgentAspectRatios)[number]
export type AiVideoAgentScriptMode = (typeof aiVideoAgentScriptModes)[number]
export type AiVideoAgentCaptionStyle = (typeof aiVideoAgentCaptionStyles)[number]
export type AiVideoAgentCaptionEffect = (typeof aiVideoAgentCaptionEffects)[number]
export type AiVideoAgentBRollStyle = (typeof aiVideoAgentBRollStyles)[number]
export type AiVideoAgentVisualStyle = (typeof aiVideoAgentVisualStyles)[number]
export type AiVideoAgentPresentationFormat = (typeof aiVideoAgentPresentationFormats)[number]
export type AiVideoAgentTransitionEffect = (typeof aiVideoAgentTransitionEffects)[number]
export type AiVideoAgentTransitionDuration = (typeof aiVideoAgentTransitionDurations)[number]
export type AiVideoAgentVisualSource = (typeof aiVideoAgentVisualSources)[number]
export type AiVideoAgentGenerationMode = (typeof aiVideoAgentGenerationModes)[number]
export type AiVideoAgentLipSyncMode = (typeof aiVideoAgentLipSyncModes)[number]
export type AiVideoAgentStatus = (typeof aiVideoAgentStatuses)[number]
export type AiVideoAgentAssetType = (typeof aiVideoAgentAssetTypes)[number]

export type AiVideoAgentTimelineDialogue = {
  id: string
  startSeconds: number
  endSeconds: number
  text: string
  emotion?: string
  audioAssetId?: string
}

export type AiVideoAgentTimelineScene = {
  id: string
  index: number
  startSeconds: number
  endSeconds: number
  title: string
  visual: {
    source: AiVideoAgentVisualSource
    prompt: string
    uploadedAssetId?: string
    resolvedAssetId?: string
  }
  dialogues: AiVideoAgentTimelineDialogue[]
}

export type AiVideoAgentTimeline = {
  version: 2
  durationSeconds: number
  aspectRatio: AiVideoAgentAspectRatio
  scenes: AiVideoAgentTimelineScene[]
}

export type AiVideoAgentCaptionWord = {
  word: string
  start: number
  end: number
}

export type AiVideoAgentCaptionCue = {
  text: string
  start: number
  end: number
  words?: AiVideoAgentCaptionWord[]
}

export type AiVideoAgentSceneTransition = {
  sceneId: string
  sceneIndex: number
  effect: AiVideoAgentTransitionEffect
  fadeInSeconds: AiVideoAgentTransitionDuration
  fadeOutSeconds: AiVideoAgentTransitionDuration
}

export type AiVideoAgentScene = {
  id: string
  project_id: string
  user_id: string
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
  created_at: string
  updated_at: string
}

export type AiVideoAgentDialogue = {
  id: string
  project_id: string
  scene_id: string
  user_id: string
  dialogue_index: number
  start_seconds: number
  end_seconds: number
  text: string
  emotion: string
  audio_asset_id: string
  created_at: string
  updated_at: string
}

export type AiVideoAgentAsset = {
  id: string
  project_id: string
  scene_id: string | null
  user_id: string
  asset_type: AiVideoAgentAssetType
  provider: string
  url: string
  key: string
  content_type: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AiVideoAgentProject = {
  id: string
  user_id: string
  title: string
  script_mode: AiVideoAgentScriptMode
  topic: string
  script: string
  avatar_id: string
  avatar_name: string
  avatar_image_url: string
  avatar_source: string
  voice_id: string
  voice_name: string
  voice_source: "custom" | "default"
  provider_voice_id: string
  voice_audio_url: string
  duration_seconds: AiVideoAgentDuration
  aspect_ratio: AiVideoAgentAspectRatio
  caption_style: AiVideoAgentCaptionStyle
  b_roll_style: AiVideoAgentBRollStyle
  visual_style: AiVideoAgentVisualStyle
  presentation_format: AiVideoAgentPresentationFormat
  workflow_version: number
  timeline: AiVideoAgentTimeline | Record<string, unknown>
  generation_mode: AiVideoAgentGenerationMode
  lip_sync_mode: AiVideoAgentLipSyncMode
  caption_effect: AiVideoAgentCaptionEffect
  scene_count: number
  credits_cost: number
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
  created_at: string
  updated_at: string
}

export type AiVideoAgentJob = {
  id: string
  project_id: string
  user_id: string
  trigger_job_id: string | null
  status: AiVideoAgentStatus
  progress: number
  error_message: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AiVideoAgentComposition = {
  [key: string]: unknown
  id?: string
  title?: string
  durationSeconds?: number
  fps?: number
  width?: number
  height?: number
  aspectRatio?: AiVideoAgentAspectRatio
  captionStyle?: AiVideoAgentCaptionStyle
  captionEffect?: AiVideoAgentCaptionEffect
  bRollStyle?: AiVideoAgentBRollStyle
  visualStyle?: AiVideoAgentVisualStyle
  presentationFormat?: AiVideoAgentPresentationFormat
  sceneCount?: number
  captionEffects?: Record<string, AiVideoAgentCaptionEffect>
  timeline?: AiVideoAgentTimeline
  scenes?: Array<Record<string, unknown>>
  assets?: Array<Record<string, unknown>>
  captions?: AiVideoAgentCaptionCue[]
  audioUrl?: string
  finalVideoUrl?: string
  transitions?: AiVideoAgentSceneTransition[]
  layout?: Record<string, unknown>
}

export type AiVideoAgentProjectDetail = {
  project: AiVideoAgentProject
  scenes: AiVideoAgentScene[]
  dialogues: AiVideoAgentDialogue[]
  assets: AiVideoAgentAsset[]
  latestJob?: AiVideoAgentJob | null
  creditBalance: number | null
}

export type AiVideoAgentInitialData = {
  projects: AiVideoAgentProject[]
  avatars: AiAvatar[]
  voices: VoiceListItem[]
  creditBalance: number
}

export const aiVideoAgentCaptionStyleLabels: Record<AiVideoAgentCaptionStyle, string> = {
  clean_lower: "Clean Lower",
  cinematic_gold: "Cinematic Gold",
  neon_pop: "Neon Pop",
  editorial_stack: "Editorial Stack",
  minimal_box: "Minimal Box",
  karaoke_wave: "Karaoke Wave",
}

export const aiVideoAgentCaptionEffectLabels: Record<AiVideoAgentCaptionEffect, string> = {
  system_bold: "System Bold",
  rounded_sans: "Rounded Sans",
  serif_song: "Serif Song",
  gothic_hei: "Gothic Hei",
  mono_tech: "Mono Tech",
  handwritten_play: "Handwritten",
}

export const aiVideoAgentBRollStyleLabels: Record<AiVideoAgentBRollStyle, string> = {
  ai_images: "AI Images",
  stock: "Stock",
  ai_video: "AI Video",
  illustration_animation: "Illustration Animation",
}

export const aiVideoAgentVisualStyleLabels: Record<AiVideoAgentVisualStyle, string> = {
  "2d_cel": "2D Cel",
  "3d_blindbox_clay": "3D Blind Box / Clay",
  cyberpunk: "Cyberpunk",
  realistic_cinematic: "Realistic / Cinematic",
}

export const aiVideoAgentPresentationFormatLabels: Record<AiVideoAgentPresentationFormat, string> = {
  podcast: "Podcast",
  commentary: "Commentary",
  visual_novel: "Visual Novel",
  realistic: "Realistic",
}

export const aiVideoAgentTransitionEffectLabels: Record<AiVideoAgentTransitionEffect, string> = {
  none: "None",
  crossfade: "Crossfade",
  fade_to_black: "Fade to Black",
  slide: "Slide",
  wipe: "Wipe",
}

export function isAiVideoAgentDuration(value: unknown): value is AiVideoAgentDuration {
  return typeof value === "number" && aiVideoAgentDurations.includes(value as AiVideoAgentDuration)
}

export function isAiVideoAgentSceneCount(value: unknown): value is AiVideoAgentSceneCount {
  return typeof value === "number" && aiVideoAgentSceneCounts.includes(value as AiVideoAgentSceneCount)
}

export function isAiVideoAgentAspectRatio(value: unknown): value is AiVideoAgentAspectRatio {
  return typeof value === "string" && aiVideoAgentAspectRatios.includes(value as AiVideoAgentAspectRatio)
}

export function isAiVideoAgentScriptMode(value: unknown): value is AiVideoAgentScriptMode {
  return typeof value === "string" && aiVideoAgentScriptModes.includes(value as AiVideoAgentScriptMode)
}

export function isAiVideoAgentCaptionStyle(value: unknown): value is AiVideoAgentCaptionStyle {
  return typeof value === "string" && aiVideoAgentCaptionStyles.includes(value as AiVideoAgentCaptionStyle)
}

export function isAiVideoAgentCaptionEffect(value: unknown): value is AiVideoAgentCaptionEffect {
  return typeof value === "string" && aiVideoAgentCaptionEffects.includes(value as AiVideoAgentCaptionEffect)
}

export function isAiVideoAgentBRollStyle(value: unknown): value is AiVideoAgentBRollStyle {
  return typeof value === "string" && aiVideoAgentBRollStyles.includes(value as AiVideoAgentBRollStyle)
}

export function isAiVideoAgentVisualStyle(value: unknown): value is AiVideoAgentVisualStyle {
  return typeof value === "string" && aiVideoAgentVisualStyles.includes(value as AiVideoAgentVisualStyle)
}

export function isAiVideoAgentPresentationFormat(value: unknown): value is AiVideoAgentPresentationFormat {
  return typeof value === "string" && aiVideoAgentPresentationFormats.includes(value as AiVideoAgentPresentationFormat)
}

export function isAiVideoAgentTransitionEffect(value: unknown): value is AiVideoAgentTransitionEffect {
  return typeof value === "string" && aiVideoAgentTransitionEffects.includes(value as AiVideoAgentTransitionEffect)
}

export function isAiVideoAgentTransitionDuration(value: unknown): value is AiVideoAgentTransitionDuration {
  return typeof value === "number" && aiVideoAgentTransitionDurations.includes(value as AiVideoAgentTransitionDuration)
}

export function isAiVideoAgentVisualSource(value: unknown): value is AiVideoAgentVisualSource {
  return typeof value === "string" && aiVideoAgentVisualSources.includes(value as AiVideoAgentVisualSource)
}

export function getAiVideoAgentSceneCount(durationSeconds: AiVideoAgentDuration) {
  void durationSeconds
  return 1
}

export function getAiVideoAgentTotalDuration(durationSeconds: AiVideoAgentDuration, sceneCount: number) {
  return durationSeconds * Math.max(1, sceneCount)
}

export function getAiVideoAgentScriptLengthGuidance(durationSeconds: AiVideoAgentDuration, sceneCount = 1) {
  const totalDuration = getAiVideoAgentTotalDuration(durationSeconds, sceneCount)
  const guidance: Array<{
    maxSeconds: number
    maxCharacters: number
    maxCompletionTokens: number
    structure: string
    targetChineseCharacters: string
    targetWords: string
  }> = [
    {
      maxSeconds: 5,
      maxCharacters: 220,
      maxCompletionTokens: 180,
      structure: "one short sentence with a clear hook or punchline",
      targetChineseCharacters: "16 to 28 Chinese characters",
      targetWords: "10 to 16 English words",
    },
    {
      maxSeconds: 10,
      maxCharacters: 420,
      maxCompletionTokens: 260,
      structure: "two compact sentences with one concrete point and a clean ending",
      targetChineseCharacters: "30 to 55 Chinese characters",
      targetWords: "22 to 35 English words",
    },
    {
      maxSeconds: 15,
      maxCharacters: 620,
      maxCompletionTokens: 340,
      structure: "three concise sentences with a hook, development beat, and closing line",
      targetChineseCharacters: "45 to 82 Chinese characters",
      targetWords: "34 to 52 English words",
    },
    {
      maxSeconds: 30,
      maxCharacters: 900,
      maxCompletionTokens: 520,
      structure: "one tight paragraph with a hook, focused point, and closing line",
      targetChineseCharacters: "90 to 140 Chinese characters",
      targetWords: "65 to 85 English words",
    },
    {
      maxSeconds: 60,
      maxCharacters: 1600,
      maxCompletionTokens: 820,
      structure: "two short paragraphs with a hook, context, development, and takeaway",
      targetChineseCharacters: "180 to 280 Chinese characters",
      targetWords: "130 to 170 English words",
    },
  ]

  return guidance.find((item) => totalDuration <= item.maxSeconds) || guidance[guidance.length - 1]
}

export function getAiVideoAgentCreditCost(input: {
  bRollStyle?: AiVideoAgentBRollStyle
  durationSeconds: AiVideoAgentDuration
  sceneCount?: number
}) {
  void input.bRollStyle
  void input.durationSeconds
  return Math.max(1, input.sceneCount || 1) * 10
}

export function getAiVideoAgentStatusLabel(status: AiVideoAgentStatus) {
  const labels: Record<AiVideoAgentStatus, string> = {
    queued: "Queued",
    running: "Preparing",
    generating: "Generating",
    rendering: "Rendering",
    uploading: "Uploading",
    completed: "Completed",
    failed: "Failed",
  }

  return labels[status]
}

export function getAiVideoAgentDimensions(aspectRatio: AiVideoAgentAspectRatio) {
  return aspectRatio === "9:16" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }
}

export function getAiVideoAgentAvatarClipPlan(durationSeconds: AiVideoAgentDuration, sceneCount: number) {
  void durationSeconds
  return new Set(Array.from({ length: sceneCount }, (_, index) => index))
}

export function isAiVideoAgentTimeline(value: unknown): value is AiVideoAgentTimeline {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return Array.isArray(record.scenes)
}

export function normalizeAiVideoAgentTimeline(input: {
  aspectRatio: AiVideoAgentAspectRatio
  durationSeconds: AiVideoAgentDuration
  sceneCount?: number
  timeline?: unknown
  script?: string
}): AiVideoAgentTimeline {
  const sceneCount = input.sceneCount || getAiVideoAgentSceneCount(input.durationSeconds)
  const totalDuration = getAiVideoAgentTotalDuration(input.durationSeconds, sceneCount)
  const sourceScenes = isAiVideoAgentTimeline(input.timeline) ? input.timeline.scenes : []
  const fallbackScenes = sourceScenes.length
    ? sourceScenes
    : buildFallbackTimelineScenes(input.script || "", sceneCount, totalDuration)
  const sceneDuration = input.durationSeconds

  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const source = fallbackScenes[index] || fallbackScenes[fallbackScenes.length - 1]
    const startSeconds = clampTimelineSecond(
      Number(source?.startSeconds ?? index * sceneDuration),
      0,
      totalDuration
    )
    const nextStart = index < sceneCount - 1 ? (index + 1) * sceneDuration : totalDuration
    const endSeconds = clampTimelineSecond(
      Number(source?.endSeconds ?? nextStart),
      startSeconds + 0.5,
      totalDuration
    )
    const dialogues = normalizeTimelineDialogues({
      dialogues: source?.dialogues,
      sceneEnd: endSeconds,
      sceneIndex: index,
      sceneStart: startSeconds,
      script: input.script || "",
    })

    return {
      id: source?.id || `scene-${index + 1}`,
      index,
      startSeconds: Number(startSeconds.toFixed(2)),
      endSeconds: Number(Math.max(endSeconds, startSeconds + 0.5).toFixed(2)),
      title: source?.title?.trim() || `Scene ${index + 1}`,
      visual: {
        source: isAiVideoAgentVisualSource(source?.visual?.source) ? source.visual.source : "auto",
        prompt: source?.visual?.prompt?.trim() || dialogues.map((dialogue) => dialogue.text).join(" ").slice(0, 400),
        uploadedAssetId: source?.visual?.uploadedAssetId || undefined,
        resolvedAssetId: source?.visual?.resolvedAssetId || undefined,
      },
      dialogues,
    } satisfies AiVideoAgentTimelineScene
  })

  return {
    version: 2,
    durationSeconds: totalDuration,
    aspectRatio: input.aspectRatio,
    scenes,
  }
}

function normalizeTimelineDialogues(input: {
  dialogues?: AiVideoAgentTimelineDialogue[]
  sceneStart: number
  sceneEnd: number
  sceneIndex: number
  script: string
}) {
  const sourceDialogues = Array.isArray(input.dialogues) && input.dialogues.length
    ? input.dialogues
    : [{
        id: `dialogue-${input.sceneIndex + 1}-1`,
        startSeconds: input.sceneStart,
        endSeconds: input.sceneEnd,
        text: input.script.trim() || `Scene ${input.sceneIndex + 1}`,
      }]

  let previousEnd = input.sceneStart
  return sourceDialogues.map((dialogue, index) => {
    const start = clampTimelineSecond(Number(dialogue.startSeconds ?? previousEnd), input.sceneStart, input.sceneEnd)
    const end = clampTimelineSecond(Number(dialogue.endSeconds ?? input.sceneEnd), start + 0.25, input.sceneEnd)
    previousEnd = end

    return {
      id: dialogue.id || `dialogue-${input.sceneIndex + 1}-${index + 1}`,
      startSeconds: Number(start.toFixed(2)),
      endSeconds: Number(end.toFixed(2)),
      text: dialogue.text?.trim() || `Scene ${input.sceneIndex + 1}`,
      emotion: dialogue.emotion?.trim() || undefined,
      audioAssetId: dialogue.audioAssetId || undefined,
    }
  }).filter((dialogue) => dialogue.text)
}

function buildFallbackTimelineScenes(script: string, count: number, durationSeconds: number): AiVideoAgentTimelineScene[] {
  const sentences = script.split(/(?<=[.!?。！？])\s+/).filter(Boolean)
  const chunkSize = Math.max(1, Math.ceil(sentences.length / count))
  const sceneDuration = durationSeconds / count

  return Array.from({ length: count }, (_, index) => {
    const text = sentences.slice(index * chunkSize, (index + 1) * chunkSize).join(" ") || script || `Scene ${index + 1}`
    const startSeconds = Number((index * sceneDuration).toFixed(2))
    const endSeconds = Number(((index + 1) * sceneDuration).toFixed(2))
    return {
      id: `scene-${index + 1}`,
      index,
      startSeconds,
      endSeconds,
      title: `Scene ${index + 1}`,
      visual: {
        source: "auto",
        prompt: text.slice(0, 400),
      },
      dialogues: [{
        id: `dialogue-${index + 1}-1`,
        startSeconds,
        endSeconds,
        text,
      }],
    }
  })
}

function clampTimelineSecond(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
