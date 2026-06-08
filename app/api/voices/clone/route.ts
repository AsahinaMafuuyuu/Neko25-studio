import {
  avatarErrorStatus,
  createVoiceClone,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  toVoiceListItem,
  transcribeVoiceSample,
  uploadVoiceBlob,
} from "@/lib/voice-server"
import { defaultVoiceLanguage } from "@/lib/voice-types"

const maxVoiceSampleBytes = 24 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const form = await request.formData()
    const file = form.get("file")
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

    const uploaded = await uploadVoiceBlob(file, `voice-samples/${userId}`, file.name || "voice-sample.wav")
    const transcription = await transcribeVoiceSample(uploaded.url)
    const voice = await createVoiceClone({
      userId,
      name,
      language: defaultVoiceLanguage,
      sampleAudioUrl: uploaded.url,
      sampleAudioKey: uploaded.key,
      sampleTranscript: transcription.transcript,
      sampleDetectedLanguage: transcription.detectedLanguage,
      isSelected: true,
    })

    return Response.json({ voice: toVoiceListItem(voice) })
  } catch (error) {
    return jsonError(error, "Could not save custom voice.", avatarErrorStatus(error))
  }
}
