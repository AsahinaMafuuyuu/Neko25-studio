import { tasks } from "@trigger.dev/sdk/v3"

import {
  avatarErrorStatus,
  createVideoAvatarJob,
  createVideoAvatarVideo,
  deductCredits,
  jsonError,
  refundVideoAvatarCreditsOnce,
  requireBearerToken,
  requireCurrentUserId,
  resolveVideoAvatarInputs,
  updateVideoAvatarJob,
  updateVideoAvatarVideo,
} from "@/lib/video-avatar-server"
import {
  type AiVideoAvatarJob,
  type AiVideoAvatarVideo,
  getVideoAvatarCreditCost,
  isVideoAvatarAspectRatio,
  isVideoAvatarDuration,
} from "@/lib/video-avatar-types"

export async function POST(request: Request) {
  let createdVideo: AiVideoAvatarVideo | null = null
  let createdJob: AiVideoAvatarJob | null = null
  let creditsDeducted = false

  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as {
      title?: string
      script?: string
      avatarId?: string
      voiceId?: string
      aspectRatio?: string
      durationSeconds?: number
    }

    const title = typeof body.title === "string" ? body.title.trim() : ""
    const script = typeof body.script === "string" ? body.script.trim() : ""
    const avatarId = typeof body.avatarId === "string" ? body.avatarId.trim() : ""
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : ""
    const durationSeconds = Number(body.durationSeconds)

    if (!title) return Response.json({ message: "Video title is required." }, { status: 400 })
    if (!script) return Response.json({ message: "Script is required." }, { status: 400 })
    if (script.length > 2000) return Response.json({ message: "Script must be 2,000 characters or fewer." }, { status: 400 })
    if (!avatarId) return Response.json({ message: "Choose an avatar." }, { status: 400 })
    if (!voiceId) return Response.json({ message: "Choose a voice." }, { status: 400 })
    if (!isVideoAvatarAspectRatio(body.aspectRatio)) {
      return Response.json({ message: "Choose a supported aspect ratio." }, { status: 400 })
    }
    if (!isVideoAvatarDuration(durationSeconds)) {
      return Response.json({ message: "Choose a supported video duration." }, { status: 400 })
    }

    const { avatar, voice } = await resolveVideoAvatarInputs({ avatarId, voiceId, userId })
    const creditsCost = getVideoAvatarCreditCost({
      avatarSource: avatar.source,
      durationSeconds,
      voiceSource: voice.source,
    })

    const video = await createVideoAvatarVideo({
      userId,
      title,
      script,
      avatarId: avatar.source === "default" ? null : avatar.id,
      avatarName: avatar.name,
      avatarImageUrl: avatar.desktop_image_url || avatar.image_url,
      avatarImageKey: avatar.desktop_image_key || avatar.image_key,
      avatarSource: avatar.source,
      voiceCloneId: voice.voiceCloneId,
      voiceName: voice.name,
      voiceSource: voice.source,
      providerVoiceId: voice.providerVoiceId,
      voiceAudioUrl: voice.voiceAudioUrl,
      aspectRatio: body.aspectRatio,
      durationSeconds,
      creditsCost,
    })
    createdVideo = video

    const job = await createVideoAvatarJob({ userId, videoId: video.id })
    createdJob = job

    const creditBalance = await deductCredits({
      userId,
      amount: creditsCost,
      description: "AI Video Avatar generation.",
      referenceType: "ai_video_avatar_jobs",
      referenceId: job.id,
    })
    creditsDeducted = true

    const handle = await tasks.trigger(
      "generate-ai-video-avatar",
      {
        jobId: job.id,
        videoId: video.id,
        userId,
      },
      {
        tags: [`user:${userId}`, `video-avatar-job:${job.id}`],
      }
    )

    const updatedJob = await updateVideoAvatarJob(job.id, {
      trigger_run_id: handle.id,
      progress: 12,
      message: "AI video avatar generation has started.",
    })
    await updateVideoAvatarVideo(video.id, {
      status: "running",
      progress: 12,
      message: "AI video avatar generation has started.",
    })

    return Response.json({ job: updatedJob || job, video, runId: handle.id, creditBalance })
  } catch (error) {
    if (createdJob) {
      await updateVideoAvatarJob(createdJob.id, {
        status: "failed",
        progress: 100,
        message: "AI video avatar generation could not start.",
        error: error instanceof Error ? error.message : "Could not start generation.",
      }).catch(() => undefined)
    }

    if (createdVideo) {
      await updateVideoAvatarVideo(createdVideo.id, {
        status: "failed",
        progress: 100,
        message: "AI video avatar generation could not start.",
        error: error instanceof Error ? error.message : "Could not start generation.",
      }).catch(() => undefined)
    }

    if (creditsDeducted && createdJob && createdVideo) {
      await refundVideoAvatarCreditsOnce({
        job: createdJob,
        video: createdVideo,
        description: "Refund for failed AI Video Avatar start.",
      }).catch(() => undefined)
    }

    return jsonError(error, "Could not start AI video avatar generation.", avatarErrorStatus(error))
  }
}
