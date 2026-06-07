import { avatarErrorStatus, jsonError, requireBearerToken, requireCurrentUserId, selectAvatar } from "@/lib/avatar-server"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const avatar = await selectAvatar(id, userId, accessToken)

    return Response.json({ avatar })
  } catch (error) {
    return jsonError(error, "Could not select avatar.", avatarErrorStatus(error))
  }
}
