import { avatarErrorStatus, jsonError, listAvatars, requireBearerToken, requireCurrentUserId } from "@/lib/avatar-server"

export async function GET(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const avatars = await listAvatars(userId, accessToken)

    return Response.json({ avatars })
  } catch (error) {
    return jsonError(error, "Could not load avatars.", avatarErrorStatus(error))
  }
}
