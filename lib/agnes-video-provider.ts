export const agnesVideoModel = "agnes-video-v2.0"

type AgnesVideoAspectRatio = "16:9" | "9:16"

type AgnesVideoResponse = Record<string, unknown>

export type AgnesVideoTask = {
  taskId: string
  videoId: string
  status: string
  progress: number
  videoUrl: string
  thumbnailUrl: string
  raw: AgnesVideoResponse
}

export type CreateAgnesVideoTaskInput = {
  prompt: string
  imageUrl?: string
  audioUrl?: string
  aspectRatio: AgnesVideoAspectRatio
  durationSeconds: number
  apiKey?: string
  apiUrl?: string
  model?: string
}

export async function createAgnesVideoTask(input: CreateAgnesVideoTaskInput) {
  const apiKey = getAgnesApiKey(input.apiKey)
  const apiUrl = input.apiUrl?.trim() || process.env.VIDEO_GENERATOR_API_URL?.trim() || "https://apihub.agnes-ai.com/v1/videos"
  const model = input.model?.trim() || process.env.VIDEO_GENERATOR_MODEL?.trim() || agnesVideoModel
  const { numFrames, frameRate } = getAgnesDurationSettings(input.durationSeconds)
  const { width, height } = getAgnesDimensions(input.aspectRatio)
  const extraBody = input.audioUrl ? { audio: input.audioUrl } : undefined

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt.slice(0, 2000),
      ...(input.imageUrl ? { image: input.imageUrl } : {}),
      width,
      height,
      num_frames: numFrames,
      frame_rate: frameRate,
      ...(extraBody ? { extra_body: extraBody } : {}),
    }),
  })

  const body = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(
      `Agnes video request failed (${response.status}). ${getProviderMessage(body).slice(0, 240)}`
    )
  }

  return normalizeAgnesVideoTask(body)
}

export async function retrieveAgnesVideoTask(input: {
  taskId?: string
  videoId?: string
  apiKey?: string
  model?: string
}) {
  const apiKey = getAgnesApiKey(input.apiKey)
  const model = input.model?.trim() || process.env.VIDEO_GENERATOR_MODEL?.trim() || agnesVideoModel
  const url = input.videoId
    ? new URL("https://apihub.agnes-ai.com/agnesapi")
    : new URL(`https://apihub.agnes-ai.com/v1/videos/${encodeURIComponent(input.taskId || "")}`)

  if (input.videoId) {
    url.searchParams.set("video_id", input.videoId)
    url.searchParams.set("model_name", model)
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  const body = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(
      `Agnes video status request failed (${response.status}). ${getProviderMessage(body).slice(0, 240)}`
    )
  }

  return normalizeAgnesVideoTask(body)
}

export async function waitForAgnesVideoCompletion(input: {
  taskId: string
  videoId: string
  apiKey?: string
  model?: string
  intervalMs?: number
  maxAttempts?: number
  onProgress?: (task: AgnesVideoTask) => Promise<void>
}) {
  const maxAttempts = input.maxAttempts ?? 72
  const intervalMs = input.intervalMs ?? 10_000

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const task = await retrieveAgnesVideoTask({
      taskId: input.taskId,
      videoId: input.videoId,
      apiKey: input.apiKey,
      model: input.model,
    })

    await input.onProgress?.(task)

    if (isAgnesCompletedStatus(task.status)) {
      if (!task.videoUrl) {
        throw new Error("Agnes marked the video complete but did not return a downloadable video URL.")
      }
      return task
    }

    if (isAgnesFailedStatus(task.status)) {
      throw new Error(getProviderMessage(task.raw) || "Agnes video generation failed.")
    }

    await delay(intervalMs)
  }

  throw new Error("Timed out while waiting for Agnes video generation.")
}

export function getAgnesDurationSettings(durationSeconds: number) {
  if (durationSeconds <= 5) return { numFrames: 121, frameRate: 24 }
  if (durationSeconds <= 10) return { numFrames: 241, frameRate: 24 }
  if (durationSeconds <= 20) return { numFrames: 241, frameRate: 12 }
  if (durationSeconds <= 30) return { numFrames: 241, frameRate: 8 }
  return { numFrames: 241, frameRate: 4 }
}

export function isAgnesCompletedStatus(status: string) {
  return ["completed", "complete", "succeeded", "success", "finished"].includes(status.toLowerCase())
}

export function isAgnesFailedStatus(status: string) {
  return ["failed", "error", "cancelled", "canceled"].includes(status.toLowerCase())
}

function getAgnesDimensions(aspectRatio: AgnesVideoAspectRatio) {
  if (aspectRatio === "9:16") return { width: 648, height: 1152 }
  return { width: 1152, height: 648 }
}

function normalizeAgnesVideoTask(body: AgnesVideoResponse): AgnesVideoTask {
  const taskId = readFirstString(body, ["task_id", "id", "data.task_id", "data.id"])
  const videoId = readFirstString(body, ["video_id", "data.video_id"]) || taskId
  const status = readFirstString(body, ["status", "data.status"]) || "queued"
  const progress = readFirstNumber(body, ["progress", "data.progress"])

  if (!taskId && !videoId) {
    throw new Error("Agnes did not return a task id or video id.")
  }

  return {
    taskId: taskId || videoId,
    videoId,
    status,
    progress,
    videoUrl: findAgnesVideoUrl(body),
    thumbnailUrl: findAgnesThumbnailUrl(body),
    raw: body,
  }
}

function findAgnesVideoUrl(source: unknown) {
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
    "data.result.video_url",
    "data.result.videoUrl",
    "data.result.url",
  ])
}

function findAgnesThumbnailUrl(source: unknown) {
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

async function readJsonResponse(response: Response) {
  const text = await response.text()
  if (!text.trim()) return {}

  try {
    return JSON.parse(text) as AgnesVideoResponse
  } catch {
    return { message: text }
  }
}

function getAgnesApiKey(override?: string) {
  const apiKey = override?.trim() || process.env.AGNES_API_KEY?.trim()
  if (!apiKey) throw new Error("AGNES_API_KEY is not configured.")
  return apiKey
}

function getProviderMessage(source: unknown) {
  return readFirstString(source, [
    "message",
    "error",
    "detail",
    "data.message",
    "data.error",
    "data.detail",
  ])
}

function readFirstString(source: unknown, paths: string[]) {
  for (const path of paths) {
    const value = readPath(source, path)
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return ""
}

function readFirstNumber(source: unknown, paths: string[]) {
  for (const path of paths) {
    const value = readPath(source, path)
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }

  return 0
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[key]
  }, source)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
