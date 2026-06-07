import { runs } from "@trigger.dev/sdk/v3"

import {
  avatarErrorStatus,
  getAvatarById,
  getAvatarJob,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/avatar-server"
import type { GeneratedAvatarPreview } from "@/lib/avatar-types"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const job = await getAvatarJob(id, userId, accessToken)

    if (!job) {
      return Response.json({ message: "Avatar job not found." }, { status: 404 })
    }

    const avatar = job.avatar_id ? await getAvatarById(job.avatar_id, userId, accessToken) : null

    const generatedPreview =
      !avatar && job.status === "completed" && job.trigger_run_id
        ? await getGeneratedPreviewFromRun(job.trigger_run_id)
        : null

    return Response.json({ job, avatar, generatedPreview })
  } catch (error) {
    return jsonError(error, "Could not load avatar job.", avatarErrorStatus(error))
  }
}

async function getGeneratedPreviewFromRun(runId: string): Promise<GeneratedAvatarPreview | null> {
  const run = await runs.retrieve(runId).catch(() => null)
  const output = run?.output

  if (!output || typeof output !== "object") return null

  const preview = (output as { preview?: unknown }).preview
  return isGeneratedAvatarPreview(preview) ? preview : null
}

function isGeneratedAvatarPreview(value: unknown): value is GeneratedAvatarPreview {
  if (!value || typeof value !== "object") return false

  const record = value as Record<string, unknown>
  return isGeneratedAvatarPreviewImage(record.desktop) && isGeneratedAvatarPreviewImage(record.mobile)
}

function isGeneratedAvatarPreviewImage(value: unknown) {
  if (!value || typeof value !== "object") return false

  const record = value as Record<string, unknown>
  return (
    typeof record.dataUrl === "string" &&
    record.dataUrl.startsWith("data:image/") &&
    typeof record.filename === "string" &&
    typeof record.mimeType === "string"
  )
}
