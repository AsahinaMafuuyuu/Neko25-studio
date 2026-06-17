import { createAuthServerClient } from "@/lib/auth/server"
import { getAccountSettingsPayload } from "@/lib/account-settings-server"
import { avatarErrorStatus, jsonError, requireBearerToken, requireCurrentUserId } from "@/lib/avatar-server"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const settings = await getAccountSettingsPayload(userId)
    const email = settings.profile.email

    if (!email) {
      return Response.json({ message: "No email address is available for this account." }, { status: 400 })
    }

    const client = createAuthServerClient()
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("/sign-in", request.url).toString(),
    })

    if (error) {
      return Response.json(
        { message: error.message || "Could not send password verification code." },
        { status: error.status || 400 }
      )
    }

    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error, "Could not send password verification code.", avatarErrorStatus(error))
  }
}
