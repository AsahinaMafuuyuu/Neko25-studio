import type { AiAvatar, AiAvatarJob, AvatarJobStatus, AvatarSource, AvatarStyle } from "@/lib/avatar-types"
import { createR2StorageAdapter } from "@/lib/storage/r2"
import { createSupabaseAdminClient, toAuthUser } from "@/lib/supabase/server"
import { installDep0040WarningFilter } from "@/warning-filter"

const avatarBucket = "ai-avatars"

type UserAvatarPreference = {
  user_id: string
  selected_source: "custom" | "default"
  selected_custom_avatar_id: string | null
  selected_default_avatar_id: string | null
}

export async function getBackendAdmin() {
  installDep0040WarningFilter()
  const admin = createSupabaseAdminClient()

  return {
    auth: admin.auth,
    database: {
      from: admin.from.bind(admin),
      rpc: admin.rpc.bind(admin),
    },
    storage: createR2StorageAdapter(),
  }
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

export async function requireCurrentUserId(accessToken: string) {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.auth.getUser(accessToken)
  if (error) {
    throw new Error(error.message || "Could not read the current user.")
  }

  const user = toAuthUser(data.user)
  if (!user?.id) {
    throw new Error("Could not determine the authenticated user id.")
  }

  return user.id
}

export async function listAvatars(userId: string, accessToken: string) {
  void accessToken
  const admin = await getBackendAdmin()
  const [customResult, defaultAvatars, preference] = await Promise.all([
    admin
    .database
    .from("ai_avatars")
    .select()
    .eq("user_id", userId)
    .order("is_selected", { ascending: false })
      .order("created_at", { ascending: false }),
    listDefaultAvatars(),
    getUserAvatarPreference(userId),
  ])

  throwIfSdkError(customResult.error, "Could not load avatars.")
  const customAvatars = ((customResult.data || []) as AiAvatar[])
    .filter((avatar) => avatar.source !== "default")
    .map((avatar) => ({
      ...avatar,
      is_selected: preference
        ? preference.selected_source === "custom" && preference.selected_custom_avatar_id === avatar.id
        : avatar.is_selected,
    }))
  const normalizedDefaults = defaultAvatars.map((avatar) =>
    toDefaultAvatarListItem(
      avatar,
      preference?.selected_source === "default" && preference.selected_default_avatar_id === avatar.id
    )
  )

  return [
    ...customAvatars.sort((left, right) => Number(right.is_selected) - Number(left.is_selected)),
    ...normalizedDefaults,
  ]
}

export async function getAvatarJob(jobId: string, userId: string, accessToken?: string) {
  void accessToken
  const admin = await getBackendAdmin()
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
  const admin = await getBackendAdmin()
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

export async function getDefaultAvatarById(avatarId: string) {
  const admin = await getBackendAdmin()
  const query = admin
    .database
    .from("default_avatars")
    .select()
    .eq("active", true)
    .limit(1)

  const { data, error } = isUuid(avatarId)
    ? await query.eq("id", avatarId)
    : await query.eq("slug", avatarId.replace(/^default:/, ""))

  throwIfSdkError(error, "Could not load default avatar.")
  const avatar = ((data || []) as Array<Record<string, unknown>>)[0] || null
  return avatar ? toDefaultAvatarListItem(avatar, false) : null
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

  const admin = await getBackendAdmin()
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
  if (!avatar) throw new Error("Supabase did not return the created avatar.")
  if (input.isSelected) {
    await saveAvatarPreference({
      userId: input.userId,
      selectedSource: "custom",
      selectedCustomAvatarId: avatar.id,
      selectedDefaultAvatarId: null,
    })
  }

  return avatar
}

export async function selectAvatar(avatarId: string, userId: string, accessToken: string) {
  const defaultAvatar = await getDefaultAvatarById(avatarId)
  if (defaultAvatar) {
    await clearSelectedAvatar(userId, accessToken)
    await saveAvatarPreference({
      userId,
      selectedSource: "default",
      selectedCustomAvatarId: null,
      selectedDefaultAvatarId: defaultAvatar.id,
    })

    return {
      ...defaultAvatar,
      is_selected: true,
    }
  }

  const avatar = await getAvatarById(avatarId, userId, accessToken)
  if (!avatar) throw new Error("Avatar not found.")

  await clearSelectedAvatar(userId, accessToken)
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from("ai_avatars")
    .update({ is_selected: true })
    .eq("id", avatarId)
    .eq("user_id", userId)
    .select()

  throwIfSdkError(error, "Could not select avatar.")
  const selectedAvatar = ((data || []) as AiAvatar[])[0] || null
  if (selectedAvatar) {
    await saveAvatarPreference({
      userId,
      selectedSource: "custom",
      selectedCustomAvatarId: selectedAvatar.id,
      selectedDefaultAvatarId: null,
    })
  }

  return selectedAvatar
}

export async function deleteAvatar(avatarId: string, userId: string, accessToken?: string) {
  const avatar = await getAvatarById(avatarId, userId, accessToken)
  if (!avatar) return null
  if (avatar.source === "default") throw new Error("Default avatars cannot be deleted.")

  const admin = await getBackendAdmin()
  const { error } = await admin
    .database
    .from("ai_avatars")
    .delete()
    .eq("id", avatarId)
    .eq("user_id", userId)

  throwIfSdkError(error, "Could not delete avatar.")
  await clearAvatarPreferenceIfSelected(userId, avatarId)
  await removeAvatarStorageKeys([avatar.image_key, avatar.desktop_image_key, avatar.mobile_image_key])

  return avatar
}

async function clearSelectedAvatar(userId: string, accessToken?: string) {
  void accessToken
  const admin = await getBackendAdmin()
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
  const admin = await getBackendAdmin()
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
  if (!job) throw new Error("Supabase did not return the created avatar job.")

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
  const admin = await getBackendAdmin()
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
  const admin = await getBackendAdmin()
  const { data, error } = await admin.storage.from(avatarBucket).upload(key, file)
  throwIfSdkError(error, "Could not upload avatar file.")

  if (!data?.url || !data?.key) {
    throw new Error("Supabase did not return the uploaded avatar URL and key.")
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

  const admin = await getBackendAdmin()
  await Promise.all(uniqueKeys.map((key) => admin.storage.from(avatarBucket).remove(key)))
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function listDefaultAvatars() {
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from("default_avatars")
    .select()
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  throwIfSdkError(error, "Could not load default avatars.")
  return (data || []) as Array<Record<string, unknown>>
}

function readString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : ""
}

function toDefaultAvatarListItem(record: Record<string, unknown>, isSelected: boolean): AiAvatar {
  const slug = readString(record, "slug")
  const imageUrl = readString(record, "image_url")
  const imageKey = readString(record, "image_key") || `default:${slug}`
  const desktopImageUrl = readString(record, "desktop_image_url") || imageUrl
  const mobileImageUrl = readString(record, "mobile_image_url") || imageUrl

  return {
    id: readString(record, "id"),
    user_id: "",
    name: readString(record, "name") || "Default Avatar",
    style: (readString(record, "style") || "Casual") as AvatarStyle,
    image_url: imageUrl,
    image_key: imageKey,
    desktop_image_url: desktopImageUrl,
    desktop_image_key: readString(record, "desktop_image_key") || imageKey,
    mobile_image_url: mobileImageUrl,
    mobile_image_key: readString(record, "mobile_image_key") || imageKey,
    source: "default",
    is_selected: isSelected,
    created_at: readString(record, "created_at"),
    updated_at: readString(record, "updated_at"),
  }
}

async function getUserAvatarPreference(userId: string) {
  const admin = await getBackendAdmin()
  const { data, error } = await admin
    .database
    .from("user_avatar_preferences")
    .select()
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load avatar preference.")
  return ((data || []) as UserAvatarPreference[])[0] || null
}

async function saveAvatarPreference(input: {
  userId: string
  selectedSource: "custom" | "default"
  selectedCustomAvatarId: string | null
  selectedDefaultAvatarId: string | null
}) {
  const admin = await getBackendAdmin()
  const existing = await getUserAvatarPreference(input.userId)
  const values = {
    selected_source: input.selectedSource,
    selected_custom_avatar_id: input.selectedCustomAvatarId,
    selected_default_avatar_id: input.selectedDefaultAvatarId,
  }

  const result = existing
    ? await admin
        .database
        .from("user_avatar_preferences")
        .update(values)
        .eq("user_id", input.userId)
        .select()
    : await admin
        .database
        .from("user_avatar_preferences")
        .insert([{ user_id: input.userId, ...values }])
        .select()

  throwIfSdkError(result.error, "Could not save avatar preference.")
  return ((result.data || []) as UserAvatarPreference[])[0] || null
}

async function clearAvatarPreferenceIfSelected(userId: string, avatarId: string) {
  const preference = await getUserAvatarPreference(userId)
  if (preference?.selected_source !== "custom" || preference.selected_custom_avatar_id !== avatarId) return

  const admin = await getBackendAdmin()
  const { error } = await admin
    .database
    .from("user_avatar_preferences")
    .delete()
    .eq("user_id", userId)

  throwIfSdkError(error, "Could not clear avatar preference.")
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
