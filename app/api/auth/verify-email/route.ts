import { NextResponse } from "next/server"

import { clearAllAuthCookies, createAuthServerClient, normalizeSupabaseSession, syncUserProfile } from "@/lib/auth/server"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; otp?: string }
    const email = body.email?.trim()
    const otp = body.otp?.trim()

    if (!email || !otp) {
      return Response.json({ message: "Email and verification code are required." }, { status: 400 })
    }

    const client = createAuthServerClient()
    const { data, error } = await client.auth.verifyOtp({ email, token: otp, type: "signup" })
    const session = normalizeSupabaseSession(data.session)

    if (error || !session.accessToken) {
      return Response.json(
        {
          error: error?.code || "EMAIL_VERIFICATION_FAILED",
          message: error?.message || "Invalid or expired verification code.",
        },
        { status: error?.status || 400 }
      )
    }

    await syncUserProfile(session.accessToken, session.user, "sign_up")

    const response = NextResponse.json({
      verified: true,
      user: session.user,
    })
    clearAllAuthCookies(response)
    return response
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Could not verify email." },
      { status: 500 }
    )
  }
}
