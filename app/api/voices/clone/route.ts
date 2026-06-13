import {
  avatarErrorStatus,
  createVoiceClone,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  toVoiceListItem,
  transcribeVoiceSample,
  uploadVoiceBlob,
  uploadVoiceImageBlob,
} from "@/lib/voice-server"
import { defaultVoiceLanguage } from "@/lib/voice-types"

const maxVoiceSampleBytes = 24 * 1024 * 1024
const maxVoiceImageBytes = 8 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const form = await request.formData()
    const file = form.get("file")
    const image = form.get("image")
    const nameValue = form.get("name")
    const name = typeof nameValue === "string" ? nameValue.trim() : ""

    if (!name) {
      return Response.json({ message: "Voice name is required." }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return Response.json({ message: "Upload a voice sample before cloning." }, { status: 400 })
    }

    if (!file.type.startsWith("audio/")) {
      return Response.json({ message: "Voice sample must be an audio file." }, { status: 400 })
    }

    if (file.size > maxVoiceSampleBytes) {
      return Response.json({ message: "Voice sample must be smaller than 24 MB." }, { status: 400 })
    }

    if (image && !(image instanceof File)) {
      return Response.json({ message: "Voice image must be an image file." }, { status: 400 })
    }

    if (image instanceof File && !image.type.startsWith("image/")) {
      return Response.json({ message: "Voice image must be an image file." }, { status: 400 })
    }

    if (image instanceof File && image.size > maxVoiceImageBytes) {
      return Response.json({ message: "Voice image must be smaller than 8 MB." }, { status: 400 })
    }

    const [uploaded, uploadedImage] = await Promise.all([
      uploadVoiceBlob(file, `voice-samples/${userId}`, file.name || "voice-sample.wav"),
      image instanceof File
        ? uploadVoiceImageBlob(image, `voice-images/${userId}`, image.name || "voice-image.png")
        : Promise.resolve(null),
    ])
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
