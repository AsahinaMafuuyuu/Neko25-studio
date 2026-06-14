import { disableTwoFactorSecret, getAccountSettingsPayload, getTwoFactorStatus } from "@/lib/account-settings-server"
import { avatarErrorStatus, jsonError, requireBearerToken, requireCurrentUserId } from "@/lib/avatar-server"
import { verifyTotpCode } from "@/lib/totp"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as { code?: string }
    const status = await getTwoFactorStatus(userId)

    if (status.enabled && !verifyTotpCode(status.secret, body.code || "")) {
      return Response.json({ message: "Authenticator code is invalid." }, { status: 400 })
    }

    await disableTwoFactorSecret(userId)
    return Response.json(await getAccountSettingsPayload(userId))
  } catch (error) {
    return jsonError(error, "Could not disable two-factor authentication.", avatarErrorStatus(error))
  }
}
