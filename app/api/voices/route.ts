import {
  avatarErrorStatus,
  ensureCreditBalance,
  jsonError,
  listAllVoices,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/voice-server"

export async function GET(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const [voices, creditBalance] = await Promise.all([listAllVoices(userId), ensureCreditBalance(userId)])

    return Response.json({ ...voices, creditBalance })
  } catch (error) {
    return jsonError(error, "Could not load voices.", avatarErrorStatus(error))
  }
}
