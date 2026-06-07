import { tasks } from "@trigger.dev/sdk/v3"

import {
  avatarErrorStatus,
  createAvatarJob,
  getAvatarJob,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  updateAvatarJob,
} from "@/lib/avatar-server"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const previousJob = await getAvatarJob(id, userId, accessToken)

    if (!previousJob) {
      return Response.json({ message: "Avatar job not found." }, { status: 404 })
    }

    const job = await createAvatarJob(
      {
        userId,
        style: previousJob.style,
        prompt: previousJob.prompt,
        sourceImageUrl: previousJob.source_image_url,
        sourceImageKey: previousJob.source_image_key,
      },
      accessToken
    )

    const handle = await tasks.trigger(
      "generate-ai-avatar",
      {
        jobId: job.id,
        userId,
        style: job.style,
        prompt: job.prompt,
        sourceImageUrl: job.source_image_url,
        sourceImageKey: job.source_image_key,
      },
      {
        tags: [`user:${userId}`, `avatar-job:${job.id}`],
      }
    )

    const updatedJob = await updateAvatarJob(job.id, {
      trigger_run_id: handle.id,
      message: "Generating a fresh avatar option.",
      progress: 12,
    }, accessToken)

    return Response.json({ job: updatedJob || job, runId: handle.id })
  } catch (error) {
    return jsonError(error, "Could not regenerate avatar.", avatarErrorStatus(error))
  }
}
