import { createServerClient } from "@insforge/sdk/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { clearAllAuthCookies } from "@/lib/auth/server"

export async function POST() {
  const client = createServerClient({
    cookies: await cookies(),
  })
  await client.auth.signOut().catch(() => null)

  const response = NextResponse.json({ ok: true })
  clearAllAuthCookies(response)
  return response
}
