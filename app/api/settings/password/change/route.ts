import { createAuthServerClient } from "@/lib/auth/server"
import { getAccountSettingsPayload, upsertUserProfileRecord } from "@/lib/account-settings-server"
import { avatarErrorStatus, jsonError, requireBearerToken, requireCurrentUserId } from "@/lib/avatar-server"

function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  )
}

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as {
      code?: string
      newPassword?: string
    }
    const code = body.code?.trim() || ""
    const newPassword = body.newPassword || ""

    if (!/^\d{6}$/.test(code)) {
      return Response.json({ message: "Enter the 6-digit verification code." }, { status: 400 })
    }

    if (!isStrongPassword(newPassword)) {
      return Response.json(
        { message: "Password must include uppercase, lowercase, number, and special character." },
        { status: 400 }
      )
    }

    const settings = await getAccountSettingsPayload(userId)
    const email = settings.profile.email
    if (!email) {
      return Response.json({ message: "No email address is available for this account." }, { status: 400 })
    }

    const client = createAuthServerClient()
    const exchange = await client.auth.verifyOtp({ email, token: code, type: "recovery" })
    if (exchange.error || !exchange.data?.session?.access_token) {
      return Response.json(
        { message: exchange.error?.message || "Verification code is invalid or expired." },
        { status: exchange.error?.status || 400 }
      )
    }

    const sessionClient = createAuthServerClient()
    await sessionClient.auth.setSession({
      access_token: exchange.data.session.access_token,
      refresh_token: exchange.data.session.refresh_token,
    })
    const reset = await sessionClient.auth.updateUser({ password: newPassword })
    if (reset.error) {
      return Response.json(
        { message: reset.error.message || "Could not change password." },
        { status: reset.error.status || 400 }
      )
    }

    await upsertUserProfileRecord(userId, {
      password_changed_at: new Date().toISOString(),
    })

    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error, "Could not change password.", avatarErrorStatus(error))
  }
}
