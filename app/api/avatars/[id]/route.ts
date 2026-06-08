import {
  avatarErrorStatus,
  deleteAvatar,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/avatar-server"

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const avatar = await deleteAvatar(id, userId, accessToken)

    if (!avatar) {
      return Response.json({ message: "Avatar not found." }, { status: 404 })
    }

    return Response.json({ avatar })
  } catch (error) {
    return jsonError(error, "Could not delete avatar.", avatarErrorStatus(error))
  }
}
