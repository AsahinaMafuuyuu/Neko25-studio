import { cookies } from "next/headers"

import { createAuthAdminClient, normalizeSupabaseUser } from "@/lib/auth/server"
import { supabaseAccessTokenCookie } from "@/lib/supabase/server"

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(supabaseAccessTokenCookie)?.value

  if (!accessToken) {
    return Response.json({ error: "AUTH_USER_UNAVAILABLE", message: "Could not load user." }, { status: 401 })
  }

  const client = createAuthAdminClient()
  const { data, error } = await client.auth.getUser(accessToken)

  if (error) {
    return Response.json(
      { error: error.code || "AUTH_USER_UNAVAILABLE", message: error.message || "Could not load user." },
      { status: error.status || 401 }
    )
  }

  return Response.json({
    user: normalizeSupabaseUser(data.user) || null,
  })
}
