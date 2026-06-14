import { NextResponse } from "next/server"

import { createTwoFactorChallenge, getTwoFactorStatus } from "@/lib/account-settings-server"
import { createAuthServerClient, syncUserProfile, writeAuthCookies } from "@/lib/auth/server"
import type { AuthUser } from "@/lib/auth/types"

function authErrorResponse(error: { message?: string; statusCode?: number; error?: string } | null | undefined) {
  const message = error?.message || "Sign in failed."
  const isEmailVerificationError =
    (error?.statusCode === 403 && message.toLowerCase().includes("verification")) ||
    error?.error === "EMAIL_VERIFICATION_REQUIRED"

  return Response.json(
    {
      error: error?.error || "AUTH_SIGN_IN_FAILED",
      message: isEmailVerificationError
        ? "Please verify your email with the code we sent before signing in."
        : message,
    },
    { status: error?.statusCode || 401 }
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

    if (error || !data?.accessToken) {
      return authErrorResponse(error)
    }

    await syncUserProfile(data.accessToken, data.user as AuthUser, "sign_in")

    const user = data.user as AuthUser
    const userId = typeof user.id === "string" ? user.id : ""
    if (userId) {
      const twoFactor = await getTwoFactorStatus(userId)
      if (twoFactor.enabled) {
        const challenge = await createTwoFactorChallenge({
          userId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
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
      accessToken: data.accessToken,
      user: data.user,
    })
    writeAuthCookies(response, data)
    return response
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Sign in failed." },
      { status: 500 }
    )
  }
}
