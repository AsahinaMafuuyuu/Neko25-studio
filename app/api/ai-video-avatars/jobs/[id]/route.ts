import {
  avatarErrorStatus,
  ensureCreditBalance,
  getVideoAvatarJob,
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
    const job = await getVideoAvatarJob(id, userId)

    if (!job) {
      return Response.json({ message: "AI video avatar job not found." }, { status: 404 })
    }

    const [video, creditBalance] = await Promise.all([
      getVideoAvatarVideo(job.video_id, userId),
      ensureCreditBalance(userId),
    ])

    return Response.json({ job, video, creditBalance })
  } catch (error) {
    return jsonError(error, "Could not load AI video avatar job.", avatarErrorStatus(error))
  }
}
