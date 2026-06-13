import {
  avatarErrorStatus,
  ensureCreditBalance,
  getAiVideoAgentProjectDetail,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/ai-video-agent-server"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const detail = await getAiVideoAgentProjectDetail(id, userId)

    if (!detail) return Response.json({ message: "AI video project not found." }, { status: 404 })
    const creditBalance = await ensureCreditBalance(userId).catch(() => null)
    return Response.json({ ...detail, creditBalance })
  } catch (error) {
    return jsonError(error, "Could not load AI video project status.", avatarErrorStatus(error))
  }
}
