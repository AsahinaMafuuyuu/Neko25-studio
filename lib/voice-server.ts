import {
  avatarErrorStatus,
  getInsForgeAdmin,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/avatar-server"
import { requestVoiceSampleTranscription } from "@/lib/ai-voice-cloning-requests"
import {
  type AiTtsJob,
  type AiTtsOutput,
  type AiVoiceClone,
  type AiVoiceCloneJob,
  type DefaultVoice,
  type VoiceJobStatus,
  type VoiceListItem,
  type VoiceSource,
} from "@/lib/voice-types"

export { avatarErrorStatus, jsonError, requireBearerToken, requireCurrentUserId }

const voiceBucket = "ai-voices"
const defaultInitialCredits = 1280

type SdkResponse<T> = {
  data?: T
  error?: unknown
}

type UserVoicePreference = {
  user_id: string
  selected_source: VoiceSource
  selected_custom_voice_id: string | null
  selected_default_voice_id: string | null
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
  if (error) throw new Error(sdkErrorMessage(error, fallback))
}

function safeFileName(filename: string, fallback: string) {
  return filename.replace(/[^a-z0-9.-]/gi, "-").toLowerCase() || fallback
}

function getExtension(contentType: string, fallback = "bin") {
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3"
  if (contentType.includes("wav") || contentType.includes("wave")) return "wav"
  if (contentType.includes("ogg")) return "ogg"
  if (contentType.includes("webm")) return "webm"
  if (contentType.includes("mp4") || contentType.includes("m4a")) return "m4a"
  if (contentType.includes("jpeg")) return "jpg"
  if (contentType.includes("png")) return "png"
  if (contentType.includes("webp")) return "webp"
  if (contentType.includes("gif")) return "gif"
  return fallback
}

function readScalarNumber(value: unknown) {
  if (typeof value === "number") return value
  if (Array.isArray(value) && typeof value[0] === "number") return value[0]
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["balance", "deduct_user_credits", "refund_user_credits", "ensure_user_credit_balance"]) {
      if (typeof record[key] === "number") return record[key]
    }
  }

  return null
}

export async function uploadVoiceBlob(blob: Blob, keyPrefix: string, filename: string) {
  const contentType = blob.type || "application/octet-stream"
  const fallback = `audio.${getExtension(contentType)}`
  const key = `${keyPrefix}/${Date.now()}-${safeFileName(filename, fallback)}`
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin.storage.from(voiceBucket).upload(key, blob)
  throwIfSdkError(error, "Could not upload voice audio.")

  if (!data?.url || !data?.key) {
    throw new Error("InsForge did not return the uploaded audio URL and key.")
  }

  return {
    url: data.url,
    key: data.key,
  }
}

export async function uploadVoiceImageBlob(blob: Blob, keyPrefix: string, filename: string) {
  const contentType = blob.type || "image/png"
  const fallback = `image.${getExtension(contentType, "png")}`
  const key = `${keyPrefix}/${Date.now()}-${safeFileName(filename, fallback)}`
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin.storage.from(voiceBucket).upload(key, blob)
  throwIfSdkError(error, "Could not upload voice image.")

  if (!data?.url || !data?.key) {
    throw new Error("InsForge did not return the uploaded voice image URL and key.")
  }

  return {
    url: data.url,
    key: data.key,
  }
}

async function removeVoiceStorageKeys(keys: Array<string | null | undefined>) {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean))) as string[]
  if (!uniqueKeys.length) return

  try {
    const admin = await getInsForgeAdmin()
    await Promise.all(uniqueKeys.map((key) => admin.storage.from(voiceBucket).remove(key)))
  } catch {
    // Storage cleanup is best-effort; the database record is the source of truth for the UI.
  }
}

export async function listVoiceClones(userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_voice_clones")
    .select()
    .eq("user_id", userId)
    .order("is_selected", { ascending: false })
    .order("created_at", { ascending: false })

  throwIfSdkError(error, "Could not load voice clones.")
  return (data || []) as AiVoiceClone[]
}

export function toVoiceListItem(voice: AiVoiceClone): VoiceListItem {
  return {
    id: voice.id,
    name: voice.name,
    source: "custom",
    provider: "qwen3-tts",
    language: voice.language,
    sample_audio_url: voice.sample_audio_url,
    sample_transcript: voice.sample_transcript,
    sample_detected_language: voice.sample_detected_language,
    preview_text: voice.sample_transcript,
    preview_audio_url: voice.preview_audio_url,
    avatar_image_url: voice.avatar_image_url,
    is_selected: voice.is_selected,
  }
}

export async function listAllVoices(userId: string) {
  const [customVoices, defaultVoices, preference] = await Promise.all([
    listVoiceClones(userId),
    listDefaultVoices(),
    getUserVoicePreference(userId),
  ])
  const customItems = customVoices.map((voice) => ({
    ...toVoiceListItem(voice),
    is_selected: preference
      ? preference.selected_source === "custom" && preference.selected_custom_voice_id === voice.id
      : voice.is_selected,
  }))
  const defaultItems = defaultVoices.map((voice) => ({
    ...voice,
    is_selected: preference?.selected_source === "default" && preference.selected_default_voice_id === voice.id,
  }))

  return {
    customVoices,
    defaultVoices,
    voices: [
      ...customItems,
      ...defaultItems,
    ] as VoiceListItem[],
  }
}

export async function listDefaultVoices() {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("default_voices")
    .select()
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  throwIfSdkError(error, "Could not load default voices.")
  return ((data || []) as Array<Record<string, unknown>>).map(toDefaultVoiceListItem)
}

export async function getDefaultVoiceById(voiceId: string) {
  const admin = await getInsForgeAdmin()
  const query = admin
    .database
    .from("default_voices")
    .select()
    .eq("active", true)
    .limit(1)

  const { data, error } = isUuid(voiceId)
    ? await query.eq("id", voiceId)
    : await query.eq("slug", voiceId)

  throwIfSdkError(error, "Could not load default voice.")
  const voice = ((data || []) as Array<Record<string, unknown>>)[0] || null
  return voice ? toDefaultVoiceListItem(voice) : null
}

export async function getVoiceCloneById(voiceId: string, userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_voice_clones")
    .select()
    .eq("id", voiceId)
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load voice clone.")
  return ((data || []) as AiVoiceClone[])[0] || null
}

export async function createVoiceCloneJob(input: {
  userId: string
  name: string
  language: string
  sampleAudioUrl: string
  sampleAudioKey: string
}) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_voice_clone_jobs")
    .insert([
      {
        user_id: input.userId,
        name: input.name,
        language: input.language,
        sample_audio_url: input.sampleAudioUrl,
        sample_audio_key: input.sampleAudioKey,
        status: "queued",
        progress: 5,
        message: "Queued for voice clone preparation.",
      },
    ])
    .select()

  throwIfSdkError(error, "Could not create voice clone job.")
  const job = ((data || []) as AiVoiceCloneJob[])[0] || null
  if (!job) throw new Error("InsForge did not return the created voice clone job.")
  return job
}

export async function updateVoiceCloneJob(
  jobId: string,
  values: Partial<{
    voice_clone_id: string | null
    trigger_run_id: string | null
    status: VoiceJobStatus
    progress: number
    message: string
    error: string
  }>
) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_voice_clone_jobs")
    .update(values)
    .eq("id", jobId)
    .select()

  throwIfSdkError(error, "Could not update voice clone job.")
  return ((data || []) as AiVoiceCloneJob[])[0] || null
}

export async function getVoiceCloneJob(jobId: string, userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_voice_clone_jobs")
    .select()
    .eq("id", jobId)
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load voice clone job.")
  return ((data || []) as AiVoiceCloneJob[])[0] || null
}

export async function createVoiceClone(input: {
  userId: string
  name: string
  language: string
  sampleAudioUrl: string
  sampleAudioKey: string
  sampleTranscript?: string
  sampleDetectedLanguage?: string
  previewAudioUrl?: string
  previewAudioKey?: string
  avatarImageUrl?: string
  isSelected?: boolean
}) {
  if (input.isSelected) {
    await clearSelectedVoiceClone(input.userId)
  }

  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_voice_clones")
    .insert([
      {
        user_id: input.userId,
        name: input.name,
        source: "custom",
        language: input.language,
        sample_audio_url: input.sampleAudioUrl,
        sample_audio_key: input.sampleAudioKey,
        sample_transcript: input.sampleTranscript || "",
        sample_detected_language: input.sampleDetectedLanguage || "",
        preview_audio_url: input.previewAudioUrl || "",
        preview_audio_key: input.previewAudioKey || "",
        avatar_image_url: input.avatarImageUrl || "",
        is_selected: Boolean(input.isSelected),
      },
    ])
    .select()

  throwIfSdkError(error, "Could not create voice clone.")
  const voice = ((data || []) as AiVoiceClone[])[0] || null
  if (!voice) throw new Error("InsForge did not return the created voice clone.")
  if (input.isSelected) {
    await saveVoicePreference({
      userId: input.userId,
      selectedSource: "custom",
      selectedCustomVoiceId: voice.id,
      selectedDefaultVoiceId: null,
    })
  }
  return voice
}

export async function selectVoiceClone(voiceId: string, userId: string) {
  const voice = await getVoiceCloneById(voiceId, userId)
  if (!voice) throw new Error("Voice clone not found.")

  await clearSelectedVoiceClone(userId)
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_voice_clones")
    .update({ is_selected: true })
    .eq("id", voiceId)
    .eq("user_id", userId)
    .select()

  throwIfSdkError(error, "Could not select voice clone.")
  const selectedVoice = ((data || []) as AiVoiceClone[])[0] || null
  if (selectedVoice) {
    await saveVoicePreference({
      userId,
      selectedSource: "custom",
      selectedCustomVoiceId: selectedVoice.id,
      selectedDefaultVoiceId: null,
    })
  }

  return selectedVoice
}

export async function selectVoice(voiceId: string, userId: string) {
  const defaultVoice = await getDefaultVoiceById(voiceId)
  if (defaultVoice) {
    await clearSelectedVoiceClone(userId)
    await saveVoicePreference({
      userId,
      selectedSource: "default",
      selectedCustomVoiceId: null,
      selectedDefaultVoiceId: defaultVoice.id,
    })

    return {
      ...defaultVoice,
      is_selected: true,
    } satisfies VoiceListItem
  }

  const customVoice = await selectVoiceClone(voiceId, userId)
  return customVoice ? toVoiceListItem(customVoice) : null
}

export async function deleteVoiceClone(voiceId: string, userId: string) {
  const voice = await getVoiceCloneById(voiceId, userId)
  if (!voice) return null

  const admin = await getInsForgeAdmin()
  const { error } = await admin
    .database
    .from("ai_voice_clones")
    .delete()
    .eq("id", voiceId)
    .eq("user_id", userId)

  throwIfSdkError(error, "Could not delete custom voice.")
  await clearVoicePreferenceIfSelected(userId, voiceId)
  await removeVoiceStorageKeys([voice.sample_audio_key, voice.preview_audio_key])

  return voice
}

async function clearSelectedVoiceClone(userId: string) {
  const admin = await getInsForgeAdmin()
  const { error } = await admin
    .database
    .from("ai_voice_clones")
    .update({ is_selected: false })
    .eq("user_id", userId)
    .eq("is_selected", true)

  throwIfSdkError(error, "Could not update selected voice.")
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function readString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : ""
}

function toDefaultVoiceListItem(record: Record<string, unknown>): DefaultVoice {
  return {
    id: readString(record, "id"),
    slug: readString(record, "slug"),
    name: readString(record, "name") || "Default Voice",
    source: "default",
    provider: "deepgram",
    provider_voice_id: readString(record, "provider_voice_id"),
    language: readString(record, "language") || "en",
    gender: (readString(record, "gender") || "female") as DefaultVoice["gender"],
    preview_text: readString(record, "preview_text"),
    avatar_image_url: readString(record, "avatar_image_url"),
  }
}

async function getUserVoicePreference(userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("user_voice_preferences")
    .select()
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load voice preference.")
  return ((data || []) as UserVoicePreference[])[0] || null
}

async function saveVoicePreference(input: {
  userId: string
  selectedSource: VoiceSource
  selectedCustomVoiceId: string | null
  selectedDefaultVoiceId: string | null
}) {
  const admin = await getInsForgeAdmin()
  const existing = await getUserVoicePreference(input.userId)
  const values = {
    selected_source: input.selectedSource,
    selected_custom_voice_id: input.selectedCustomVoiceId,
    selected_default_voice_id: input.selectedDefaultVoiceId,
  }

  const result = existing
    ? await admin
        .database
        .from("user_voice_preferences")
        .update(values)
        .eq("user_id", input.userId)
        .select()
    : await admin
        .database
        .from("user_voice_preferences")
        .insert([{ user_id: input.userId, ...values }])
        .select()

  throwIfSdkError(result.error, "Could not save voice preference.")
  return ((result.data || []) as UserVoicePreference[])[0] || null
}

async function clearVoicePreferenceIfSelected(userId: string, voiceId: string) {
  const preference = await getUserVoicePreference(userId)
  if (preference?.selected_source !== "custom" || preference.selected_custom_voice_id !== voiceId) return

  const admin = await getInsForgeAdmin()
  const { error } = await admin
    .database
    .from("user_voice_preferences")
    .delete()
    .eq("user_id", userId)

  throwIfSdkError(error, "Could not clear voice preference.")
}

export async function listTtsOutputs(userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_tts_outputs")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  throwIfSdkError(error, "Could not load generated audio.")
  return (data || []) as AiTtsOutput[]
}

export async function createTtsJob(input: {
  userId: string
  voiceCloneId?: string | null
  voiceName: string
  voiceSource: VoiceSource
  providerVoiceId?: string
  language: string
  text: string
  characterCount: number
  creditsCost: number
}) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_tts_jobs")
    .insert([
      {
        user_id: input.userId,
        voice_clone_id: input.voiceCloneId || null,
        voice_name: input.voiceName,
        voice_source: input.voiceSource,
        provider_voice_id: input.providerVoiceId || "",
        language: input.language,
        text: input.text,
        character_count: input.characterCount,
        credits_cost: input.creditsCost,
        status: "queued",
        progress: 5,
        message: "Queued for text to speech generation.",
      },
    ])
    .select()

  throwIfSdkError(error, "Could not create TTS job.")
  const job = ((data || []) as AiTtsJob[])[0] || null
  if (!job) throw new Error("InsForge did not return the created TTS job.")
  return job
}

export async function updateTtsJob(
  jobId: string,
  values: Partial<{
    tts_output_id: string | null
    trigger_run_id: string | null
    status: VoiceJobStatus
    progress: number
    message: string
    error: string
    credits_refunded: boolean
  }>
) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_tts_jobs")
    .update(values)
    .eq("id", jobId)
    .select()

  throwIfSdkError(error, "Could not update TTS job.")
  return ((data || []) as AiTtsJob[])[0] || null
}

export async function getTtsJob(jobId: string, userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_tts_jobs")
    .select()
    .eq("id", jobId)
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load TTS job.")
  return ((data || []) as AiTtsJob[])[0] || null
}

export async function getTtsOutput(outputId: string, userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_tts_outputs")
    .select()
    .eq("id", outputId)
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load generated audio.")
  return ((data || []) as AiTtsOutput[])[0] || null
}

export async function createTtsOutput(input: {
  userId: string
  voiceCloneId?: string | null
  voiceName: string
  voiceSource: VoiceSource
  providerVoiceId?: string
  language: string
  text: string
  characterCount: number
  creditsCost: number
  audioUrl: string
  audioKey: string
  audioFormat: "mp3" | "wav" | "audio"
}) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("ai_tts_outputs")
    .insert([
      {
        user_id: input.userId,
        voice_clone_id: input.voiceCloneId || null,
        voice_name: input.voiceName,
        voice_source: input.voiceSource,
        provider_voice_id: input.providerVoiceId || "",
        language: input.language,
        text: input.text,
        character_count: input.characterCount,
        credits_cost: input.creditsCost,
        audio_url: input.audioUrl,
        audio_key: input.audioKey,
        audio_format: input.audioFormat,
      },
    ])
    .select()

  throwIfSdkError(error, "Could not save generated audio.")
  const output = ((data || []) as AiTtsOutput[])[0] || null
  if (!output) throw new Error("InsForge did not return the generated audio record.")
  return output
}

export async function deleteTtsOutput(outputId: string, userId: string) {
  const output = await getTtsOutput(outputId, userId)
  if (!output) return null

  const admin = await getInsForgeAdmin()
  const { error } = await admin
    .database
    .from("ai_tts_outputs")
    .delete()
    .eq("id", outputId)
    .eq("user_id", userId)

  throwIfSdkError(error, "Could not delete generated audio.")
  await removeVoiceStorageKeys([output.audio_key])

  return output
}

export async function ensureCreditBalance(userId: string) {
  const admin = await getInsForgeAdmin()
  const result = (await admin.database.rpc("ensure_user_credit_balance", {
    p_user_id: userId,
    p_default_balance: defaultInitialCredits,
  })) as SdkResponse<unknown>

  throwIfSdkError(result.error, "Could not load credit balance.")
  return readScalarNumber(result.data) ?? defaultInitialCredits
}

export async function deductCredits(input: {
  userId: string
  amount: number
  description: string
  referenceType: string
  referenceId: string
}) {
  const admin = await getInsForgeAdmin()
  const result = (await admin.database.rpc("deduct_user_credits", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_description: input.description,
    p_reference_type: input.referenceType,
    p_reference_id: input.referenceId,
  })) as SdkResponse<unknown>

  throwIfSdkError(result.error, "Could not deduct credits.")
  const balance = readScalarNumber(result.data)
  if (balance === null) throw new Error("Could not read updated credit balance.")
  return balance
}

export async function refundCredits(input: {
  userId: string
  amount: number
  description: string
  referenceType: string
  referenceId: string
}) {
  const admin = await getInsForgeAdmin()
  const result = (await admin.database.rpc("refund_user_credits", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_description: input.description,
    p_reference_type: input.referenceType,
    p_reference_id: input.referenceId,
  })) as SdkResponse<unknown>

  throwIfSdkError(result.error, "Could not refund credits.")
  return readScalarNumber(result.data)
}

export async function transcribeVoiceSample(audioUrl: string) {
  return await requestVoiceSampleTranscription(audioUrl)
}
