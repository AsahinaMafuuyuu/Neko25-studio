import { tasks } from "@trigger.dev/sdk/v3"

import {
  getVideoAvatarJobByProviderTaskId,
  getVideoAvatarVideo,
  jsonError,
  refundVideoAvatarCreditsOnce,
  updateVideoAvatarJob,
  updateVideoAvatarVideo,
} from "@/lib/video-avatar-server"

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const providerTaskId = readFirstString(payload, [
      "task_id",
      "taskId",
      "id",
      "data.task_id",
      "data.taskId",
      "data.id",
    ])

    if (!providerTaskId) {
      return Response.json({ message: "Missing provider task id." }, { status: 400 })
    }

    const job = await getVideoAvatarJobByProviderTaskId(providerTaskId)
    if (!job) {
      return Response.json({ message: "Provider task is not tracked by this app." }, { status: 404 })
    }

    const video = await getVideoAvatarVideo(job.video_id, job.user_id)
    if (!video) {
      return Response.json({ message: "AI video avatar not found." }, { status: 404 })
    }

    const providerStatus =
      readFirstString(payload, ["status", "state", "data.status", "data.state", "task_status", "data.task_status"]) ||
      "callback"
    const normalizedStatus = providerStatus.toLowerCase()
    const message = readFirstString(payload, ["message", "data.message", "error", "data.error"]) || providerStatus

    await updateVideoAvatarJob(job.id, {
      callback_payload: payload,
      provider_status: providerStatus,
      message,
    })

    if (isFailedStatus(normalizedStatus)) {
      await updateVideoAvatarJob(job.id, {
        status: "failed",
        progress: 100,
        message: "The video provider reported that generation failed.",
        error: message,
      })
      await updateVideoAvatarVideo(video.id, {
        status: "failed",
        progress: 100,
        message: "The video provider reported that generation failed.",
        error: message,
      })
      await refundVideoAvatarCreditsOnce({
        job,
        video,
        description: "Refund for failed AI Video Avatar generation.",
      }).catch(() => undefined)
      return Response.json({ ok: true })
    }

    if (isCompletedStatus(normalizedStatus)) {
      const videoUrl = findMediaUrl(payload)
      await updateVideoAvatarJob(job.id, {
        provider_status: providerStatus,
        status: "uploading",
        progress: 82,
        message: "Provider video is ready. Uploading final assets.",
      })
      await updateVideoAvatarVideo(video.id, {
        status: "uploading",
        progress: 82,
        message: "Provider video is ready. Uploading final assets.",
      })

      await tasks.trigger(
        "finalize-ai-video-avatar",
        {
          jobId: job.id,
          videoId: video.id,
          userId: video.user_id,
          videoUrl,
          callbackPayload: payload,
        },
        {
          tags: [`user:${video.user_id}`, `video-avatar-job:${job.id}`],
        }
      )

      return Response.json({ ok: true })
    }

    await updateVideoAvatarJob(job.id, {
      status: "generating",
      progress: Math.max(job.progress, 55),
      message: message || "The video provider is generating the avatar video.",
    })
    await updateVideoAvatarVideo(video.id, {
      status: "generating",
      progress: Math.max(video.progress, 55),
      message: message || "The video provider is generating the avatar video.",
    })

    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error, "Could not process provider callback.", 500)
  }
}

function isCompletedStatus(status: string) {
  return ["completed", "complete", "succeeded", "success", "done", "finished"].includes(status)
}

function isFailedStatus(status: string) {
  return ["failed", "failure", "error", "canceled", "cancelled"].includes(status)
}

function readFirstString(source: unknown, paths: string[]) {
  for (const path of paths) {
    const value = readPath(source, path)
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return ""
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[key]
  }, source)
}

function findMediaUrl(source: unknown): string {
  const direct = readFirstString(source, [
    "video_url",
    "videoUrl",
    "output_url",
    "outputUrl",
    "url",
    "remixed_from_video_id",
    "data.video_url",
    "data.videoUrl",
    "data.output_url",
    "data.outputUrl",
    "data.url",
    "data.remixed_from_video_id",
    "data.video.url",
    "data.result.video_url",
    "data.result.videoUrl",
    "data.result.url",
  ])

  if (direct) return direct

  if (source && typeof source === "object") {
    for (const value of Object.values(source as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        const found = value.find((item) => typeof item === "string" && /^https?:\/\//.test(item))
        if (typeof found === "string") return found
      }
    }
  }

  return ""
}
