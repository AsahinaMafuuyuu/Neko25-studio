import {
  avatarErrorStatus,
  getVoiceCloneById,
  getVoiceCloneJob,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/voice-server"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const job = await getVoiceCloneJob(id, userId)

    if (!job) {
      return Response.json({ message: "Voice clone job not found." }, { status: 404 })
    }

    const voice = job.voice_clone_id ? await getVoiceCloneById(job.voice_clone_id, userId) : null
    return Response.json({ job, voice })
  } catch (error) {
    return jsonError(error, "Could not load voice clone job.", avatarErrorStatus(error))
  }
}
