import { tasks } from "@trigger.dev/sdk/v3"

import {
  avatarErrorStatus,
  createAvatarJob,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  updateAvatarJob,
  uploadAvatarFile,
} from "@/lib/avatar-server"
import { isAvatarStyle } from "@/lib/avatar-types"

const maxSourceImageBytes = 12 * 1024 * 1024

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

    if (file instanceof File && !file.type.startsWith("image/")) {
      return Response.json({ message: "Avatar source must be an image file." }, { status: 400 })
    }

    if (file instanceof File && file.size > maxSourceImageBytes) {
      return Response.json({ message: "Avatar source image must be smaller than 12 MB." }, { status: 400 })
    }

    const sourceImage = file instanceof File
      ? await uploadAvatarFile(file, `users/${userId}/avatar-sources`, file.name || "avatar-source.png", accessToken)
      : null

    const job = await createAvatarJob(
      {
        userId,
        style: styleValue,
        prompt,
        sourceImageUrl: sourceImage?.url || "",
        sourceImageKey: sourceImage?.key || "",
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
        sourceImageUrl: sourceImage?.url || "",
        sourceImageKey: sourceImage?.key || "",
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
