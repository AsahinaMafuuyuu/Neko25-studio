import {
  avatarErrorStatus,
  deleteAiVideoAgentProject,
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
    return Response.json(detail)
  } catch (error) {
    return jsonError(error, "Could not load AI video project.", avatarErrorStatus(error))
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const deleted = await deleteAiVideoAgentProject(id, userId)

    if (!deleted) return Response.json({ message: "AI video project not found." }, { status: 404 })
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error, "Could not delete AI video project.", avatarErrorStatus(error))
  }
}
