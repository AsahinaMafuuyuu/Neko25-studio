import {
  avatarErrorStatus,
  deleteTtsOutput,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/voice-server"

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const output = await deleteTtsOutput(id, userId)

    if (!output) {
      return Response.json({ message: "Generated audio not found." }, { status: 404 })
    }

    return Response.json({ output })
  } catch (error) {
    return jsonError(error, "Could not delete generated audio.", avatarErrorStatus(error))
  }
}
