import {
  avatarErrorStatus,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/avatar-server"
import { getBillingPayload } from "@/lib/billing"

export async function GET(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const payload = await getBillingPayload(userId, new URL(request.url).searchParams)

    return Response.json(payload)
  } catch (error) {
    return jsonError(error, "Could not load billing data.", avatarErrorStatus(error))
  }
}
