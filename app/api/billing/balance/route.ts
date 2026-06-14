import {
  avatarErrorStatus,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/avatar-server"
import { getBillingBalance } from "@/lib/billing"

export async function GET(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const creditBalance = await getBillingBalance(userId)

    return Response.json({ creditBalance })
  } catch (error) {
    return jsonError(error, "Could not load billing balance.", avatarErrorStatus(error))
  }
}
