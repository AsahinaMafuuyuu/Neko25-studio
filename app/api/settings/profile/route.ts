import { getAccountSettingsPayload, updateAccountSettings } from "@/lib/account-settings-server"
import { requireBearerToken, requireCurrentUserId, jsonError, avatarErrorStatus } from "@/lib/avatar-server"
import { isDefaultAspectRatio } from "@/lib/settings-types"

export async function GET(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const payload = await getAccountSettingsPayload(userId)

    return Response.json(payload)
  } catch (error) {
    return jsonError(error, "Could not load account settings.", avatarErrorStatus(error))
  }
}

export async function PATCH(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as {
      username?: unknown
      phone?: unknown
      description?: unknown
      emailNotifications?: unknown
      defaultAspectRatio?: unknown
    }
    const defaultAspectRatio = isDefaultAspectRatio(body.defaultAspectRatio)
      ? body.defaultAspectRatio
      : undefined

    const payload = await updateAccountSettings({
      userId,
      username: typeof body.username === "string" ? body.username : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      emailNotifications: typeof body.emailNotifications === "boolean" ? body.emailNotifications : undefined,
      defaultAspectRatio,
    })

    return Response.json(payload)
  } catch (error) {
    return jsonError(error, "Could not save account settings.", avatarErrorStatus(error))
  }
}
