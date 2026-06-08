import {
  avatarErrorStatus,
  ensureCreditBalance,
  jsonError,
  listTtsOutputs,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/voice-server"

export async function GET(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const [outputs, creditBalance] = await Promise.all([listTtsOutputs(userId), ensureCreditBalance(userId)])

    return Response.json({ outputs, creditBalance })
  } catch (error) {
    return jsonError(error, "Could not load generated audio.", avatarErrorStatus(error))
  }
}
