import { getAccountSettingsPayload, savePendingTwoFactorSecret } from "@/lib/account-settings-server"
import { avatarErrorStatus, jsonError, requireBearerToken, requireCurrentUserId } from "@/lib/avatar-server"
import { buildOtpAuthUri, generateTotpSecret } from "@/lib/totp"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const settings = await getAccountSettingsPayload(userId)
    const secret = generateTotpSecret()

    await savePendingTwoFactorSecret(userId, secret)

    return Response.json({
      secret,
      otpauthUri: buildOtpAuthUri({
        issuer: "Neko25 Studio",
        account: settings.profile.email || settings.profile.username,
        secret,
      }),
    })
  } catch (error) {
    return jsonError(error, "Could not start two-factor setup.", avatarErrorStatus(error))
  }
}
