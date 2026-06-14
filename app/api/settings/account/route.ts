import { NextResponse } from "next/server"

import { getInsForgeAdmin, avatarErrorStatus, jsonError, requireBearerToken, requireCurrentUserId } from "@/lib/avatar-server"
import { clearAllAuthCookies } from "@/lib/auth/server"
import { getAccountSettingsPayload } from "@/lib/account-settings-server"

export async function DELETE(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as { confirmation?: string }
    const settings = await getAccountSettingsPayload(userId)
    const expected = `我确认删除账户${settings.profile.username}`

    if (body.confirmation !== expected) {
      return Response.json({ message: "Confirmation text does not match." }, { status: 400 })
    }

    const admin = await getInsForgeAdmin()
    const { error } = await admin.database.rpc("delete_user_account_admin", { p_user_id: userId })
    if (error) {
      return Response.json({ message: "Could not delete account." }, { status: 500 })
    }

    const response = NextResponse.json({ ok: true })
    clearAllAuthCookies(response)
    return response
  } catch (error) {
    return jsonError(error, "Could not delete account.", avatarErrorStatus(error))
  }
}
