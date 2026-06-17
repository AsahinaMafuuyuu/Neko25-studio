import { NextRequest, NextResponse } from "next/server"

import { createTwoFactorChallenge, getTwoFactorStatus } from "@/lib/account-settings-server"
import { normalizeSupabaseSession, syncUserProfile, writeAuthCookies } from "@/lib/auth/server"
import type { AuthUser } from "@/lib/auth/types"
import { clearAuthSessionCookies, createSupabaseRouteClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { code?: string }
    const code = body.code?.trim()

    if (!code) {
      return Response.json({ message: "OAuth did not return a code." }, { status: 400 })
    }

    const routeClient = createSupabaseRouteClient(request)
    const { data, error } = await routeClient.client.auth.exchangeCodeForSession(code)
    const session = normalizeSupabaseSession(data.session)

    if (error || !session.accessToken) {
      return Response.json(
        {
          error: error?.code || "OAUTH_EXCHANGE_FAILED",
          message: error?.message || "OAuth sign-in failed.",
        },
        { status: error?.status || 400 }
      )
    }

    await syncUserProfile(session.accessToken, session.user, "oauth")
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
        const response = NextResponse.json({
          requiresTwoFactor: true,
          challengeId: challenge?.id,
          user: {
            email: user.email,
            name: typeof user.name === "string" ? user.name : undefined,
          },
        })
        clearAuthSessionCookies(response)
        return response
      }
    }

    const response = NextResponse.json({
      accessToken: session.accessToken,
      user: session.user,
    })
    writeAuthCookies(response, session)

    return routeClient.applyCookies(response)
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "OAuth sign-in failed." },
      { status: 500 }
    )
  }
}
