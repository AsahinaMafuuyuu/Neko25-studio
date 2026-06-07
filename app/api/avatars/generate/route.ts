import { tasks } from "@trigger.dev/sdk/v3"

import {
  avatarErrorStatus,
  createAvatarJob,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  updateAvatarJob,
} from "@/lib/avatar-server"
import { isAvatarStyle } from "@/lib/avatar-types"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const form = await request.formData()
    const file = form.get("file")
    const nameValue = form.get("name")
    const promptValue = form.get("prompt")
    const styleValue = form.get("style")
    const avatarName = typeof nameValue === "string" ? nameValue.trim() : ""
    const prompt = typeof promptValue === "string" ? promptValue.trim() : ""

    if (!avatarName) {
      return Response.json({ message: "Avatar name is required." }, { status: 400 })
    }

    if (!isAvatarStyle(styleValue)) {
      return Response.json({ message: "Choose a valid avatar style." }, { status: 400 })
    }

    if (!(file instanceof File) && !prompt) {
      return Response.json({ message: "Upload an image or add a prompt before generating." }, { status: 400 })
    }

    const sourceImage =
      file instanceof File
        ? {
            data: Buffer.from(await file.arrayBuffer()).toString("base64"),
            mimeType: file.type || "image/png",
          }
        : undefined

    const job = await createAvatarJob(
      {
        userId,
        style: styleValue,
        prompt,
        sourceImageUrl: "",
        sourceImageKey: "",
      },
      accessToken
    )

    const handle = await tasks.trigger(
      "generate-ai-avatar",
      {
        jobId: job.id,
        userId,
        avatarName,
        style: styleValue,
        prompt,
        sourceImage,
        sourceImageUrl: "",
        sourceImageKey: "",
      },
      {
        tags: [`user:${userId}`, `avatar-job:${job.id}`],
      }
    )

    const updatedJob = await updateAvatarJob(job.id, {
      trigger_run_id: handle.id,
      message: "Avatar generation has started.",
      progress: 12,
    }, accessToken)

    return Response.json({ job: updatedJob || job, runId: handle.id })
  } catch (error) {
    return jsonError(error, "Could not start avatar generation.", avatarErrorStatus(error))
  }
}
