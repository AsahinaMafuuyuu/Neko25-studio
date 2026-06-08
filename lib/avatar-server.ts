import type { AiAvatar, AiAvatarJob, AvatarJobStatus, AvatarSource, AvatarStyle } from "@/lib/avatar-types"
import { installDep0040WarningFilter } from "@/warning-filter"

const avatarBucket = "ai-avatars"

type InsForgeResult<T = unknown> = {
  response: Response
  body: T
}

function getInsForgeConfig() {
  const baseUrl = process.env.INSFORGE_URL || process.env.NEXT_PUBLIC_INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error("InsForge is not configured. Add INSFORGE_URL and INSFORGE_API_KEY.")
  }

  return { baseUrl, apiKey }
}

export async function getInsForgeAdmin() {
  const { baseUrl, apiKey } = getInsForgeConfig()
  installDep0040WarningFilter()
  const { createAdminClient } = await import("@insforge/sdk")
  return createAdminClient({ baseUrl, apiKey })
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() }
  }
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>
    return String(record.message || record.error || fallback)
  }

  return fallback
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
  if (error) {
    throw new Error(sdkErrorMessage(error, fallback))
  }
}

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get("Authorization") || ""
  return authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : ""
}

export function requireBearerToken(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    throw new Error("Missing authenticated session token.")
  }

  return token
}

export async function insforgeRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
  accessToken?: string
): Promise<InsForgeResult<T>> {
  const { baseUrl, apiKey } = getInsForgeConfig()
  const headers = new Headers(init.headers)
  headers.set("x-insforge-api-key", apiKey)

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })

  const text = await response.text()
  const body = (text ? tryParseJson(text) : {}) as T

  return { response, body }
}

export async function requireCurrentUserId(accessToken: string) {
  const result = await insforgeRequest<Record<string, unknown>>("/api/auth/sessions/current", {}, accessToken)

  if (!result.response.ok) {
    throw new Error(getErrorMessage(result.body, "Could not read the current user."))
  }

  const user = findUserRecord(result.body)
  if (!user?.id || typeof user.id !== "string") {
    throw new Error("Could not determine the authenticated user id.")
  }

  return user.id
}

function findUserRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  if (typeof record.id === "string") return record

  for (const key of ["user", "data", "session", "auth"]) {
    const nested = findUserRecord(record[key])
    if (nested) return nested
  }

  return null
}

export async function listAvatars(userId: string, accessToken: string) {
  void accessToken
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_avatars")
    .select()
    .eq("user_id", userId)
    .order("is_selected", { ascending: false })
    .order("created_at", { ascending: false })

  throwIfSdkError(error, "Could not load avatars.")
  return (data || []) as AiAvatar[]
}

export async function getAvatarJob(jobId: string, userId: string, accessToken?: string) {
  void accessToken
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_avatar_jobs")
    .select()
    .eq("id", jobId)
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load avatar job.")
  return ((data || []) as AiAvatarJob[])[0] || null
}

export async function getAvatarById(avatarId: string, userId: string, accessToken?: string) {
  void accessToken
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_avatars")
    .select()
    .eq("id", avatarId)
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load avatar.")
  return ((data || []) as AiAvatar[])[0] || null
}

export async function createAvatar(
  input: {
    userId: string
    name: string
    style: AvatarStyle
    imageUrl: string
    imageKey: string
    desktopImageUrl?: string
    desktopImageKey?: string
    mobileImageUrl?: string
    mobileImageKey?: string
    source: AvatarSource
    isSelected?: boolean
  },
  accessToken?: string
) {
  if (input.isSelected) {
    await clearSelectedAvatar(input.userId, accessToken)
  }

  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_avatars")
    .insert([
      {
        user_id: input.userId,
        name: input.name,
        style: input.style,
        image_url: input.imageUrl,
        image_key: input.imageKey,
        desktop_image_url: input.desktopImageUrl || input.imageUrl,
        desktop_image_key: input.desktopImageKey || input.imageKey,
        mobile_image_url: input.mobileImageUrl || input.imageUrl,
        mobile_image_key: input.mobileImageKey || input.imageKey,
        source: input.source,
        is_selected: Boolean(input.isSelected),
      },
    ])
    .select()

  void accessToken
  throwIfSdkError(error, "Could not create avatar.")

  const avatar = ((data || []) as AiAvatar[])[0] || null
  if (!avatar) throw new Error("InsForge did not return the created avatar.")

  return avatar
}

export async function selectAvatar(avatarId: string, userId: string, accessToken: string) {
  const avatar = await getAvatarById(avatarId, userId, accessToken)
  if (!avatar) throw new Error("Avatar not found.")

  await clearSelectedAvatar(userId, accessToken)
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_avatars")
    .update({ is_selected: true })
    .eq("id", avatarId)
    .eq("user_id", userId)
    .select()

  throwIfSdkError(error, "Could not select avatar.")
  return ((data || []) as AiAvatar[])[0] || null
}

export async function deleteAvatar(avatarId: string, userId: string, accessToken?: string) {
  const avatar = await getAvatarById(avatarId, userId, accessToken)
  if (!avatar) return null
  if (avatar.source === "default") throw new Error("Default avatars cannot be deleted.")

  const admin = await getInsForgeAdmin()
  const { error } = await admin
    .database
    .from("ai_avatars")
    .delete()
    .eq("id", avatarId)
    .eq("user_id", userId)

  throwIfSdkError(error, "Could not delete avatar.")
  await removeAvatarStorageKeys([avatar.image_key, avatar.desktop_image_key, avatar.mobile_image_key])

  return avatar
}

async function clearSelectedAvatar(userId: string, accessToken?: string) {
  void accessToken
  const admin = await getInsForgeAdmin()
  const { error } = await admin
    .database
    .from("ai_avatars")
    .update({ is_selected: false })
    .eq("user_id", userId)
    .eq("is_selected", true)

  throwIfSdkError(error, "Could not update selected avatar.")
}

export async function createAvatarJob(
  input: {
    userId: string
    style: AvatarStyle
    prompt: string
    sourceImageUrl: string
    sourceImageKey: string
  },
  accessToken?: string
) {
  void accessToken
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_avatar_jobs")
    .insert([
      {
        user_id: input.userId,
        style: input.style,
        prompt: input.prompt,
        source_image_url: input.sourceImageUrl,
        source_image_key: input.sourceImageKey,
        status: "queued",
        progress: 5,
        message: "Queued for avatar generation.",
      },
    ])
    .select()

  throwIfSdkError(error, "Could not create avatar job.")

  const job = ((data || []) as AiAvatarJob[])[0] || null
  if (!job) throw new Error("InsForge did not return the created avatar job.")

  return job
}

export async function updateAvatarJob(
  jobId: string,
  values: Partial<{
    avatar_id: string | null
    trigger_run_id: string | null
    status: AvatarJobStatus
    progress: number
    message: string
    error: string
  }>,
  accessToken?: string
) {
  void accessToken
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_avatar_jobs")
    .update(values)
    .eq("id", jobId)
    .select()

  throwIfSdkError(error, "Could not update avatar job.")
  return ((data || []) as AiAvatarJob[])[0] || null
}

export async function uploadAvatarFile(file: Blob, keyPrefix: string, filename: string, accessToken?: string) {
  const contentType = file.type || "image/png"
  const extension = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png"
  const safeName = filename.replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || `avatar.${extension}`
  const key = `${keyPrefix}/${Date.now()}-${safeName}`

  void accessToken
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin.storage.from(avatarBucket).upload(key, file)
  throwIfSdkError(error, "Could not upload avatar file.")

  if (!data?.url || !data?.key) {
    throw new Error("InsForge did not return the uploaded avatar URL and key.")
  }

  return {
    url: data.url,
    key: data.key,
  }
}

async function removeAvatarStorageKeys(keys: Array<string | null | undefined>) {
  const uniqueKeys = Array.from(
    new Set(keys.filter((key): key is string => Boolean(key && !key.startsWith("default:"))))
  )
  if (!uniqueKeys.length) return

  const admin = await getInsForgeAdmin()
  await Promise.all(uniqueKeys.map((key) => admin.storage.from(avatarBucket).remove(key)))
}

export function jsonError(error: unknown, fallback: string, status = 500) {
  return Response.json(
    { message: error instanceof Error ? error.message : fallback },
    { status }
  )
}

export function avatarErrorStatus(error: unknown) {
  if (!(error instanceof Error)) return 500

  const message = error.message.toLowerCase()
  if (
    message.includes("missing authenticated") ||
    message.includes("invalid token") ||
    message.includes("expired token") ||
    message.includes("unauthorized") ||
    message.includes("could not read the current user")
  ) {
    return 401
  }

  return 500
}
