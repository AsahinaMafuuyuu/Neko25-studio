import { NextResponse } from "next/server"

import { clearAllAuthCookies, createAuthServerClient } from "@/lib/auth/server"

export async function POST() {
  const client = createAuthServerClient()
  await client.auth.signOut().catch(() => null)

  const response = NextResponse.json({ ok: true })
  clearAllAuthCookies(response)
  return response
}
