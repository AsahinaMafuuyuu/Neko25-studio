import { tasks } from "@trigger.dev/sdk/v3"

import {
  avatarErrorStatus,
  createAiVideoAgentJob,
  getAiVideoAgentProject,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  updateAiVideoAgentProject,
} from "@/lib/ai-video-agent-server"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const project = await getAiVideoAgentProject(id, userId)
    const body = (await request.json().catch(() => ({}))) as { composition?: unknown }

    if (!project) return Response.json({ message: "AI video project not found." }, { status: 404 })
    if (!project.composition || Object.keys(project.composition).length === 0) {
      return Response.json({ message: "Composition data is not ready yet." }, { status: 400 })
    }
    const composition = body.composition && typeof body.composition === "object"
      ? body.composition as typeof project.composition
      : project.composition
    if (body.composition && typeof body.composition === "object") {
      await updateAiVideoAgentProject(project.id, { composition })
    }

    const handle = await tasks.trigger(
      "render-ai-video-agent",
      { projectId: project.id, userId },
      { tags: [`user:${userId}`, `ai-video-agent-render:${project.id}`] }
    )
    await createAiVideoAgentJob({
      projectId: project.id,
      userId,
      triggerJobId: handle.id,
      status: "rendering",
      progress: Math.max(project.progress, 88),
      message: "Final video render has started.",
      kind: "render",
    })
    const updatedProject = await updateAiVideoAgentProject(project.id, {
      render_trigger_run_id: handle.id,
      status: "rendering",
      progress: Math.max(project.progress, 88),
      message: "Final video render has started.",
      error: "",
    })

    return Response.json({ project: updatedProject || project, runId: handle.id })
  } catch (error) {
    return jsonError(error, "Could not start AI video render.", avatarErrorStatus(error))
  }
}
