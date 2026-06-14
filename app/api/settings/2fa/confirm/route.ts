import { enableTwoFactorSecret, getAccountSettingsPayload, getTwoFactorStatus } from "@/lib/account-settings-server"
import { avatarErrorStatus, jsonError, requireBearerToken, requireCurrentUserId } from "@/lib/avatar-server"
import { verifyTotpCode } from "@/lib/totp"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as { code?: string }
    const status = await getTwoFactorStatus(userId)

    if (!status.pendingSecret) {
      return Response.json({ message: "Start two-factor setup before confirming it." }, { status: 400 })
    }

    if (!verifyTotpCode(status.pendingSecret, body.code || "")) {
      return Response.json({ message: "Authenticator code is invalid." }, { status: 400 })
    }

    await enableTwoFactorSecret(userId, status.pendingSecret)
    return Response.json(await getAccountSettingsPayload(userId))
  } catch (error) {
    return jsonError(error, "Could not confirm two-factor setup.", avatarErrorStatus(error))
  }
}
