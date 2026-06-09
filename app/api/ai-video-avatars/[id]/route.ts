import {
  avatarErrorStatus,
  deleteVideoAvatarVideo,
  ensureCreditBalance,
  getVideoAvatarVideo,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/video-avatar-server"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const [video, creditBalance] = await Promise.all([
      getVideoAvatarVideo(id, userId),
      ensureCreditBalance(userId),
    ])

    if (!video) {
      return Response.json({ message: "AI video avatar not found." }, { status: 404 })
    }

    return Response.json({ video, creditBalance })
  } catch (error) {
    return jsonError(error, "Could not load AI video avatar.", avatarErrorStatus(error))
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const video = await deleteVideoAvatarVideo(id, userId)

    if (!video) {
      return Response.json({ message: "AI video avatar not found." }, { status: 404 })
    }

    return Response.json({ video })
  } catch (error) {
    return jsonError(error, "Could not delete AI video avatar.", avatarErrorStatus(error))
  }
}
