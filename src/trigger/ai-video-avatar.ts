import { task } from "@trigger.dev/sdk/v3"
import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import ffmpegPath from "ffmpeg-static"

import {
  createAgnesVideoTask,
  waitForAgnesVideoCompletion,
} from "../../lib/agnes-video-provider"
import {
  getVideoAvatarJob,
  getVideoAvatarVideo,
  refundVideoAvatarCreditsOnce,
  updateVideoAvatarJob,
  updateVideoAvatarVideo,
  uploadVideoAvatarBlob,
} from "../../lib/video-avatar-server"
import type { AiVideoAvatarJob, AiVideoAvatarVideo } from "../../lib/video-avatar-types"

type GenerateVideoAvatarPayload = {
  jobId: string
  videoId: string
  userId: string
}

type FinalizeVideoAvatarPayload = {
  jobId: string
  videoId: string
  userId: string
  videoUrl?: string
  thumbnailUrl?: string
  callbackPayload?: Record<string, unknown>
}

export const generateAiVideoAvatar = task({
  id: "generate-ai-video-avatar",
  maxDuration: 900,
  catchError: ({ error }) => {
    if (isConfigurationError(error)) return { skipRetrying: true }
  },
  run: async (payload: GenerateVideoAvatarPayload) => {
    const { job, video } = await requireVideoJob(payload)

    try {
      await markProgress(job, video, {
        status: "running",
        progress: 18,
        message: "Preparing avatar image.",
      })

      const imageUrl = await prepareProviderImageUrl(video)

      await markProgress(job, video, {
        status: "running",
        progress: 30,
        message: "Preparing Agnes video prompt.",
      })

      const providerTask = await createAgnesVideoTask({
        imageUrl,
        prompt: buildAgnesPrompt(video),
        aspectRatio: video.aspect_ratio,
        durationSeconds: video.duration_seconds,
      })

      await updateProviderProgress(job, video, {
        providerTaskId: providerTask.taskId,
        providerVideoId: providerTask.videoId,
        providerStatus: providerTask.status,
        progress: 55,
        message: "Agnes Video V2.0 accepted the image-to-video task.",
      })

      const completedTask = await waitForAgnesVideoCompletion({
        taskId: providerTask.taskId,
        videoId: providerTask.videoId,
        onProgress: async (currentTask) => {
          const progress = Math.max(55, Math.min(82, 55 + Math.round(currentTask.progress * 0.27)))

          await updateProviderProgress(job, video, {
            providerTaskId: currentTask.taskId,
            providerVideoId: currentTask.videoId,
            providerStatus: currentTask.status,
            progress,
            message: currentTask.progress
              ? `Agnes Video V2.0 is generating the video (${currentTask.progress}%).`
              : "Agnes Video V2.0 is generating the video.",
          })
        },
      })

      await storeCompletedVideo({
        job,
        video,
        sourceVideoUrl: completedTask.videoUrl,
        sourceThumbnailUrl: completedTask.thumbnailUrl,
      })

      return {
        providerTaskId: completedTask.taskId,
        providerVideoId: completedTask.videoId,
        videoUrl: completedTask.videoUrl,
      }
    } catch (error) {
      await failVideoJob({
        error,
        job,
        message: "AI video avatar generation failed.",
        video,
      })
      throw error
    }
  },
})

export const finalizeAiVideoAvatar = task({
  id: "finalize-ai-video-avatar",
  maxDuration: 900,
  run: async (payload: FinalizeVideoAvatarPayload) => {
    const { job, video } = await requireVideoJob(payload)

    try {
      const videoUrl = payload.videoUrl || findMediaUrl(payload.callbackPayload)
      if (!videoUrl) {
        throw new Error("The provider did not include a downloadable video URL.")
      }

      const result = await storeCompletedVideo({
        job,
        video,
        sourceVideoUrl: videoUrl,
        sourceThumbnailUrl: payload.thumbnailUrl || findThumbnailUrl(payload.callbackPayload),
      })

      return result
    } catch (error) {
      await failVideoJob({
        error,
        job,
        message: "Could not finalize the provider video output.",
        video,
      })
      throw error
    }
  },
})

async function requireVideoJob(payload: GenerateVideoAvatarPayload | FinalizeVideoAvatarPayload) {
  const [job, video] = await Promise.all([
    getVideoAvatarJob(payload.jobId, payload.userId),
    getVideoAvatarVideo(payload.videoId, payload.userId),
  ])

  if (!job) throw new Error("AI video avatar job not found.")
  if (!video) throw new Error("AI video avatar not found.")

  return { job, video }
}

async function markProgress(
  job: AiVideoAvatarJob,
  video: AiVideoAvatarVideo,
  values: {
    status: "running" | "generating" | "uploading"
    progress: number
    message: string
  }
) {
  await Promise.all([
    updateVideoAvatarJob(job.id, values),
    updateVideoAvatarVideo(video.id, values),
  ])
}

async function updateProviderProgress(
  job: AiVideoAvatarJob,
  video: AiVideoAvatarVideo,
  values: {
    providerTaskId: string
    providerVideoId: string
    providerStatus: string
    progress: number
    message: string
  }
) {
  await Promise.all([
    updateVideoAvatarJob(job.id, {
      provider_task_id: values.providerTaskId,
      provider_video_id: values.providerVideoId,
      provider_status: values.providerStatus,
      status: "generating",
      progress: values.progress,
      message: values.message,
      error: "",
    }),
    updateVideoAvatarVideo(video.id, {
      status: "generating",
      progress: values.progress,
      message: values.message,
      error: "",
    }),
  ])
}

async function storeCompletedVideo({
  job,
  sourceThumbnailUrl,
  sourceVideoUrl,
  video,
}: {
  job: AiVideoAvatarJob
  sourceThumbnailUrl?: string
  sourceVideoUrl: string
  video: AiVideoAvatarVideo
}) {
  await markProgress(job, video, {
    status: "uploading",
    progress: 88,
    message: "Processing final video output.",
  })

  const videoAsset = await downloadMedia(sourceVideoUrl)
  const videoUpload = await uploadVideoAvatarBlob(
    videoAsset.blob,
    `videos/${video.user_id}/${video.id}`,
    videoAsset.filename || `${video.id}.mp4`
  )

  const thumbnailAsset = sourceThumbnailUrl
    ? await downloadMedia(sourceThumbnailUrl).catch(() => null)
    : await extractThumbnail(videoAsset.blob, video.id).catch(() => null)
  const thumbnailUpload = thumbnailAsset
    ? await uploadVideoAvatarBlob(
        thumbnailAsset.blob,
        `thumbnails/${video.user_id}/${video.id}`,
        thumbnailAsset.filename || `${video.id}.jpg`
      )
    : { url: "", key: "" }

  await updateVideoAvatarVideo(video.id, {
    status: "completed",
    progress: 100,
    message: "AI avatar video is ready.",
    error: "",
    video_url: videoUpload.url,
    video_key: videoUpload.key,
    thumbnail_url: thumbnailUpload.url,
    thumbnail_key: thumbnailUpload.key,
  })
  await updateVideoAvatarJob(job.id, {
    status: "completed",
    progress: 100,
    message: "AI avatar video is ready.",
    error: "",
  })

  return { videoUrl: videoUpload.url, thumbnailUrl: thumbnailUpload.url }
}

async function failVideoJob({
  error,
  job,
  message,
  video,
}: {
  error: unknown
  job: AiVideoAvatarJob
  message: string
  video: AiVideoAvatarVideo
}) {
  const errorMessage = getErrorMessage(error)

  await Promise.all([
    updateVideoAvatarJob(job.id, {
      status: "failed",
      progress: 100,
      message,
      error: errorMessage,
    }).catch(() => undefined),
    updateVideoAvatarVideo(video.id, {
      status: "failed",
      progress: 100,
      message,
      error: errorMessage,
    }).catch(() => undefined),
  ])

  await refundVideoAvatarCreditsOnce({
    job,
    video,
    description: "Refund for failed AI Video Avatar generation.",
  }).catch(() => undefined)
}

async function prepareProviderImageUrl(video: AiVideoAvatarVideo) {
  const publicUrl = toPublicUrl(video.avatar_image_url)
  if (isProviderReachableUrl(publicUrl)) return publicUrl

  const imageAsset = await downloadMedia(publicUrl)
  const imageUpload = await uploadVideoAvatarBlob(
    imageAsset.blob,
    `inputs/${video.user_id}/${video.id}`,
    imageAsset.filename || `${video.id}-avatar.png`
  )

  return imageUpload.url
}

async function downloadMedia(url: string) {
  const response = await fetch(toPublicUrl(url))
  if (!response.ok) {
    throw new Error(`Could not download media (${response.status}).`)
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream"
  const filename = getFilenameFromUrl(url, contentType)

  return {
    blob: new Blob([await response.arrayBuffer()], { type: contentType }),
    filename,
  }
}

async function extractThumbnail(videoBlob: Blob, videoId: string) {
  if (!ffmpegPath) return null

  const workdir = await mkdtemp(join(tmpdir(), "kravix-video-avatar-"))
  const inputPath = join(workdir, "input.mp4")
  const outputPath = join(workdir, "thumbnail.jpg")

  try {
    await writeFile(inputPath, Buffer.from(await videoBlob.arrayBuffer()))
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      outputPath,
    ])

    const image = await readFile(outputPath)
    return {
      blob: new Blob([image], { type: "image/jpeg" }),
      filename: `${videoId}-thumbnail.jpg`,
    }
  } finally {
    await rm(workdir, { force: true, recursive: true }).catch(() => undefined)
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg-static did not return a binary path."))
      return
    }

    const child = spawn(ffmpegPath, args, { stdio: "ignore" })
    child.once("error", reject)
    child.once("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}.`))
    })
  })
}

function buildAgnesPrompt(video: AiVideoAvatarVideo) {
  const voiceGuidance = video.voice_name
    ? `The selected voice style is ${video.voice_name}; keep the presenter motion natural for a future voiced avatar workflow.`
    : "Keep the presenter motion natural for a future voiced avatar workflow."

  return `${video.script}\n\n${voiceGuidance}`.slice(0, 2000)
}

function toPublicUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url

  const appBaseUrl = process.env.APP_BASE_URL?.trim()
  if (!appBaseUrl) throw new Error("APP_BASE_URL is required to read relative avatar assets.")

  return `${appBaseUrl.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`
}

function isProviderReachableUrl(url: string) {
  try {
    const parsed = new URL(url)
    return !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

function getFilenameFromUrl(url: string, contentType: string) {
  try {
    const pathname = new URL(toPublicUrl(url)).pathname
    const name = pathname.split("/").filter(Boolean).pop()
    if (name) return name
  } catch {
    // Fall back to content type below.
  }

  if (contentType.includes("mp4")) return "video.mp4"
  if (contentType.includes("webm")) return "video.webm"
  if (contentType.includes("jpeg")) return "thumbnail.jpg"
  if (contentType.includes("png")) return "thumbnail.png"
  return "asset.bin"
}

function findMediaUrl(source: unknown): string {
  return readFirstString(source, [
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
}

function findThumbnailUrl(source: unknown): string {
  return readFirstString(source, [
    "thumbnail_url",
    "thumbnailUrl",
    "cover_url",
    "coverUrl",
    "data.thumbnail_url",
    "data.thumbnailUrl",
    "data.cover_url",
    "data.coverUrl",
    "data.result.thumbnail_url",
    "data.result.thumbnailUrl",
  ])
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    return String(record.message || record.error || "Unknown video generation error.")
  }

  return "Unknown video generation error."
}

function isConfigurationError(error: unknown) {
  if (!(error instanceof Error)) return false
  return error.message.toLowerCase().includes("is not configured")
}
