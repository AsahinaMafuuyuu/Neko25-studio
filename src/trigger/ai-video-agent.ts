import { task } from "@trigger.dev/sdk/v3"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import ffmpegPath from "ffmpeg-static"

import {
  agnesVideoModel,
  createAgnesVideoTask,
  waitForAgnesVideoCompletion,
} from "../../lib/agnes-video-provider"
import {
  findGeneratedImage,
  getImageMakerApiErrorMessage,
  getImageMakerConfig,
  requestImageGeneration,
} from "../../lib/image-maker"
import { generateScriptGeneratorText } from "../../lib/script-generator"
import {
  createAiVideoAgentAsset,
  downloadRemoteBlob,
  getAiVideoAgentProject,
  listAiVideoAgentDialogues,
  listAiVideoAgentAssets,
  refundAiVideoAgentCreditsOnce,
  replaceAiVideoAgentDialogues,
  replaceAiVideoAgentScenes,
  toPublicUrl,
  updateAiVideoAgentDialogue,
  updateAiVideoAgentProject,
  uploadAiVideoAgentBlob,
  uploadAiVideoAgentJson,
} from "../../lib/ai-video-agent-server"
import {
  getAiVideoAgentAvatarClipPlan,
  getAiVideoAgentDimensions,
  getAiVideoAgentScriptLengthGuidance,
  getAiVideoAgentTotalDuration,
  normalizeAiVideoAgentTimeline,
  type AiVideoAgentAsset,
  type AiVideoAgentCaptionCue,
  type AiVideoAgentDialogue,
  type AiVideoAgentProject,
  type AiVideoAgentScene,
  type AiVideoAgentTimeline,
} from "../../lib/ai-video-agent"
import { findReplicateOutputUrl, runReplicatePrediction } from "../../lib/replicate-audio"
import { buildAiVideoAgentAvatarScenePrompt } from "../../prompts/ai-video-agent-avatar-scene.prompt"
import { buildAiVideoAgentBRollPrompt } from "../../prompts/ai-video-agent-broll.prompt"
import { buildAiVideoAgentScenePlanningMessages } from "../../prompts/ai-video-agent-scene-planning.prompt"
import { buildAiVideoAgentTopicScriptMessages } from "../../prompts/ai-video-agent-script.prompt"

type GeneratePayload = {
  projectId: string
  userId: string
}

type GeneratedScene = {
  title: string
  summary: string
  narration: string
  bRollRequest: string
  prompt: string
  keyword: string
}

const fps = 30

export const generateAiVideoAgent = task({
  id: "generate-ai-video-agent",
  maxDuration: 3600,
  catchError: ({ error }) => {
    if (isConfigurationError(error)) return { skipRetrying: true }
  },
  run: async (payload: GeneratePayload) => {
    const project = await requireProject(payload)

    try {
      await mark(project.id, "running", 14, "Preparing script and scene plan.")
      const script = project.script || await generateScriptFromTopic(project)

      await mark(project.id, "generating", 24, "Preparing editable timeline.")
      const timeline = await resolveProjectTimeline(project, script)
      const sceneRows = await saveTimelineScenes(project, timeline)
      await saveTimelineDialogues(project, timeline, sceneRows)

      await mark(project.id, "generating", 38, "Generating dialogue voice clips.")
      await generateDialogueAudios(project, await listAiVideoAgentDialogues(project.id, project.user_id))

      await mark(project.id, "generating", 52, "Preparing scene video channels.")

      await mark(project.id, "generating", 66, "Generating avatar-led scene videos.")
      const lipSyncMode = await generateAvatarSceneVideos(project, sceneRows, await listAiVideoAgentDialogues(project.id, project.user_id), timeline)

      const dialogueRows = await listAiVideoAgentDialogues(project.id, project.user_id)
      const captions = buildDialogueCaptions(dialogueRows)
      const captionsUpload = await uploadAiVideoAgentJson({
        data: captions,
        filename: "captions.json",
        folder: "captions",
        projectId: project.id,
        userId: project.user_id,
      })
      await createAiVideoAgentAsset({
        projectId: project.id,
        userId: project.user_id,
        assetType: "captions_json",
        provider: "deepgram",
        url: captionsUpload.url,
        key: captionsUpload.key,
        contentType: captionsUpload.contentType,
        metadata: { cueCount: captions.length },
      })

      await mark(project.id, "uploading", 82, "Creating Remotion composition.")
      const assets = await listAiVideoAgentAssets(project.id, project.user_id)
      const composition = buildComposition(project, sceneRows, dialogueRows, assets, captions, timeline)
      const compositionUpload = await uploadAiVideoAgentJson({
        data: composition,
        filename: "composition.json",
        folder: "composition",
        projectId: project.id,
        userId: project.user_id,
      })
      await createAiVideoAgentAsset({
        projectId: project.id,
        userId: project.user_id,
        assetType: "composition_json",
        provider: "remotion",
        url: compositionUpload.url,
        key: compositionUpload.key,
        contentType: compositionUpload.contentType,
        metadata: { durationSeconds: composition.durationSeconds },
      })

      const thumbnail = await createScenePreviewThumbnail(project, assets).catch(() => null)
      await updateAiVideoAgentProject(project.id, {
        status: "completed",
        progress: 100,
        message: "AI video preview is ready. Render the final video when you are ready to download.",
        error: "",
        captions,
        composition,
        timeline,
        lip_sync_mode: lipSyncMode,
        thumbnail_url: thumbnail?.url || project.avatar_image_url,
        thumbnail_key: thumbnail?.key || "",
      })

      return { projectId: project.id, composition }
    } catch (error) {
      await failProject(project, error, "AI video agent generation failed.")
      throw error
    }
  },
})

export const renderAiVideoAgent = task({
  id: "render-ai-video-agent",
  maxDuration: 3600,
  catchError: ({ error }) => {
    if (isConfigurationError(error)) return { skipRetrying: true }
  },
  run: async (payload: GeneratePayload) => {
    const project = await requireProject(payload)

    try {
      await mark(project.id, "rendering", 90, "Preparing Remotion renderer.")
      const renderResult = await renderComposition(project)
      const updateValues = {
        status: "completed" as const,
        progress: 100,
        message: "Final video render is ready.",
        final_video_url: renderResult.final.url,
        final_video_key: renderResult.final.key,
        error: "",
        composition: {
          ...project.composition,
          finalVideoUrl: renderResult.final.url,
        },
      }
      const updateWithThumbnail = renderResult.thumbnail
        ? { ...updateValues, thumbnail_url: renderResult.thumbnail.url, thumbnail_key: renderResult.thumbnail.key }
        : updateValues

      await updateAiVideoAgentProject(project.id, updateWithThumbnail)

      return { projectId: project.id, finalVideoUrl: renderResult.final.url }
    } catch (error) {
      await updateAiVideoAgentProject(project.id, {
        status: "failed",
        progress: 100,
        message: "Final video render failed.",
        error: getErrorMessage(error),
      }).catch(() => undefined)
      throw error
    }
  },
})

async function requireProject(payload: GeneratePayload) {
  const project = await getAiVideoAgentProject(payload.projectId, payload.userId)
  if (!project) throw new Error("AI video project not found.")
  return project
}

async function mark(projectId: string, status: AiVideoAgentProject["status"], progress: number, message: string) {
  await updateAiVideoAgentProject(projectId, { status, progress, message, error: "" })
}

async function generateScriptFromTopic(project: AiVideoAgentProject) {
  if (!project.topic.trim()) throw new Error("Topic is required to generate a script.")
  const lengthGuidance = getAiVideoAgentScriptLengthGuidance(project.duration_seconds, project.scene_count)
  const text = await generateScriptGeneratorText({
    errorLabel: "AI video agent topic script generation",
    maxCompletionTokens: lengthGuidance.maxCompletionTokens,
    messages: buildAiVideoAgentTopicScriptMessages({
      durationSeconds: getAiVideoAgentTotalDuration(project.duration_seconds, project.scene_count),
      maxCharacters: lengthGuidance.maxCharacters,
      presentationFormat: project.presentation_format,
      structure: lengthGuidance.structure,
      targetChineseCharacters: lengthGuidance.targetChineseCharacters,
      targetWords: lengthGuidance.targetWords,
      topic: project.topic,
    }),
    temperature: 0.65,
  })

  const script = text.slice(0, lengthGuidance.maxCharacters)
  await updateAiVideoAgentProject(project.id, { composition: { ...project.composition, generatedScript: script } })
  return script
}

async function resolveProjectTimeline(project: AiVideoAgentProject, script: string) {
  if (project.timeline && Object.keys(project.timeline).length) {
    return normalizeAiVideoAgentTimeline({
      aspectRatio: project.aspect_ratio,
      durationSeconds: project.duration_seconds,
      sceneCount: project.scene_count,
      script,
      timeline: project.timeline,
    })
  }

  const generatedScenes = await generateScenes(project, script)
  return normalizeAiVideoAgentTimeline({
    aspectRatio: project.aspect_ratio,
    durationSeconds: project.duration_seconds,
    sceneCount: project.scene_count,
    script,
    timeline: {
      version: 2,
      durationSeconds: project.duration_seconds,
      aspectRatio: project.aspect_ratio,
      scenes: generatedScenes.map((scene, index) => {
        const sceneDuration = project.duration_seconds
        const startSeconds = Number((index * sceneDuration).toFixed(2))
        const endSeconds = Number(((index + 1) * sceneDuration).toFixed(2))
        return {
          id: `scene-${index + 1}`,
          index,
          startSeconds,
          endSeconds,
          title: scene.title,
          visual: {
            source: "auto",
            prompt: scene.prompt || scene.bRollRequest || scene.summary,
          },
          dialogues: [{
            id: `dialogue-${index + 1}-1`,
            startSeconds,
            endSeconds,
            text: scene.narration || scene.summary,
          }],
        }
      }),
    },
  })
}

async function saveTimelineScenes(project: AiVideoAgentProject, timeline: AiVideoAgentTimeline) {
  return await replaceAiVideoAgentScenes({
    projectId: project.id,
    userId: project.user_id,
    scenes: timeline.scenes.map((scene, index) => ({
      scene_index: index,
      start_seconds: scene.startSeconds,
      end_seconds: scene.endSeconds,
      title: scene.title,
      summary: scene.visual.prompt,
      narration: scene.dialogues.map((dialogue) => dialogue.text).join(" "),
      caption_text: scene.dialogues.map((dialogue) => dialogue.text).join(" "),
      b_roll_request: scene.visual.prompt,
      prompt: scene.visual.prompt,
      keyword: scene.title,
      avatar_clip_required: true,
      remotion_scene: {
        index,
        layout: "avatar_primary",
        timelineSceneId: scene.id,
        visualSource: scene.visual.source,
      },
    })),
  })
}

async function saveTimelineDialogues(
  project: AiVideoAgentProject,
  timeline: AiVideoAgentTimeline,
  scenes: AiVideoAgentScene[]
) {
  const sceneByIndex = new Map(scenes.map((scene) => [scene.scene_index, scene]))
  return await replaceAiVideoAgentDialogues({
    projectId: project.id,
    userId: project.user_id,
    dialogues: timeline.scenes.flatMap((scene) => {
      const sceneRow = sceneByIndex.get(scene.index)
      if (!sceneRow) return []
      return scene.dialogues.map((dialogue, index) => ({
        scene_id: sceneRow.id,
        dialogue_index: index,
        start_seconds: dialogue.startSeconds,
        end_seconds: dialogue.endSeconds,
        text: dialogue.text,
        emotion: dialogue.emotion || "",
        audio_asset_id: dialogue.audioAssetId || "",
      }))
    }),
  })
}

async function generateScenes(project: AiVideoAgentProject, script: string): Promise<GeneratedScene[]> {
  const text = await generateScriptGeneratorText({
    errorLabel: "AI video agent scene planning",
    maxCompletionTokens: 2400,
    messages: buildAiVideoAgentScenePlanningMessages({
      presentationFormat: project.presentation_format,
      sceneCount: project.scene_count,
      script,
      visualStyle: project.visual_style,
    }),
    temperature: 0.65,
  })
  const parsed = parseJsonArray(text)
  const normalized = parsed.map((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {}
    return {
      title: readString(record.title) || "Scene",
      summary: readString(record.summary),
      narration: readString(record.narration),
      bRollRequest: readString(record.bRollRequest || record.b_roll_request || record.visual),
      prompt: readString(record.prompt),
      keyword: readString(record.keyword),
    }
  }).filter((scene) => scene.narration || scene.summary || scene.prompt)

  if (normalized.length) return fitSceneCount(normalized, project.scene_count)
  return deterministicScenes(script, project.scene_count)
}

async function saveScenes(project: AiVideoAgentProject, scenes: GeneratedScene[]) {
  const clipPlan = getAiVideoAgentAvatarClipPlan(project.duration_seconds, project.scene_count)
  const sceneDuration = project.duration_seconds
  return await replaceAiVideoAgentScenes({
    projectId: project.id,
    userId: project.user_id,
    scenes: scenes.map((scene, index) => ({
      scene_index: index,
      start_seconds: Number((index * sceneDuration).toFixed(2)),
      end_seconds: Number(((index + 1) * sceneDuration).toFixed(2)),
      title: scene.title,
      summary: scene.summary,
      narration: scene.narration,
      caption_text: scene.narration,
      b_roll_request: scene.bRollRequest,
      prompt: scene.prompt || scene.bRollRequest || scene.summary,
      keyword: scene.keyword || scene.title,
      avatar_clip_required: clipPlan.has(index),
      remotion_scene: {
        index,
        title: scene.title,
        layout: clipPlan.has(index) ? "avatar_overlay" : "b_roll_full",
      },
    })),
  })
}

async function generateVoiceover(project: AiVideoAgentProject, script: string) {
  const blob = project.voice_source === "default"
    ? await generateDeepgramTtsBlob(script, project.provider_voice_id)
    : await generateCustomVoiceBlob(project, script)
  const upload = await uploadAiVideoAgentBlob({
    blob,
    filename: `${project.id}-voiceover.${blob.type.includes("mpeg") ? "mp3" : "wav"}`,
    folder: "voiceover",
    projectId: project.id,
    userId: project.user_id,
  })
  await createAiVideoAgentAsset({
    projectId: project.id,
    userId: project.user_id,
    assetType: "voiceover",
    provider: project.voice_source === "default" ? "deepgram" : "replicate",
    url: upload.url,
    key: upload.key,
    contentType: upload.contentType,
    metadata: { voiceName: project.voice_name },
  })
  return { ...upload, blob }
}

async function generateDialogueAudios(project: AiVideoAgentProject, dialogues: AiVideoAgentDialogue[]) {
  const pendingDialogues = dialogues.filter((dialogue) => !dialogue.audio_asset_id)

  if (project.voice_source === "default") {
    await Promise.all(pendingDialogues.map((dialogue) => generateDialogueAudio(project, dialogue)))
    return
  }

  for (const dialogue of pendingDialogues) {
    await generateDialogueAudio(project, dialogue)
  }
}

async function generateDialogueAudio(project: AiVideoAgentProject, dialogue: AiVideoAgentDialogue) {
  const blob = project.voice_source === "default"
    ? await generateDeepgramTtsBlob(dialogue.text, project.provider_voice_id)
    : await generateCustomVoiceBlobWithRetry(project, dialogue.text)
  const upload = await uploadAiVideoAgentBlob({
    blob,
    filename: `${dialogue.id}-dialogue.${blob.type.includes("mpeg") ? "mp3" : "wav"}`,
    folder: "dialogue-audio",
    projectId: project.id,
    userId: project.user_id,
  })
  const asset = await createAiVideoAgentAsset({
    projectId: project.id,
    sceneId: dialogue.scene_id,
    userId: project.user_id,
    assetType: "dialogue_audio",
    provider: project.voice_source === "default" ? "deepgram" : "replicate",
    url: upload.url,
    key: upload.key,
    contentType: upload.contentType,
    metadata: {
      dialogueId: dialogue.id,
      endSeconds: dialogue.end_seconds,
      startSeconds: dialogue.start_seconds,
      text: dialogue.text,
      voiceName: project.voice_name,
    },
  })
  if (asset?.id) await updateAiVideoAgentDialogue(dialogue.id, { audio_asset_id: asset.id })
}

async function generateDeepgramTtsBlob(text: string, providerVoiceId: string) {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim()
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not configured.")
  if (!providerVoiceId) throw new Error("Choose a valid Deepgram voice.")

  const url = new URL("https://api.deepgram.com/v1/speak")
  url.searchParams.set("model", providerVoiceId)
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 240)
    throw new Error(`Deepgram TTS failed (${response.status}). ${body}`)
  }

  const contentType = response.headers.get("content-type") || "audio/wav"
  return new Blob([await response.arrayBuffer()], { type: contentType })
}

async function generateCustomVoiceBlob(project: AiVideoAgentProject, text: string) {
  if (!project.voice_audio_url) throw new Error("Custom voice reference audio is missing.")
  const prediction = await runReplicatePrediction({
    model: process.env.REPLICATE_QWEN_TTS_MODEL?.trim() || "qwen/qwen3-tts",
    input: {
      mode: "voice_clone",
      speaker: process.env.REPLICATE_QWEN_TTS_SPEAKER?.trim() || "Aiden",
      language: "auto",
      reference_audio: project.voice_audio_url,
      text,
    },
  })
  const outputUrl = findReplicateOutputUrl(prediction.output)
  if (!outputUrl) throw new Error("Replicate custom voice did not return an audio URL.")
  return (await downloadRemoteBlob(outputUrl)).blob
}

async function generateCustomVoiceBlobWithRetry(project: AiVideoAgentProject, text: string) {
  const maxAttempts = 4
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await generateCustomVoiceBlob(project, text)
    } catch (error) {
      if (attempt >= maxAttempts || !isReplicateThrottleError(error)) throw error
      await sleep(getReplicateThrottleDelayMs(error))
    }
  }

  throw new Error("Replicate custom voice retry loop exited unexpectedly.")
}

function isReplicateThrottleError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes("throttled") || message.includes("rate limit")
}

function getReplicateThrottleDelayMs(error: unknown) {
  const message = getErrorMessage(error)
  const secondsMatch = message.match(/~?(\d+(?:\.\d+)?)s\b/i)
  const seconds = secondsMatch ? Number(secondsMatch[1]) : 10
  return Math.max(10_000, Math.ceil((Number.isFinite(seconds) ? seconds : 10) * 1000) + 1500)
}

async function generateCaptions(project: AiVideoAgentProject, audio: Blob, script: string): Promise<AiVideoAgentCaptionCue[]> {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim()
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not configured.")

  const url = new URL("https://api.deepgram.com/v1/listen")
  url.searchParams.set("model", "nova-3")
  url.searchParams.set("smart_format", "true")
  url.searchParams.set("punctuate", "true")
  url.searchParams.set("utterances", "true")
  url.searchParams.set("words", "true")
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": audio.type || "audio/mpeg",
    },
    body: audio,
  })

  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 240)
    throw new Error(`Deepgram captions failed (${response.status}). ${body}`)
  }

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  const cues = readDeepgramCues(body)
  if (cues.length) return cues
  return deterministicCaptions(script, project.duration_seconds)
}

async function generateAvatarClips(project: AiVideoAgentProject, scenes: AiVideoAgentScene[]) {
  for (const scene of scenes.filter((item) => item.avatar_clip_required)) {
    const providerTask = await createAgnesVideoTask({
      imageUrl: toPublicUrl(project.avatar_image_url),
      prompt: `${scene.narration}\n\nCreate a natural presenter clip for this scene.`,
      aspectRatio: project.aspect_ratio,
      durationSeconds: 5,
    })
    const completed = await waitForAgnesVideoCompletion({
      taskId: providerTask.taskId,
      videoId: providerTask.videoId,
    })
    const asset = await downloadRemoteBlob(completed.videoUrl)
    const upload = await uploadAiVideoAgentBlob({
      blob: asset.blob,
      filename: asset.filename || `${scene.id}-avatar.mp4`,
      folder: "avatar-clips",
      projectId: project.id,
      userId: project.user_id,
    })
    await createAiVideoAgentAsset({
      projectId: project.id,
      sceneId: scene.id,
      userId: project.user_id,
      assetType: "avatar_clip",
      provider: "agnes",
      url: upload.url,
      key: upload.key,
      contentType: upload.contentType,
      metadata: { providerTaskId: completed.taskId, providerVideoId: completed.videoId },
    })
  }
}

async function generateSceneVisuals(
  project: AiVideoAgentProject,
  scenes: AiVideoAgentScene[],
  timeline: AiVideoAgentTimeline
) {
  const timelineByIndex = new Map(timeline.scenes.map((scene) => [scene.index, scene]))
  await Promise.all(scenes.map(async (scene) => {
    const timelineScene = timelineByIndex.get(scene.scene_index)
    const source = timelineScene?.visual.source || visualSourceFromBRollStyle(project)
    if (source === "pixabay") {
      await saveStockMedia(project, scene, "scene_image")
      return
    }
    if (source === "ai") {
      await saveAiImageBRoll(project, scene, "scene_image")
      return
    }
    if (source === "upload" && timelineScene?.visual.uploadedAssetId) {
      return
    }

    await saveAiImageBRoll(project, scene, "scene_image").catch(async () => {
      await saveStockMedia(project, scene, "scene_image")
    })
  }))
}

function visualSourceFromBRollStyle(project: AiVideoAgentProject) {
  return project.b_roll_style === "stock" ? "pixabay" : "ai"
}

async function generateAvatarSceneVideos(
  project: AiVideoAgentProject,
  scenes: AiVideoAgentScene[],
  dialogues: AiVideoAgentDialogue[],
  timeline: AiVideoAgentTimeline
) {
  const dialoguesByScene = groupBy(dialogues, (dialogue) => dialogue.scene_id)
  const timelineByIndex = new Map(timeline.scenes.map((scene) => [scene.index, scene]))
  let usedFallback = false

  await Promise.all(scenes.map(async (scene) => {
    const sceneDialogues = dialoguesByScene.get(scene.id) || []
    const sceneAudio = await createSceneAudioAsset(project, scene, sceneDialogues).catch(() => null)
    const prompt = buildAvatarScenePrompt(project, scene, timelineByIndex.get(scene.scene_index), sceneDialogues)
    const apiKey = getVideoGeneratorChannelApiKey(scene.scene_index)
    const model = process.env.VIDEO_GENERATOR_MODEL?.trim() || agnesVideoModel
    let completed = null

    if (sceneAudio?.url) {
      try {
        const providerTask = await createAgnesVideoTask({
          apiKey,
          imageUrl: toPublicUrl(project.avatar_image_url),
          audioUrl: sceneAudio.url,
          prompt,
          aspectRatio: project.aspect_ratio,
          durationSeconds: Math.max(5, Math.ceil(Number(scene.end_seconds) - Number(scene.start_seconds))),
        })
        completed = await waitForAgnesVideoCompletion({
          apiKey,
          model,
          taskId: providerTask.taskId,
          videoId: providerTask.videoId,
        })
      } catch {
        usedFallback = true
      }
    }

    if (!completed) {
      const providerTask = await createAgnesVideoTask({
        apiKey,
        imageUrl: toPublicUrl(project.avatar_image_url),
        prompt,
        aspectRatio: project.aspect_ratio,
        durationSeconds: Math.max(5, Math.ceil(Number(scene.end_seconds) - Number(scene.start_seconds))),
      })
      completed = await waitForAgnesVideoCompletion({
        apiKey,
        model,
        taskId: providerTask.taskId,
        videoId: providerTask.videoId,
      })
      usedFallback = true
    }

    const asset = await downloadRemoteBlob(completed.videoUrl)
    const upload = await uploadAiVideoAgentBlob({
      blob: asset.blob,
      filename: asset.filename || `${scene.id}-avatar-scene.mp4`,
      folder: "avatar-scenes",
      projectId: project.id,
      userId: project.user_id,
    })
    await createAiVideoAgentAsset({
      projectId: project.id,
      sceneId: scene.id,
      userId: project.user_id,
      assetType: "avatar_scene_video",
      provider: "agnes",
      url: upload.url,
      key: upload.key,
      contentType: upload.contentType,
      metadata: {
        lipSyncMode: sceneAudio?.url && !usedFallback ? "audio_driven" : "fallback_text_only",
        providerTaskId: completed.taskId,
        providerVideoId: completed.videoId,
        sceneIndex: scene.scene_index,
        videoGeneratorChannel: scene.scene_index + 1,
      },
    })
  }))

  return usedFallback ? "fallback_text_only" : "audio_driven"
}

function getVideoGeneratorChannelApiKey(sceneIndex: number) {
  const channel = Math.max(1, Math.min(4, sceneIndex + 1))
  const apiKey = process.env[`VIDEO_GENERATOR_CHANNEL${channel}_API_KEY`]?.trim()
  if (!apiKey) throw new Error(`VIDEO_GENERATOR_CHANNEL${channel}_API_KEY is not configured.`)
  return apiKey
}

function buildAvatarScenePrompt(
  project: AiVideoAgentProject,
  scene: AiVideoAgentScene,
  timelineScene: AiVideoAgentTimeline["scenes"][number] | undefined,
  dialogues: AiVideoAgentDialogue[]
) {
  return buildAiVideoAgentAvatarScenePrompt({
    dialogues,
    presentationFormat: project.presentation_format,
    scene,
    timelineScene,
    visualStyle: project.visual_style,
  })
}

async function createSceneAudioAsset(
  project: AiVideoAgentProject,
  scene: AiVideoAgentScene,
  dialogues: AiVideoAgentDialogue[]
) {
  const audioAssets = await listAiVideoAgentAssets(project.id, project.user_id)
  const audioById = new Map(audioAssets.map((asset) => [asset.id, asset]))
  const dialogueAudioAssets = dialogues
    .map((dialogue) => audioById.get(dialogue.audio_asset_id))
    .filter(Boolean) as AiVideoAgentAsset[]

  if (!dialogueAudioAssets.length) return null
  if (dialogueAudioAssets.length === 1) return dialogueAudioAssets[0]
  if (!getFfmpegExecutablePath()) return dialogueAudioAssets[0]

  const workdir = await mkdtemp(join(tmpdir(), "kravix-ai-video-scene-audio-"))
  try {
    const inputPaths: string[] = []
    for (let index = 0; index < dialogueAudioAssets.length; index += 1) {
      const asset = await downloadRemoteBlob(dialogueAudioAssets[index].url)
      const inputPath = join(workdir, `input-${index}.audio`)
      await writeFile(inputPath, Buffer.from(await asset.blob.arrayBuffer()))
      inputPaths.push(inputPath)
    }

    const outputPath = join(workdir, "scene-audio.mp3")
    const args = [
      "-y",
      ...inputPaths.flatMap((inputPath) => ["-i", inputPath]),
      "-filter_complex",
      `${inputPaths.map((_, index) => `[${index}:a]`).join("")}concat=n=${inputPaths.length}:v=0:a=1[aout]`,
      "-map",
      "[aout]",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      outputPath,
    ]
    await runFfmpeg(args)
    const upload = await uploadAiVideoAgentBlob({
      blob: new Blob([await readFile(outputPath)], { type: "audio/mpeg" }),
      filename: `${scene.id}-scene-audio.mp3`,
      folder: "scene-audio",
      projectId: project.id,
      userId: project.user_id,
    })
    return upload
  } finally {
    await rm(workdir, { force: true, recursive: true }).catch(() => undefined)
  }
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const grouped = new Map<string, T[]>()
  for (const item of items) {
    const key = getKey(item)
    const current = grouped.get(key) || []
    current.push(item)
    grouped.set(key, current)
  }
  return grouped
}

async function generateBRoll(project: AiVideoAgentProject, scenes: AiVideoAgentScene[]) {
  for (const scene of scenes) {
    if (project.b_roll_style === "stock") {
      await saveStockMedia(project, scene)
    } else if (project.b_roll_style === "ai_video") {
      await saveAiVideoBRoll(project, scene)
    } else {
      await saveAiImageBRoll(project, scene)
    }
  }
}

async function saveStockMedia(
  project: AiVideoAgentProject,
  scene: AiVideoAgentScene,
  assetType: "b_roll_image" | "scene_image" = "b_roll_image"
) {
  const apiKey = process.env.PIXABAY_API_KEY?.trim()
  if (!apiKey) throw new Error("PIXABAY_API_KEY is not configured.")
  const url = new URL("https://pixabay.com/api/")
  url.searchParams.set("key", apiKey)
  url.searchParams.set("q", scene.keyword || scene.title)
  url.searchParams.set("image_type", "photo")
  url.searchParams.set("safesearch", "true")
  url.searchParams.set("per_page", "3")
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Pixabay request failed (${response.status}).`)
  const body = (await response.json().catch(() => ({}))) as { hits?: Array<{ largeImageURL?: string; webformatURL?: string }> }
  const mediaUrl = body.hits?.find((hit) => hit.largeImageURL || hit.webformatURL)
  const downloadUrl = mediaUrl?.largeImageURL || mediaUrl?.webformatURL || ""
  if (!downloadUrl) throw new Error("Pixabay did not return stock media.")
  const asset = await downloadRemoteBlob(downloadUrl)
  const upload = await uploadAiVideoAgentBlob({
    blob: asset.blob,
    filename: asset.filename || `${scene.id}-stock.jpg`,
    folder: "b-roll",
    projectId: project.id,
    userId: project.user_id,
  })
  await createAiVideoAgentAsset({
    projectId: project.id,
    sceneId: scene.id,
    userId: project.user_id,
    assetType,
    provider: "pixabay",
    url: upload.url,
    key: upload.key,
    contentType: upload.contentType,
    metadata: { keyword: scene.keyword },
  })
}

async function saveAiVideoBRoll(project: AiVideoAgentProject, scene: AiVideoAgentScene) {
  const apiKey = getAgnesBRollApiKey()
  const prompt = buildAiVideoBRollPrompt(project, scene)
  const providerTask = await createAgnesVideoTask({
    apiKey,
    prompt,
    aspectRatio: project.aspect_ratio,
    durationSeconds: 5,
  })
  const completed = await waitForAgnesVideoCompletion({
    apiKey,
    taskId: providerTask.taskId,
    videoId: providerTask.videoId,
  })
  const asset = await downloadRemoteBlob(completed.videoUrl)
  const upload = await uploadAiVideoAgentBlob({
    blob: asset.blob,
    filename: asset.filename || `${scene.id}-broll.mp4`,
    folder: "b-roll",
    projectId: project.id,
    userId: project.user_id,
  })
  await createAiVideoAgentAsset({
    projectId: project.id,
    sceneId: scene.id,
    userId: project.user_id,
    assetType: "b_roll_video",
    provider: "agnes",
    url: upload.url,
    key: upload.key,
    contentType: upload.contentType,
    metadata: {
      model: agnesVideoModel,
      prompt,
      providerTaskId: completed.taskId,
      providerVideoId: completed.videoId,
    },
  })
}

function getAgnesBRollApiKey() {
  const apiKey = process.env.AGNES_BROLL_API_KEY?.trim()
  if (!apiKey) throw new Error("AGNES_BROLL_API_KEY is not configured.")
  return apiKey
}

function buildAiVideoBRollPrompt(project: AiVideoAgentProject, scene: AiVideoAgentScene) {
  return buildAiVideoAgentBRollPrompt({
    presentationFormat: project.presentation_format,
    scene,
    visualStyle: project.visual_style,
  })
}

async function saveAiImageBRoll(
  project: AiVideoAgentProject,
  scene: AiVideoAgentScene,
  assetType: "b_roll_image" | "scene_image" = "b_roll_image"
) {
  const image = await generateImage(scene.prompt || scene.b_roll_request || scene.summary, project.aspect_ratio)
  const upload = await uploadAiVideoAgentBlob({
    blob: image,
    filename: `${scene.id}-broll.png`,
    folder: "b-roll",
    projectId: project.id,
    userId: project.user_id,
  })
  await createAiVideoAgentAsset({
    projectId: project.id,
    sceneId: scene.id,
    userId: project.user_id,
    assetType,
    provider: "image-maker",
    url: upload.url,
    key: upload.key,
    contentType: upload.contentType,
    metadata: { prompt: scene.prompt },
  })
}

async function generateImage(prompt: string, aspectRatio: string) {
  const config = getImageMakerConfig()
  const response = await requestImageGeneration({
    config,
    prompt: [
      prompt,
      `Create one ${aspectRatio} B-roll image for a professional generated video.`,
      "No text overlays, no watermarks.",
    ].join("\n"),
    size: aspectRatio === "9:16" ? "576x1024" : "1024x576",
  })
  if (!response.ok) {
    throw new Error(`Image maker B-roll failed for ${config.model} (${response.status}). ${getImageMakerApiErrorMessage(response)}`)
  }
  const image = await findGeneratedImage(response.body)
  if (!image) throw new Error(`Image maker model ${config.model} did not return an image.`)
  return new Blob([Buffer.from(image.base64, "base64")], { type: image.mimeType || "image/png" })
}

function buildComposition(
  project: AiVideoAgentProject,
  scenes: AiVideoAgentScene[],
  dialogues: AiVideoAgentDialogue[],
  assets: AiVideoAgentAsset[],
  captions: AiVideoAgentCaptionCue[],
  timeline: AiVideoAgentTimeline
) {
  const dimensions = getAiVideoAgentDimensions(project.aspect_ratio)
  const orderedScenes = [...scenes].sort(compareScenesForComposition)
  const dialoguesByScene = groupBy([...dialogues].sort(compareDialoguesForComposition), (dialogue) => dialogue.scene_id)
  const totalDuration = getAiVideoAgentTotalDuration(project.duration_seconds, project.scene_count)
  return {
    id: project.id,
    title: project.title,
    durationSeconds: totalDuration,
    fps,
    ...dimensions,
    aspectRatio: project.aspect_ratio,
    captionStyle: project.caption_style,
    captionEffect: project.caption_effect || "system_bold",
    captionEffects: Object.fromEntries(orderedScenes.map((scene) => [scene.id, project.caption_effect || "system_bold"])),
    bRollStyle: project.b_roll_style,
    visualStyle: project.visual_style,
    presentationFormat: project.presentation_format,
    sceneCount: project.scene_count,
    timeline,
    scenes: orderedScenes.map((scene) => ({
      id: scene.id,
      index: scene.scene_index,
      startSeconds: scene.start_seconds,
      endSeconds: scene.end_seconds,
      title: scene.title,
      narration: scene.narration,
      captionText: scene.caption_text,
      avatarClipRequired: scene.avatar_clip_required,
      dialogues: dialoguesByScene.get(scene.id) || [],
      assets: assets.filter((asset) => asset.scene_id === scene.id),
    })),
    assets,
    captions,
    transitions: orderedScenes.map((scene) => ({
      sceneId: scene.id,
      sceneIndex: scene.scene_index,
      effect: "crossfade" as const,
      fadeInSeconds: 0.5 as const,
      fadeOutSeconds: 0.5 as const,
    })),
    layout: {
      avatarPlacement: "lower-right",
      avatarMode: "primary",
      safeArea: project.aspect_ratio === "9:16" ? "mobile" : "desktop",
    },
  }
}

function buildDialogueCaptions(dialogues: AiVideoAgentDialogue[]): AiVideoAgentCaptionCue[] {
  return [...dialogues].sort(compareDialoguesForComposition).map((dialogue) => ({
    text: dialogue.text,
    start: Number(dialogue.start_seconds),
    end: Number(dialogue.end_seconds),
  })).filter((caption) => caption.text)
}

function compareScenesForComposition(a: AiVideoAgentScene, b: AiVideoAgentScene) {
  return (
    Number(a.start_seconds) - Number(b.start_seconds) ||
    Number(a.scene_index) - Number(b.scene_index) ||
    a.id.localeCompare(b.id)
  )
}

function compareDialoguesForComposition(a: AiVideoAgentDialogue, b: AiVideoAgentDialogue) {
  return (
    Number(a.start_seconds) - Number(b.start_seconds) ||
    Number(a.end_seconds) - Number(b.end_seconds) ||
    Number(a.dialogue_index) - Number(b.dialogue_index) ||
    a.id.localeCompare(b.id)
  )
}

async function renderComposition(project: AiVideoAgentProject) {
  const assets = await listAiVideoAgentAssets(project.id, project.user_id)
  const dialogues = await listAiVideoAgentDialogues(project.id, project.user_id)
  // Future extension: split generated scene audio into ambience and voice, then replace only the voice track with cloned TTS.
  const sceneVideoAssets = assets
    .filter((asset) => asset.asset_type === "avatar_scene_video")
    .sort((a, b) => Number(a.metadata?.sceneIndex || 0) - Number(b.metadata?.sceneIndex || 0))
  if (!sceneVideoAssets.length) throw new Error("No avatar scene videos are available for final render.")
  if (!getFfmpegExecutablePath()) throw new Error("ffmpeg executable is not available. Set FFMPEG_BIN or install ffmpeg-static.")

  const workdir = await mkdtemp(join(tmpdir(), "kravix-ai-video-agent-"))
  try {
    const videoInputs: string[] = []
    for (let index = 0; index < sceneVideoAssets.length; index += 1) {
      const downloaded = await downloadRemoteBlob(sceneVideoAssets[index].url)
      const inputPath = join(workdir, `scene-${index}.mp4`)
      await writeFile(inputPath, Buffer.from(await downloaded.blob.arrayBuffer()))
      videoInputs.push(inputPath)
    }

    const finalPath = join(workdir, "final.mp4")
    const dialogueAudioAssets = dialogues
      .map((dialogue) => ({
        dialogue,
        asset: assets.find((asset) => asset.id === dialogue.audio_asset_id),
      }))
      .filter((item): item is { dialogue: AiVideoAgentDialogue; asset: AiVideoAgentAsset } => Boolean(item.asset?.url))

    const audioPaths: string[] = []
    for (let index = 0; index < dialogueAudioAssets.length; index += 1) {
      const downloaded = await downloadRemoteBlob(dialogueAudioAssets[index].asset.url)
      const inputPath = join(workdir, `dialogue-${index}.audio`)
      await writeFile(inputPath, Buffer.from(await downloaded.blob.arrayBuffer()))
      audioPaths.push(inputPath)
    }

    const captions = Array.isArray(project.composition?.captions) && project.composition.captions.length
      ? project.composition.captions
      : project.captions
    const captionFiles = await writeCaptionTextFiles(workdir, captions || [])
    const processedVideoInputs: string[] = []
    for (let index = 0; index < videoInputs.length; index += 1) {
      const processedPath = join(workdir, `processed-scene-${index}.mp4`)
      const scene = findCompositionSceneForAsset(project.composition, sceneVideoAssets[index], index)
      const sceneStart = Number(scene?.startSeconds ?? index * project.duration_seconds)
      const duration = getSceneDurationSeconds(scene, project.duration_seconds)
      const transition = findCompositionTransition(project.composition, scene, sceneVideoAssets[index], index)
      const sceneCaptionFiles = captionFiles
        .filter((caption) => Number(caption.end) >= sceneStart && Number(caption.start) <= sceneStart + duration)
        .map((caption) => ({
          ...caption,
          start: Math.max(0, Number(caption.start) - sceneStart),
          end: Math.min(duration, Math.max(0, Number(caption.end) - sceneStart)),
        }))
        .filter((caption) => Number(caption.end) > Number(caption.start))

      await runFfmpeg([
        "-y",
        "-i",
        videoInputs[index],
        "-filter_complex",
        buildProcessedSceneVideoFilter({
          captions: sceneCaptionFiles,
          composition: project.composition,
          duration,
          project,
          scene,
          transition,
        }),
        "-map",
        "[vout]",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        processedPath,
      ])
      processedVideoInputs.push(processedPath)
    }

    const concatListPath = join(workdir, "videos.txt")
    await writeFile(concatListPath, processedVideoInputs.map((inputPath) => `file '${inputPath.replace(/'/g, "'\\''")}'`).join("\n"))
    const baseVideoPath = join(workdir, "base.mp4")
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c",
      "copy",
      baseVideoPath,
    ])

    const totalDuration = Number(project.composition?.durationSeconds || getAiVideoAgentTotalDuration(project.duration_seconds, project.scene_count))
    if (audioPaths.length) {
      const audioFilters = dialogueAudioAssets.map((item, index) => {
        const delayMs = Math.max(0, Math.round(Number(item.dialogue.start_seconds) * 1000))
        return `[${index + 1}:a]adelay=${delayMs}|${delayMs}[a${index}]`
      })
      const audioInputs = dialogueAudioAssets.map((_, index) => `[a${index}]`).join("")
      const audioLabel = "aout"
      await runFfmpeg([
        "-y",
        "-i",
        baseVideoPath,
        ...audioPaths.flatMap((inputPath) => ["-i", inputPath]),
        "-filter_complex",
        `${audioFilters.join(";")};${audioPaths.length === 1 ? `${audioInputs}anull[${audioLabel}]` : `${audioInputs}amix=inputs=${audioPaths.length}:normalize=0[${audioLabel}]`}`,
        "-map",
        "0:v",
        "-map",
        `[${audioLabel}]`,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        formatSeconds(totalDuration),
        "-movflags",
        "+faststart",
        finalPath,
      ])
    } else {
      await runFfmpeg([
        "-y",
        "-i",
        baseVideoPath,
        "-c",
        "copy",
        "-t",
        formatSeconds(totalDuration),
        "-movflags",
        "+faststart",
        finalPath,
      ])
    }

    const thumbnail = await uploadVideoFrameThumbnail({
      filename: `${project.id}-final-thumbnail.jpg`,
      metadata: { source: "final_video_first_frame" },
      project,
      sourcePath: finalPath,
    }).catch(() => null)
    const blob = new Blob([await readFile(finalPath)], { type: "video/mp4" })
    const upload = await uploadAiVideoAgentBlob({
      blob,
      filename: `${project.id}-final.mp4`,
      folder: "renders",
      projectId: project.id,
      userId: project.user_id,
    })
    await createAiVideoAgentAsset({
      projectId: project.id,
      userId: project.user_id,
      assetType: "final_render",
      provider: "remotion-ffmpeg",
      url: upload.url,
      key: upload.key,
      contentType: upload.contentType,
      metadata: { source: "timeline-render", sceneCount: sceneVideoAssets.length },
    })
    return { final: upload, thumbnail }
  } finally {
    await rm(workdir, { force: true, recursive: true }).catch(() => undefined)
  }
}

async function createScenePreviewThumbnail(project: AiVideoAgentProject, assets: AiVideoAgentAsset[]) {
  const sceneVideo = assets
    .filter((asset) => asset.asset_type === "avatar_scene_video")
    .sort((a, b) => Number(a.metadata?.sceneIndex || 0) - Number(b.metadata?.sceneIndex || 0))[0]
  if (!sceneVideo?.url) return null

  const workdir = await mkdtemp(join(tmpdir(), "kravix-ai-video-agent-thumb-"))
  try {
    const downloaded = await downloadRemoteBlob(sceneVideo.url)
    const inputPath = join(workdir, "scene-1.mp4")
    await writeFile(inputPath, Buffer.from(await downloaded.blob.arrayBuffer()))
    return await uploadVideoFrameThumbnail({
      filename: `${project.id}-scene-1-thumbnail.jpg`,
      metadata: { sceneIndex: Number(sceneVideo.metadata?.sceneIndex || 0), source: "scene_1_first_frame" },
      project,
      sceneId: sceneVideo.scene_id,
      sourcePath: inputPath,
    })
  } finally {
    await rm(workdir, { force: true, recursive: true }).catch(() => undefined)
  }
}

async function uploadVideoFrameThumbnail(input: {
  filename: string
  metadata: Record<string, unknown>
  project: AiVideoAgentProject
  sceneId?: string | null
  sourcePath: string
}) {
  const thumbnailPath = join(tmpdir(), `kravix-ai-video-agent-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`)
  try {
    await runFfmpeg(["-y", "-i", input.sourcePath, "-frames:v", "1", "-q:v", "2", thumbnailPath])
    const upload = await uploadAiVideoAgentBlob({
      blob: new Blob([await readFile(thumbnailPath)], { type: "image/jpeg" }),
      filename: input.filename,
      folder: "thumbnails",
      projectId: input.project.id,
      userId: input.project.user_id,
    })
    await createAiVideoAgentAsset({
      projectId: input.project.id,
      sceneId: input.sceneId,
      userId: input.project.user_id,
      assetType: "thumbnail",
      provider: "ffmpeg",
      url: upload.url,
      key: upload.key,
      contentType: upload.contentType,
      metadata: input.metadata,
    })
    return upload
  } finally {
    await rm(thumbnailPath, { force: true }).catch(() => undefined)
  }
}

async function writeCaptionTextFiles(workdir: string, captions: AiVideoAgentCaptionCue[]) {
  const output: Array<AiVideoAgentCaptionCue & { textFilePath: string }> = []
  for (let index = 0; index < captions.length; index += 1) {
    const caption = captions[index]
    if (!caption.text || Number(caption.end) <= Number(caption.start)) continue
    const textFilePath = join(workdir, `caption-${index}.txt`)
    await writeFile(textFilePath, caption.text.slice(0, 220), "utf8")
    output.push({ ...caption, textFilePath })
  }
  return output
}

function buildProcessedSceneVideoFilter(input: {
  captions: Array<AiVideoAgentCaptionCue & { textFilePath: string }>
  composition: AiVideoAgentProject["composition"]
  duration: number
  project: AiVideoAgentProject
  scene: Record<string, unknown> | undefined
  transition: { effect?: unknown; fadeInSeconds?: unknown; fadeOutSeconds?: unknown } | undefined
}) {
  const dimensions = getAiVideoAgentDimensions(input.project.aspect_ratio)
  const filters = buildFfmpegFilterChain("[0:v]", [
    `trim=duration=${formatSeconds(input.duration)}`,
    "setpts=PTS-STARTPTS",
    `scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=increase`,
    `crop=${dimensions.width}:${dimensions.height}`,
    `fps=${fps}`,
    "format=yuv420p",
    ...buildSceneTransitionFilters(input.transition, input.duration),
  ])
  let label = "vbase"
  const drawTextFilters = [`${filters}[${label}]`]

  for (let index = 0; index < input.captions.length; index += 1) {
    const nextLabel = `vtext${index}`
    drawTextFilters.push(`[${label}]${buildDrawTextFilter(input.project, input.composition, input.captions[index], dimensions, input.scene)}[${nextLabel}]`)
    label = nextLabel
  }
  drawTextFilters.push(`[${label}]null[vout]`)

  return drawTextFilters.join(";")
}

function findCompositionSceneForAsset(
  composition: AiVideoAgentProject["composition"],
  asset: AiVideoAgentAsset | undefined,
  index: number
) {
  const scenes = Array.isArray(composition?.scenes) ? composition.scenes : []
  return scenes.find((item) => String(item.id || "") === String(asset?.scene_id || ""))
    || scenes.find((item) => Number(item.index ?? item.sceneIndex ?? -1) === Number(asset?.metadata?.sceneIndex ?? index))
}

function findCompositionTransition(
  composition: AiVideoAgentProject["composition"],
  scene: Record<string, unknown> | undefined,
  asset: AiVideoAgentAsset | undefined,
  index: number
) {
  const transitions = Array.isArray(composition?.transitions) ? composition.transitions : []
  return transitions.find((item) => String(item.sceneId || "") === String(scene?.id || asset?.scene_id || ""))
    || transitions.find((item) => Number(item.sceneIndex) === Number(asset?.metadata?.sceneIndex ?? index))
}

function buildFinalVideoFilterPlan(input: {
  audioCount: number
  captions: Array<AiVideoAgentCaptionCue & { textFilePath: string }>
  composition: AiVideoAgentProject["composition"]
  dialogueAudioAssets: Array<{ dialogue: AiVideoAgentDialogue; asset: AiVideoAgentAsset }>
  project: AiVideoAgentProject
  sceneVideoAssets: AiVideoAgentAsset[]
  videoInputCount: number
}) {
  const dimensions = getAiVideoAgentDimensions(input.project.aspect_ratio)
  const filters: string[] = []
  const scenes = Array.isArray(input.composition?.scenes) ? input.composition.scenes : []
  const transitions = Array.isArray(input.composition?.transitions) ? input.composition.transitions : []

  input.sceneVideoAssets.forEach((asset, index) => {
    const scene = scenes.find((item) => String(item.id || "") === String(asset.scene_id || ""))
      || scenes.find((item) => Number(item.index ?? item.sceneIndex ?? -1) === Number(asset.metadata?.sceneIndex ?? index))
    const duration = getSceneDurationSeconds(scene, input.project.duration_seconds)
    const transition = transitions.find((item) => String(item.sceneId || "") === String(scene?.id || asset.scene_id || ""))
      || transitions.find((item) => Number(item.sceneIndex) === Number(asset.metadata?.sceneIndex ?? index))
    const transitionFilters = buildSceneTransitionFilters(transition, duration)
    filters.push(buildFfmpegFilterChain(`[${index}:v]`, [
      `trim=duration=${formatSeconds(duration)}`,
      "setpts=PTS-STARTPTS",
      `scale=${dimensions.width}:${dimensions.height}:force_original_aspect_ratio=increase`,
      `crop=${dimensions.width}:${dimensions.height}`,
      `fps=${fps}`,
      "format=yuv420p",
      ...transitionFilters,
    ], `[v${index}]`))
  })

  let videoLabel = "v0"
  if (input.videoInputCount > 1) {
    filters.push(`${Array.from({ length: input.videoInputCount }, (_, index) => `[v${index}]`).join("")}concat=n=${input.videoInputCount}:v=1:a=0[vcat]`)
    videoLabel = "vcat"
  }

  for (let index = 0; index < input.captions.length; index += 1) {
    const caption = input.captions[index]
    const nextLabel = `vcap${index}`
    filters.push(`[${videoLabel}]${buildDrawTextFilter(input.project, input.composition, caption, dimensions)}[${nextLabel}]`)
    videoLabel = nextLabel
  }

  let audioLabel = ""
  if (input.audioCount) {
    input.dialogueAudioAssets.forEach((item, index) => {
      const inputIndex = input.videoInputCount + index
      const delayMs = Math.max(0, Math.round(Number(item.dialogue.start_seconds) * 1000))
      filters.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs}[a${index}]`)
    })
    const audioInputs = Array.from({ length: input.audioCount }, (_, index) => `[a${index}]`).join("")
    audioLabel = "aout"
    filters.push(input.audioCount === 1
      ? `${audioInputs}anull[${audioLabel}]`
      : `${audioInputs}amix=inputs=${input.audioCount}:normalize=0[${audioLabel}]`)
  }

  return {
    audioLabel,
    filterComplex: filters.join(";"),
    videoLabel,
  }
}

function buildFfmpegFilterChain(inputLabel: string, filters: string[], outputLabel = "") {
  return `${inputLabel}${filters.filter(Boolean).join(",")}${outputLabel}`
}

function buildSceneTransitionFilters(
  transition: { effect?: unknown; fadeInSeconds?: unknown; fadeOutSeconds?: unknown } | undefined,
  duration: number
) {
  const effect = typeof transition?.effect === "string" ? transition.effect : "none"
  if (effect === "none") return []
  const maxFade = Math.max(0, duration / 2 - 0.05)
  const fadeIn = Math.min(maxFade, Math.max(0, Number(transition?.fadeInSeconds || 0)))
  const fadeOut = Math.min(maxFade, Math.max(0, Number(transition?.fadeOutSeconds || 0)))
  const filters: string[] = []
  if (fadeIn > 0) filters.push(`fade=t=in:st=0:d=${formatSeconds(fadeIn)}`)
  if (fadeOut > 0) filters.push(`fade=t=out:st=${formatSeconds(Math.max(0, duration - fadeOut))}:d=${formatSeconds(fadeOut)}`)
  return filters
}

function buildDrawTextFilter(
  project: AiVideoAgentProject,
  composition: AiVideoAgentProject["composition"],
  caption: AiVideoAgentCaptionCue & { textFilePath: string },
  dimensions: { width: number; height: number },
  sceneOverride?: Record<string, unknown>
) {
  const scene = sceneOverride || (composition.scenes || []).find((item) => {
    const start = Number(item.startSeconds || 0)
    const end = Number(item.endSeconds || start + project.duration_seconds)
    return Number(caption.start) >= start && Number(caption.start) <= end
  })
  const sceneId = String(scene?.id || "")
  const captionEffects = composition.captionEffects && typeof composition.captionEffects === "object"
    ? composition.captionEffects as Record<string, string>
    : {}
  const effect = String(captionEffects[sceneId] || composition.captionEffect || project.caption_effect)
  const style = getFfmpegCaptionStyle(composition.captionStyle || project.caption_style, effect, dimensions)
  const start = Number(caption.start)
  const end = Number(caption.end)
  const fade = Math.min(0.28, Math.max(0.08, (end - start) / 4))
  const fontFile = getCaptionFontFile(effect, caption.text)
  const options = [
    ...(fontFile ? [`fontfile='${escapeFfmpegFilterPath(fontFile)}'`] : []),
    `textfile='${escapeFfmpegFilterPath(caption.textFilePath)}'`,
    `fontcolor=${style.fontColor}`,
    `fontsize=${style.fontSize}`,
    `line_spacing=${style.lineSpacing}`,
    `x=(w-text_w)/2`,
    `y=h-text_h-${style.bottom}`,
    `alpha='if(lt(t\\,${formatSeconds(start + fade)})\\,(t-${formatSeconds(start)})/${formatSeconds(fade)}\\,if(gt(t\\,${formatSeconds(end - fade)})\\,(${formatSeconds(end)}-t)/${formatSeconds(fade)}\\,1))'`,
    `enable='between(t\\,${formatSeconds(start)}\\,${formatSeconds(end)})'`,
    `borderw=${style.borderWidth}`,
    `bordercolor=${style.borderColor}`,
    `shadowcolor=${style.shadowColor}`,
    `shadowx=${style.shadowX}`,
    `shadowy=${style.shadowY}`,
    ...(style.box ? [`box=1`, `boxcolor=${style.boxColor}`, `boxborderw=${style.boxBorderWidth}`] : []),
  ]

  return `drawtext=${options.join(":")}`
}

function getFfmpegCaptionStyle(style: string, effect: string, dimensions: { width: number; height: number }) {
  const landscape = dimensions.width > dimensions.height
  const base = {
    borderColor: "black@0.85",
    borderWidth: landscape ? 4 : 3,
    bottom: Math.round(dimensions.height * (landscape ? 0.12 : 0.15)),
    box: false,
    boxBorderWidth: 22,
    boxColor: "black@0.55",
    fontColor: "white",
    fontSize: Math.round(dimensions.width * (landscape ? 0.045 : 0.072)),
    lineSpacing: 10,
    shadowColor: "black@0.75",
    shadowX: 0,
    shadowY: 4,
  }
  const effectSize = effect === "mono_tech" ? Math.round(base.fontSize * 0.9) : base.fontSize
  if (style === "cinematic_gold") return { ...base, fontColor: "0xF8D66D", fontSize: effectSize }
  if (style === "neon_pop") return { ...base, borderColor: "0x67E8F9@0.95", borderWidth: landscape ? 5 : 4, box: true, boxColor: "0x080814@0.76", fontColor: "0xF5D0FE", fontSize: effectSize }
  if (style === "editorial_stack") return { ...base, borderWidth: 0, box: true, boxColor: "white@0.94", fontColor: "0x111827", fontSize: Math.round(base.fontSize * 0.78), shadowColor: "black@0" }
  if (style === "minimal_box") return { ...base, borderWidth: 0, box: true, boxColor: "black@0.72", fontSize: Math.round(base.fontSize * 0.82) }
  if (style === "karaoke_wave") return { ...base, fontColor: "0x7DD3FC", fontSize: effectSize, shadowColor: "0x2DD4BF@0.72" }
  return { ...base, fontSize: effectSize }
}

function getCaptionFontFile(effect: string, text = "") {
  const scriptCandidates = getCaptionScriptFontCandidates(text)
  const candidatesByEffect: Record<string, string[]> = {
    gothic_hei: ["C:/Windows/Fonts/simhei.ttf", "C:/Windows/Fonts/msyh.ttc"],
    handwritten_play: ["C:/Windows/Fonts/segoepr.ttf", "C:/Windows/Fonts/comic.ttf"],
    mono_tech: ["C:/Windows/Fonts/consolab.ttf", "C:/Windows/Fonts/consola.ttf"],
    rounded_sans: ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/trebucbd.ttf"],
    serif_song: ["C:/Windows/Fonts/simsun.ttc", "C:/Windows/Fonts/simkai.ttf"],
    system_bold: ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/msyhbd.ttc"],
  }
  const effectCandidates = candidatesByEffect[effect] || candidatesByEffect.system_bold
  return [
    ...scriptCandidates,
    ...effectCandidates,
    ...getCaptionScriptFontCandidates("multilingual fallback"),
  ].find((candidate) => existsSync(candidate)) || null
}

function getCaptionScriptFontCandidates(text: string) {
  const hasJapaneseKana = hasAnyCodePoint(text, [
    [0x3040, 0x30ff],
    [0x31f0, 0x31ff],
  ])
  const hasHangul = hasAnyCodePoint(text, [
    [0xac00, 0xd7af],
    [0x1100, 0x11ff],
    [0x3130, 0x318f],
  ])
  const hasHan = hasAnyCodePoint(text, [
    [0x3400, 0x4dbf],
    [0x4e00, 0x9fff],
    [0xf900, 0xfaff],
    [0x20000, 0x2ebef],
  ])

  if (hasHangul && (hasHan || hasJapaneseKana)) {
    return [
      "C:/Windows/Fonts/malgunbd.ttf",
      "C:/Windows/Fonts/malgun.ttf",
      "C:/Windows/Fonts/msyhbd.ttc",
      "C:/Windows/Fonts/YuGothB.ttc",
    ]
  }

  if (hasJapaneseKana) {
    return [
      "C:/Windows/Fonts/YuGothB.ttc",
      "C:/Windows/Fonts/YuGothM.ttc",
      "C:/Windows/Fonts/msgothic.ttc",
      "C:/Windows/Fonts/meiryob.ttc",
      "C:/Windows/Fonts/meiryo.ttc",
      "C:/Windows/Fonts/msyhbd.ttc",
    ]
  }

  if (hasHangul) {
    return [
      "C:/Windows/Fonts/malgunbd.ttf",
      "C:/Windows/Fonts/malgun.ttf",
      "C:/Windows/Fonts/msyhbd.ttc",
    ]
  }

  if (hasHan) {
    return [
      "C:/Windows/Fonts/msyhbd.ttc",
      "C:/Windows/Fonts/msyh.ttc",
      "C:/Windows/Fonts/simhei.ttf",
      "C:/Windows/Fonts/simsun.ttc",
    ]
  }

  if (hasAnyCodePoint(text, [[0x0e00, 0x0e7f]])) {
    return [
      "C:/Windows/Fonts/LeelaUIb.ttf",
      "C:/Windows/Fonts/LeelawUI.ttf",
      "C:/Windows/Fonts/LEELAWDB.TTF",
      "C:/Windows/Fonts/LEELAWAD.TTF",
      "C:/Windows/Fonts/tahomabd.ttf",
    ]
  }

  if (hasAnyCodePoint(text, [
    [0x0590, 0x05ff],
    [0x0600, 0x06ff],
    [0x0750, 0x077f],
    [0x08a0, 0x08ff],
  ])) {
    return [
      "C:/Windows/Fonts/tahomabd.ttf",
      "C:/Windows/Fonts/tahoma.ttf",
      "C:/Windows/Fonts/seguisb.ttf",
    ]
  }

  if (hasAnyCodePoint(text, [
    [0x0900, 0x097f],
    [0x0980, 0x09ff],
    [0x0a00, 0x0a7f],
    [0x0a80, 0x0aff],
    [0x0b00, 0x0b7f],
    [0x0b80, 0x0bff],
    [0x0c00, 0x0c7f],
    [0x0c80, 0x0cff],
    [0x0d00, 0x0d7f],
  ])) {
    return [
      "C:/Windows/Fonts/NirmalaB.ttf",
      "C:/Windows/Fonts/Nirmala.ttf",
      "C:/Windows/Fonts/seguisb.ttf",
    ]
  }

  return [
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/Arial.ttf",
    "C:/Windows/Fonts/msyhbd.ttc",
    "C:/Windows/Fonts/YuGothB.ttc",
    "C:/Windows/Fonts/malgunbd.ttf",
    "C:/Windows/Fonts/NirmalaB.ttf",
    "C:/Windows/Fonts/tahomabd.ttf",
  ]
}

function hasAnyCodePoint(text: string, ranges: Array<[number, number]>) {
  for (const character of text) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined && ranges.some(([start, end]) => codePoint >= start && codePoint <= end)) return true
  }
  return false
}

function getSceneDurationSeconds(scene: Record<string, unknown> | undefined, fallback: number) {
  const start = Number(scene?.startSeconds ?? scene?.start_seconds ?? 0)
  const end = Number(scene?.endSeconds ?? scene?.end_seconds ?? start + fallback)
  return Math.max(1, end - start)
}

function escapeFfmpegFilterPath(path: string) {
  return path.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'")
}

function formatSeconds(value: number) {
  return Number.isFinite(value) ? Math.max(0, value).toFixed(3) : "0.000"
}

async function failProject(project: AiVideoAgentProject, error: unknown, message: string) {
  await updateAiVideoAgentProject(project.id, {
    status: "failed",
    progress: 100,
    message,
    error: getErrorMessage(error),
  }).catch(() => undefined)
  await refundAiVideoAgentCreditsOnce({
    project,
    description: "Refund for failed AI Video Agent generation.",
  }).catch(() => undefined)
}

function parseJsonArray(text: string): unknown[] {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return []
    try {
      const parsed = JSON.parse(match[0])
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}

function deterministicScenes(script: string, count: number): GeneratedScene[] {
  const sentences = script.split(/(?<=[.!?。！？])\s+/).filter(Boolean)
  return Array.from({ length: count }, (_, index) => {
    const chunk = sentences.slice(index * Math.ceil(sentences.length / count), (index + 1) * Math.ceil(sentences.length / count)).join(" ") || script
    return {
      title: `Scene ${index + 1}`,
      summary: chunk.slice(0, 180),
      narration: chunk,
      bRollRequest: chunk.slice(0, 220),
      prompt: chunk.slice(0, 400),
      keyword: chunk.split(/\s+/).slice(0, 4).join(" ") || `scene ${index + 1}`,
    }
  })
}

function fitSceneCount(scenes: GeneratedScene[], count: number) {
  if (scenes.length === count) return scenes
  if (scenes.length > count) return scenes.slice(0, count)
  const output = [...scenes]
  while (output.length < count) {
    output.push({
      ...output[output.length - 1],
      title: `Scene ${output.length + 1}`,
    })
  }
  return output
}

function readDeepgramCues(source: Record<string, unknown>): AiVideoAgentCaptionCue[] {
  const results = source.results as Record<string, unknown> | undefined
  const channels = Array.isArray(results?.channels) ? results.channels : []
  const alternatives = channels[0] && typeof channels[0] === "object"
    ? ((channels[0] as Record<string, unknown>).alternatives as unknown[])
    : []
  const words = alternatives?.[0] && typeof alternatives[0] === "object"
    ? ((alternatives[0] as Record<string, unknown>).words as unknown[])
    : []
  if (!Array.isArray(words) || !words.length) return []

  const cues: AiVideoAgentCaptionCue[] = []
  for (let index = 0; index < words.length; index += 8) {
    const chunk = words.slice(index, index + 8).map((word) => word as Record<string, unknown>)
    const text = chunk.map((word) => readString(word.word || word.punctuated_word)).filter(Boolean).join(" ")
    const start = Number(chunk[0]?.start || 0)
    const end = Number(chunk[chunk.length - 1]?.end || start + 2)
    if (text) cues.push({ text, start, end })
  }
  return cues
}

function deterministicCaptions(script: string, durationSeconds: number): AiVideoAgentCaptionCue[] {
  const words = script.split(/\s+/).filter(Boolean)
  const chunkSize = 8
  const cueCount = Math.max(1, Math.ceil(words.length / chunkSize))
  return Array.from({ length: cueCount }, (_, index) => {
    const start = (durationSeconds / cueCount) * index
    const end = (durationSeconds / cueCount) * (index + 1)
    return {
      text: words.slice(index * chunkSize, (index + 1) * chunkSize).join(" "),
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
    }
  }).filter((cue) => cue.text)
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const executable = getFfmpegExecutablePath()
    if (!executable) {
      reject(new Error("ffmpeg executable is not available. Set FFMPEG_BIN or install ffmpeg-static."))
      return
    }

    const stderrChunks: Buffer[] = []
    const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] })
    child.stderr?.on("data", (chunk) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    })
    child.once("error", reject)
    child.once("close", (code) => {
      if (code === 0) resolve()
      else {
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim()
        reject(new Error(`ffmpeg exited with code ${code}.${stderr ? ` ${stderr.slice(-1600)}` : ""}`))
      }
    })
  })
}

function getFfmpegExecutablePath() {
  const executableName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  const candidates = [
    process.env.FFMPEG_BIN,
    process.env.FFMPEG_PATH,
    ffmpegPath,
    join(process.cwd(), "node_modules", "ffmpeg-static", executableName),
  ].filter((candidate): candidate is string => Boolean(candidate))

  return candidates.find((candidate) => existsSync(candidate)) || null
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    return String(record.message || record.error || "Unknown AI video agent error.")
  }
  return "Unknown AI video agent error."
}

function isConfigurationError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return message.includes("is not configured") || message.includes("must be formatted")
}
