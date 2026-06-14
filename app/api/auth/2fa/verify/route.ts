import { NextResponse } from "next/server"

import { consumeTwoFactorChallenge, getTwoFactorStatus } from "@/lib/account-settings-server"
import { syncUserProfile, writeAuthCookies } from "@/lib/auth/server"
import { verifyTotpCode } from "@/lib/totp"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      challengeId?: string
      code?: string
    }
    const challengeId = body.challengeId?.trim() || ""
    const code = body.code?.trim() || ""

    if (!challengeId || !/^\d{6}$/.test(code)) {
      return Response.json({ message: "Enter the 6-digit authenticator code." }, { status: 400 })
    }

    const session = await consumeTwoFactorChallenge(challengeId)
    const status = await getTwoFactorStatus(session.userId)
    if (!status.enabled || !verifyTotpCode(status.secret, code)) {
      return Response.json({ message: "Authenticator code is invalid." }, { status: 400 })
    }

    await syncUserProfile(session.accessToken, session.user, "sign_in")

    const response = NextResponse.json({
      accessToken: session.accessToken,
      user: session.user,
    })
    writeAuthCookies(response, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken || undefined,
      user: session.user,
    })

    return response
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Could not verify two-factor code." },
      { status: 400 }
    )
  }
}
