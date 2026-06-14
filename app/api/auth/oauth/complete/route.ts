import { createServerClient } from "@insforge/sdk/ssr"
import { NextRequest, NextResponse } from "next/server"

import { createTwoFactorChallenge, getTwoFactorStatus } from "@/lib/account-settings-server"
import { syncUserProfile, writeAuthCookies } from "@/lib/auth/server"
import type { AuthUser } from "@/lib/auth/types"

const verifierCookie = "insforge_code_verifier"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { code?: string }
    const code = body.code?.trim()
    const codeVerifier = request.cookies.get(verifierCookie)?.value

    if (!code) {
      return Response.json({ message: "OAuth did not return a code." }, { status: 400 })
    }

    if (!codeVerifier) {
      return Response.json({ message: "OAuth session expired. Please try signing in again." }, { status: 400 })
    }

    const client = createServerClient()
    const { data, error } = await client.auth.exchangeOAuthCode(code, codeVerifier)

    if (error || !data?.accessToken) {
      return Response.json(
        {
          error: error?.error || "OAUTH_EXCHANGE_FAILED",
          message: error?.message || "OAuth sign-in failed.",
        },
        { status: error?.statusCode || 400 }
      )
    }

    await syncUserProfile(data.accessToken, data.user as AuthUser, "oauth")
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
        const response = NextResponse.json({
          requiresTwoFactor: true,
          challengeId: challenge?.id,
          user: {
            email: user.email,
            name: typeof user.name === "string" ? user.name : undefined,
          },
        })
        response.cookies.set(verifierCookie, "", {
          path: "/",
          maxAge: 0,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        })
        return response
      }
    }

    const response = NextResponse.json({
      accessToken: data.accessToken,
      user: data.user,
    })
    writeAuthCookies(response, data)
    response.cookies.set(verifierCookie, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })

    return response
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "OAuth sign-in failed." },
      { status: 500 }
    )
  }
}
