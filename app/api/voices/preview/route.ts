import {
  avatarErrorStatus,
  getDefaultVoiceById,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/voice-server"
import { requestDeepgramTtsBlob } from "@/lib/ai-voice-cloning-requests"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as { voiceId?: string }
    const voice = body.voiceId ? await getDefaultVoiceById(body.voiceId) : null
    if (!voice) {
      return Response.json({ message: "Choose a valid default voice." }, { status: 400 })
    }

    const audio = await requestDeepgramTtsBlob({
      providerVoiceId: voice.provider_voice_id,
      text: voice.preview_text,
    })

    return new Response(await audio.arrayBuffer(), {
      headers: {
        "Content-Type": audio.type || "audio/wav",
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (error) {
    return jsonError(error, "Could not generate voice preview.", avatarErrorStatus(error))
  }
}
