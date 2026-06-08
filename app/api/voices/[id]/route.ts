import {
  avatarErrorStatus,
  deleteVoiceClone,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/voice-server"

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const voice = await deleteVoiceClone(id, userId)

    if (!voice) {
      return Response.json({ message: "Custom voice not found." }, { status: 404 })
    }

    return Response.json({ voice })
  } catch (error) {
    return jsonError(error, "Could not delete custom voice.", avatarErrorStatus(error))
  }
}
