import { tasks } from "@trigger.dev/sdk/v3"

import {
  avatarErrorStatus,
  createAiVideoAgentJob,
  createAiVideoAgentProject,
  deductCredits,
  ensureCreditBalance,
  getAiVideoAgentInitialData,
  jsonError,
  refundAiVideoAgentCreditsOnce,
  requireBearerToken,
  requireCurrentUserId,
  resolveAiVideoAgentInputs,
  updateAiVideoAgentProject,
} from "@/lib/ai-video-agent-server"
import {
  getAiVideoAgentCreditCost,
  isAiVideoAgentAspectRatio,
  isAiVideoAgentBRollStyle,
  isAiVideoAgentCaptionEffect,
  isAiVideoAgentCaptionStyle,
  isAiVideoAgentDuration,
  isAiVideoAgentPresentationFormat,
  isAiVideoAgentSceneCount,
  isAiVideoAgentScriptMode,
  isAiVideoAgentVisualStyle,
  normalizeAiVideoAgentTimeline,
  type AiVideoAgentProject,
} from "@/lib/ai-video-agent"

const maxScriptCharacters = 12000
const maxTopicCharacters = 800

export async function GET(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const data = await getAiVideoAgentInitialData(userId, accessToken)

    return Response.json(data)
  } catch (error) {
    return jsonError(error, "Could not load AI video agent data.", avatarErrorStatus(error))
  }
}

export async function POST(request: Request) {
  let createdProject: AiVideoAgentProject | null = null
  let creditsDeducted = false
  let accessToken = ""

  try {
    accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as {
      title?: string
      scriptMode?: string
      topic?: string
      script?: string
      avatarId?: string
      voiceId?: string
      durationSeconds?: number
      aspectRatio?: string
      captionStyle?: string
      captionEffect?: string
      bRollStyle?: string
      sceneCount?: number
      visualStyle?: string
      presentationFormat?: string
      timeline?: unknown
    }

    const title = typeof body.title === "string" ? body.title.trim() : ""
    const scriptMode = isAiVideoAgentScriptMode(body.scriptMode) ? body.scriptMode : "manual"
    const topic = typeof body.topic === "string" ? body.topic.trim() : ""
    const script = typeof body.script === "string" ? body.script.trim() : ""
    const avatarId = typeof body.avatarId === "string" ? body.avatarId.trim() : ""
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : ""
    const durationSeconds = Number(body.durationSeconds)
    const sceneCount = Number(body.sceneCount)

    if (!title) return Response.json({ message: "Video name is required." }, { status: 400 })
    if (!avatarId) return Response.json({ message: "Choose an avatar." }, { status: 400 })
    if (!voiceId) return Response.json({ message: "Choose a voice." }, { status: 400 })
    if (scriptMode === "manual" && !script) return Response.json({ message: "Script is required." }, { status: 400 })
    if (scriptMode === "topic" && !topic && !script) return Response.json({ message: "Topic is required." }, { status: 400 })
    if (script.length > maxScriptCharacters) return Response.json({ message: "Script is too long." }, { status: 400 })
    if (topic.length > maxTopicCharacters) return Response.json({ message: "Topic is too long." }, { status: 400 })
    if (!isAiVideoAgentDuration(durationSeconds)) return Response.json({ message: "Choose a supported duration." }, { status: 400 })
    if (!isAiVideoAgentSceneCount(sceneCount)) return Response.json({ message: "Choose a supported scene count." }, { status: 400 })
    if (!isAiVideoAgentAspectRatio(body.aspectRatio)) return Response.json({ message: "Choose a supported screen size." }, { status: 400 })
    if (!isAiVideoAgentCaptionStyle(body.captionStyle)) return Response.json({ message: "Choose a supported caption style." }, { status: 400 })
    const captionEffect = isAiVideoAgentCaptionEffect(body.captionEffect) ? body.captionEffect : "system_bold"
    const bRollStyle = isAiVideoAgentBRollStyle(body.bRollStyle) ? body.bRollStyle : "ai_video"
    if (!isAiVideoAgentVisualStyle(body.visualStyle)) return Response.json({ message: "Choose a supported visual style." }, { status: 400 })
    if (!isAiVideoAgentPresentationFormat(body.presentationFormat)) return Response.json({ message: "Choose a supported presentation format." }, { status: 400 })

    const { avatar, voice } = await resolveAiVideoAgentInputs({ avatarId, voiceId, userId })
    const creditsCost = getAiVideoAgentCreditCost({
      bRollStyle,
      durationSeconds,
      sceneCount,
    })
    const timeline = normalizeAiVideoAgentTimeline({
      aspectRatio: body.aspectRatio,
      durationSeconds,
      sceneCount,
      script,
      timeline: body.timeline,
    })
    const timelineScript = timeline.scenes.flatMap((scene) => scene.dialogues).map((dialogue) => dialogue.text).join("\n")

    const project = await createAiVideoAgentProject({
      accessToken,
      userId,
      title,
      scriptMode,
      topic,
      script: script || timelineScript,
      avatarId: avatar.id,
      avatarName: avatar.name,
      avatarImageUrl: avatar.desktop_image_url || avatar.image_url,
      avatarSource: avatar.source,
      voiceId: voice.id,
      voiceName: voice.name,
      voiceSource: voice.source,
      providerVoiceId: voice.providerVoiceId,
      voiceAudioUrl: voice.voiceAudioUrl,
      durationSeconds,
      aspectRatio: body.aspectRatio,
      captionStyle: body.captionStyle,
      bRollStyle,
      visualStyle: body.visualStyle,
      presentationFormat: body.presentationFormat,
      workflowVersion: 2,
      timeline,
      generationMode: "scene_segments",
      lipSyncMode: "compatible",
      captionEffect,
      sceneCount,
      creditsCost,
    })
    createdProject = project

    const creditBalance = creditsCost > 0
      ? await deductCredits({
          userId,
          amount: creditsCost,
          description: "AI Video Agent generation.",
          referenceType: "ai_video_v2_projects",
          referenceId: project.id,
        })
      : await ensureCreditBalance(userId)
    creditsDeducted = creditsCost > 0

    const handle = await tasks.trigger(
      "generate-ai-video-agent",
      { projectId: project.id, userId },
      { tags: [`user:${userId}`, `ai-video-agent:${project.id}`] }
    )
    await createAiVideoAgentJob({
      projectId: project.id,
      userId,
      triggerJobId: handle.id,
      status: "queued",
      progress: 5,
      message: "Queued for AI video agent generation.",
      kind: "generation",
    })
    const updatedProject = await updateAiVideoAgentProject(project.id, {
      trigger_run_id: handle.id,
      status: "running",
      progress: 10,
      message: "AI video agent generation has started.",
    }, accessToken)

    return Response.json({ project: updatedProject || project, runId: handle.id, creditBalance })
  } catch (error) {
    console.error("AI Video Agent POST failed.", error)

    if (createdProject) {
      await updateAiVideoAgentProject(createdProject.id, {
        status: "failed",
        progress: 100,
        message: "AI video agent generation could not start.",
        error: error instanceof Error ? error.message : "Could not start generation.",
      }, accessToken).catch(() => undefined)
    }

    if (creditsDeducted && createdProject) {
      await refundAiVideoAgentCreditsOnce({
        project: createdProject,
        description: "Refund for failed AI Video Agent start.",
      }).catch(() => undefined)
    }

    return jsonError(error, "Could not start AI video agent generation.", aiVideoAgentPostErrorStatus(error))
  }
}

function aiVideoAgentPostErrorStatus(error: unknown) {
  const authStatus = avatarErrorStatus(error)
  if (authStatus !== 500) return authStatus
  if (!(error instanceof Error)) return 500

  const message = error.message.toLowerCase()
  if (
    message.includes("avatar not found") ||
    message.includes("voice not found") ||
    message.includes("choose a valid") ||
    message.includes("video name is required") ||
    message.includes("script is required") ||
    message.includes("topic is required")
  ) {
    return 400
  }

  return 500
}
