import {
  avatarErrorStatus,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  selectVoice,
} from "@/lib/voice-server"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const voice = await selectVoice(id, userId)
    if (!voice) {
      return Response.json({ message: "Voice not found." }, { status: 404 })
    }

    return Response.json({ voice })
  } catch (error) {
    return jsonError(error, "Could not select voice.", avatarErrorStatus(error))
  }
}
