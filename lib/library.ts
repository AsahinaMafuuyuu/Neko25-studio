import { getInsForgeAdmin, jsonError, requireBearerToken, requireCurrentUserId } from "@/lib/avatar-server"
import { listAvatars } from "@/lib/avatar-server"
import { listAiVideoAgentProjects } from "@/lib/ai-video-agent-server"
import { listVideoAvatarVideos } from "@/lib/video-avatar-server"
import { listAllVoices, listTtsOutputs } from "@/lib/voice-server"

type SdkResponse<T> = {
  data?: T
  error?: unknown
}

type StorageListResponse = {
  objects?: unknown[]
}

export type LibraryStats = {
  totalAssets: number
  videos: number
  voices: number
  storageBytes: number
  storageLabel: string
}

export async function getLibraryData(userId: string, accessToken: string) {
  const [voiceData, ttsOutputs, allAvatars, aiVideoAgentProjects, aiVideoAvatarVideos, storageBytes] =
    await Promise.all([
      listAllVoices(userId),
      listTtsOutputs(userId),
      listAvatars(userId, accessToken),
      listAiVideoAgentProjects(userId),
      listVideoAvatarVideos(userId),
      getLibraryStorageBytes(userId),
    ])

  const voices = voiceData.customVoices
  const avatars = allAvatars.filter((avatar) => avatar.source !== "default")
  const stats = buildLibraryStats({
    avatarsCount: avatars.length,
    projectsCount: aiVideoAgentProjects.length,
    storageBytes,
    ttsOutputsCount: ttsOutputs.length,
    videoAvatarCount: aiVideoAvatarVideos.length,
    voicesCount: voices.length,
  })

  return {
    voices,
    ttsOutputs,
    avatars,
    aiVideoAgentProjects,
    aiVideoAvatarVideos,
    stats,
  }
}

export function buildLibraryStats(input: {
  avatarsCount: number
  projectsCount: number
  storageBytes: number
  ttsOutputsCount: number
  videoAvatarCount: number
  voicesCount: number
}): LibraryStats {
  const videos = input.projectsCount + input.videoAvatarCount
  const voices = input.voicesCount + input.ttsOutputsCount

  return {
    totalAssets: input.avatarsCount + videos + voices,
    videos,
    voices,
    storageBytes: input.storageBytes,
    storageLabel: formatStorageBytes(input.storageBytes),
  }
}

export function formatStorageBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB"

  const gb = bytes / 1024 / 1024 / 1024
  if (gb >= 1) return `${formatStorageNumber(gb)} GB`

  const mb = bytes / 1024 / 1024
  return `${formatStorageNumber(Math.max(mb, 0.1))} MB`
}

export async function getLibraryStorageBytes(userId: string) {
  const targets = [
    { bucket: "ai-voices", prefixes: [`voice-samples/${userId}`, `voice-images/${userId}`, `tts/${userId}`] },
    { bucket: "ai-avatars", prefixes: [`users/${userId}/uploads`, `users/${userId}/generated`, `users/${userId}/avatar-sources`] },
    { bucket: "ai-video-avatars", prefixes: [`videos/${userId}`, `thumbnails/${userId}`, `inputs/${userId}`, `${userId}/ai-video-agent`] },
    { bucket: "ai-video-agent", prefixes: [`${userId}/ai-video-agent`] },
  ]

  const admin = await getInsForgeAdmin()
  const totals = await Promise.all(
    targets.flatMap((target) =>
      target.prefixes.map((prefix) => sumStoragePrefixBytes(admin, target.bucket, prefix))
    )
  )

  return totals.reduce((sum, value) => sum + value, 0)
}

export { jsonError, requireBearerToken, requireCurrentUserId }

async function sumStoragePrefixBytes(admin: Awaited<ReturnType<typeof getInsForgeAdmin>>, bucket: string, prefix: string) {
  const limit = 1000
  let offset = 0
  let total = 0

  try {
    for (;;) {
      const result = (await admin.storage.from(bucket).list({ prefix, limit, offset })) as SdkResponse<StorageListResponse>
      if (result.error) return total

      const objects: unknown[] = Array.isArray(result.data?.objects) ? result.data.objects : []
      total += objects.reduce<number>((sum, object) => sum + readStorageObjectSize(object), 0)
      if (objects.length < limit) return total

      offset += limit
    }
  } catch {
    return total
  }
}

function readStorageObjectSize(value: unknown) {
  if (!value || typeof value !== "object") return 0

  const record = value as Record<string, unknown>
  for (const key of ["size", "bytes", "contentLength", "content_length"]) {
    const size = readNumber(record[key])
    if (size !== null) return size
  }

  const metadata = record.metadata
  if (metadata && typeof metadata === "object") {
    const metadataRecord = metadata as Record<string, unknown>
    for (const key of ["size", "bytes", "contentLength", "content_length"]) {
      const size = readNumber(metadataRecord[key])
      if (size !== null) return size
    }
  }

  return 0
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function formatStorageNumber(value: number) {
  return value >= 10 ? value.toFixed(0) : value.toFixed(1)
}
