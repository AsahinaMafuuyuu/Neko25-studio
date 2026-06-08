import { getDefaultVoiceById } from "@/lib/voice-types"
import {
  avatarErrorStatus,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/voice-server"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as { voiceId?: string }
    const voice = body.voiceId ? getDefaultVoiceById(body.voiceId) : null
    if (!voice) {
      return Response.json({ message: "Choose a valid default voice." }, { status: 400 })
    }

    const apiKey = process.env.DEEPGRAM_API_KEY?.trim()
    if (!apiKey) {
      return Response.json({ message: "DEEPGRAM_API_KEY is not configured." }, { status: 500 })
    }

    const url = new URL("https://api.deepgram.com/v1/speak")
    url.searchParams.set("model", voice.provider_voice_id)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: voice.preview_text }),
    })

    if (!response.ok) {
      const text = (await response.text().catch(() => "")).slice(0, 240)
      return Response.json({ message: `Deepgram preview failed (${response.status}). ${text}` }, { status: 502 })
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": response.headers.get("content-type") || "audio/wav",
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (error) {
    return jsonError(error, "Could not generate voice preview.", avatarErrorStatus(error))
  }
}
