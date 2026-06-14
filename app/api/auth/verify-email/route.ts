import { NextResponse } from "next/server"

import { clearAllAuthCookies, createAuthServerClient, syncUserProfile } from "@/lib/auth/server"
import type { AuthUser } from "@/lib/auth/types"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; otp?: string }
    const email = body.email?.trim()
    const otp = body.otp?.trim()

    if (!email || !otp) {
      return Response.json({ message: "Email and verification code are required." }, { status: 400 })
    }

    const client = createAuthServerClient()
    const { data, error } = await client.auth.verifyEmail({ email, otp })

    if (error || !data?.accessToken) {
      return Response.json(
        {
          error: error?.error || "EMAIL_VERIFICATION_FAILED",
          message: error?.message || "Invalid or expired verification code.",
        },
        { status: error?.statusCode || 400 }
      )
    }

    await syncUserProfile(data.accessToken, data.user as AuthUser, "sign_up")

    const response = NextResponse.json({
      verified: true,
      user: data.user,
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
