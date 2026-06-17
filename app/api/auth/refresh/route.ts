import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { createAuthServerClient, normalizeSupabaseSession, writeAuthCookies } from "@/lib/auth/server"
import { supabaseRefreshTokenCookie } from "@/lib/supabase/server"

export async function POST() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get(supabaseRefreshTokenCookie)?.value

  if (!refreshToken) {
    return Response.json({ message: "No refresh session is available." }, { status: 401 })
  }

  const client = createAuthServerClient()
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken })
  const session = normalizeSupabaseSession(data.session)

  if (error || !session.accessToken) {
    return Response.json(
      { message: error?.message || "Could not refresh the current session." },
      { status: error?.status || 401 }
    )
  }

  const response = NextResponse.json(session)
  writeAuthCookies(response, session)
  return response
}
