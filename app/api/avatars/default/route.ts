import {
  avatarErrorStatus,
  getDefaultAvatarById,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  selectAvatar,
} from "@/lib/avatar-server"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const avatarId = typeof body.avatarId === "string" && body.avatarId.trim()
      ? body.avatarId.trim()
      : typeof body.imageKey === "string" && body.imageKey.trim()
        ? body.imageKey.trim()
        : ""

    if (!avatarId) {
      return Response.json({ message: "Default avatar id is required." }, { status: 400 })
    }

    const defaultAvatar = await getDefaultAvatarById(avatarId)
    if (!defaultAvatar) {
      return Response.json({ message: "Default avatar not found." }, { status: 404 })
    }

    const avatar = await selectAvatar(defaultAvatar.id, userId, accessToken)

    return Response.json({ avatar })
  } catch (error) {
    return jsonError(error, "Could not save default avatar.", avatarErrorStatus(error))
  }
}
