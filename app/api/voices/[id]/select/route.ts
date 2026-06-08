import {
  avatarErrorStatus,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  selectVoiceClone,
} from "@/lib/voice-server"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const voice = await selectVoiceClone(id, userId)

    return Response.json({ voice })
  } catch (error) {
    return jsonError(error, "Could not select voice.", avatarErrorStatus(error))
  }
}
