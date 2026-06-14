import { cookies } from "next/headers"

import { createAuthServerClient } from "@/lib/auth/server"
import type { AuthUser } from "@/lib/auth/types"

export async function GET() {
  const client = createAuthServerClient({
    cookies: await cookies(),
  })
  const { data, error } = await client.auth.getCurrentUser()

  if (error) {
    return Response.json(
      { error: error.error || "AUTH_USER_UNAVAILABLE", message: error.message || "Could not load user." },
      { status: error.statusCode || 401 }
    )
  }

  return Response.json({
    user: (data?.user as AuthUser | null) || null,
  })
}
