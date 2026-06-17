import { NextResponse } from "next/server"

import { createTwoFactorChallenge, getTwoFactorStatus } from "@/lib/account-settings-server"
import { createAuthServerClient, normalizeSupabaseSession, syncUserProfile, writeAuthCookies } from "@/lib/auth/server"
import type { AuthUser } from "@/lib/auth/types"

function authErrorResponse(error: { message?: string; status?: number; code?: string } | null | undefined) {
  const message = error?.message || "Sign in failed."
  const isEmailVerificationError =
    (error?.status === 403 && message.toLowerCase().includes("verification")) ||
    error?.code === "email_not_confirmed"

  return Response.json(
    {
      error: error?.code || "AUTH_SIGN_IN_FAILED",
      message: isEmailVerificationError
        ? "Please verify your email with the code we sent before signing in."
        : message,
    },
    { status: error?.status || 401 }
  )
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string }
    const email = body.email?.trim()
    const password = body.password || ""

    if (!email || !password) {
      return Response.json({ message: "Email and password are required." }, { status: 400 })
    }

    const client = createAuthServerClient()
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    const session = normalizeSupabaseSession(data.session)

    if (error || !session.accessToken) {
      return authErrorResponse(error)
    }

    await syncUserProfile(session.accessToken, session.user, "sign_in")

    const user = session.user as AuthUser
    const userId = typeof user.id === "string" ? user.id : ""
    if (userId) {
      const twoFactor = await getTwoFactorStatus(userId)
      if (twoFactor.enabled) {
        const challenge = await createTwoFactorChallenge({
          userId,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user,
        })

        return Response.json({
          requiresTwoFactor: true,
          challengeId: challenge?.id,
          user: {
            email: user.email,
            name: typeof user.name === "string" ? user.name : undefined,
          },
        })
      }
    }

    const response = NextResponse.json({
      accessToken: session.accessToken,
      user: session.user,
    })
    writeAuthCookies(response, session)
    return response
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Sign in failed." },
      { status: 500 }
    )
  }
}
