import {
  avatarErrorStatus,
  createVoiceClone,
  getVoiceStorageObject,
  getVoiceStorageUrl,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  toVoiceListItem,
  transcribeVoiceSample,
} from "@/lib/voice-server"
import { defaultVoiceLanguage } from "@/lib/voice-types"

const maxVoiceSampleBytes = 24 * 1024 * 1024
const maxVoiceImageBytes = 8 * 1024 * 1024

type UploadedVoiceAsset = {
  key?: string
  contentType?: string
  size?: number
}

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => null)) as {
      name?: string
      sampleAudio?: UploadedVoiceAsset
      avatarImage?: UploadedVoiceAsset | null
    } | null
    const name = typeof body?.name === "string" ? body.name.trim() : ""

    if (!name) {
      return Response.json({ message: "Voice name is required." }, { status: 400 })
    }

    if (!body?.sampleAudio?.key) {
      return Response.json({ message: "Upload a voice sample before cloning." }, { status: 400 })
    }

    const uploaded = await verifyUploadedAsset({
      asset: body.sampleAudio,
      userId,
      expectedPrefix: "voice-samples",
      expectedType: "audio/",
      maxBytes: maxVoiceSampleBytes,
      maxLabel: "24 MB",
    })
    const uploadedImage = body.avatarImage?.key
      ? await verifyUploadedAsset({
          asset: body.avatarImage,
          userId,
          expectedPrefix: "voice-images",
          expectedType: "image/",
          maxBytes: maxVoiceImageBytes,
          maxLabel: "8 MB",
        })
      : null
    const transcription = await transcribeVoiceSample(uploaded.url)
    const voice = await createVoiceClone({
      userId,
      name,
      language: defaultVoiceLanguage,
      sampleAudioUrl: uploaded.url,
      sampleAudioKey: uploaded.key,
      sampleTranscript: transcription.transcript,
      sampleDetectedLanguage: transcription.detectedLanguage,
      avatarImageUrl: uploadedImage?.url || "",
      isSelected: true,
    })

    return Response.json({ voice: toVoiceListItem(voice) })
  } catch (error) {
    return jsonError(error, "Could not save custom voice.", avatarErrorStatus(error))
  }
}

async function verifyUploadedAsset(input: {
  asset: UploadedVoiceAsset
  userId: string
  expectedPrefix: "voice-samples" | "voice-images"
  expectedType: "audio/" | "image/"
  maxBytes: number
  maxLabel: string
}) {
  const key = typeof input.asset.key === "string" ? input.asset.key.trim().replace(/^\/+/, "") : ""
  const expectedPath = `${input.expectedPrefix}/${input.userId}/`

  if (!key.startsWith(expectedPath) || key.includes("\\") || key.includes("../")) {
    throw new Error("Uploaded asset does not belong to the current user.")
  }

  const object = await getVoiceStorageObject(key)
  const contentType = object.contentType || input.asset.contentType || ""
  const size = object.size || input.asset.size || 0

  if (!contentType.startsWith(input.expectedType)) {
    throw new Error(input.expectedType === "audio/" ? "Voice sample must be an audio file." : "Voice image must be an image file.")
  }

  if (size <= 0 || size > input.maxBytes) {
    throw new Error(`Uploaded asset must be smaller than ${input.maxLabel}.`)
  }

  return {
    key,
    url: getVoiceStorageUrl(key),
  }
}
