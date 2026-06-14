import { getLibraryData, jsonError, requireBearerToken, requireCurrentUserId } from "@/lib/library"
import { avatarErrorStatus } from "@/lib/avatar-server"

export async function GET(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const data = await getLibraryData(userId, accessToken)

    return Response.json(data)
  } catch (error) {
    return jsonError(error, "Could not load library assets.", avatarErrorStatus(error))
  }
}
