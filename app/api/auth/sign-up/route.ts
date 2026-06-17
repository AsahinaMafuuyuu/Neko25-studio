import { NextResponse } from "next/server"

import { clearAllAuthCookies, createAuthServerClient, getOrigin, normalizeSupabaseSession, syncUserProfile } from "@/lib/auth/server"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      email?: string
      password?: string
    }
    const name = body.name?.trim()
    const email = body.email?.trim()
    const password = body.password || ""

    if (!name || !email || !password) {
      return Response.json({ message: "Name, email, and password are required." }, { status: 400 })
    }

    const client = createAuthServerClient()
    const redirectTo = new URL("/sign-in", getOrigin(request)).toString()
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: redirectTo,
      },
    })

    if (error) {
      return Response.json(
        { error: error.code, message: error.message || "Could not create account." },
        { status: error.status || 400 }
      )
    }

    const session = normalizeSupabaseSession(data.session)
    if (!session.accessToken) {
      return Response.json({
        needsEmailVerification: true,
        verificationMethod: "code",
        user: data?.user,
      })
    }

    await syncUserProfile(session.accessToken, session.user, "sign_up")

    const response = NextResponse.json({
      created: true,
      user: session.user,
    })
    clearAllAuthCookies(response)
    return response
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Could not create account." },
      { status: 500 }
    )
  }
}
