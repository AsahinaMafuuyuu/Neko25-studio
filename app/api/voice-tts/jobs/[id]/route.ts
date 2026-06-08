import {
  avatarErrorStatus,
  ensureCreditBalance,
  getTtsJob,
  getTtsOutput,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/voice-server"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const { id } = await context.params
    const job = await getTtsJob(id, userId)

    if (!job) {
      return Response.json({ message: "TTS job not found." }, { status: 404 })
    }

    const [output, creditBalance] = await Promise.all([
      job.tts_output_id ? getTtsOutput(job.tts_output_id, userId) : null,
      ensureCreditBalance(userId),
    ])

    return Response.json({ job, output, creditBalance })
  } catch (error) {
    return jsonError(error, "Could not load TTS job.", avatarErrorStatus(error))
  }
}
