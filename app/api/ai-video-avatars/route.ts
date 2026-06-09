import {
  avatarErrorStatus,
  ensureCreditBalance,
  jsonError,
  listVideoAvatarVideos,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/video-avatar-server"

export async function GET(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const [videos, creditBalance] = await Promise.all([
      listVideoAvatarVideos(userId),
      ensureCreditBalance(userId),
    ])

    return Response.json({ videos, creditBalance })
  } catch (error) {
    return jsonError(error, "Could not load AI video avatars.", avatarErrorStatus(error))
  }
}
