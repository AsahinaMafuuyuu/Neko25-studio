import { clearAuthCookies, createServerClient, setAuthCookies } from "@insforge/sdk/ssr"
import type { NextResponse } from "next/server"

import type { AuthUser, ProfileSyncEvent } from "@/lib/auth/types"

type TokenSession = {
  accessToken?: string | null
  refreshToken?: string | null
  user?: AuthUser
}

function getInsForgeConfig() {
  const baseUrl = process.env.INSFORGE_URL || process.env.NEXT_PUBLIC_INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error("InsForge is not configured. Add INSFORGE_URL and INSFORGE_API_KEY.")
  }

  return { baseUrl, apiKey }
}

export function createAuthServerClient(options?: Parameters<typeof createServerClient>[0]) {
  return createServerClient(options)
}

export function writeAuthCookies(response: NextResponse, session: TokenSession) {
  if (!session.accessToken) return

  clearAuthCookies(response.cookies)
  clearLegacyAuthCookies(response)
  setAuthCookies(response.cookies, {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  })
}

export function clearAllAuthCookies(response: NextResponse) {
  clearAuthCookies(response.cookies)
  clearLegacyAuthCookies(response)
}

function clearLegacyAuthCookies(response: NextResponse) {
  response.cookies.set("kravix_ai_studio_session", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  })
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return undefined
}

function getProfileValue(user: AuthUser, keys: string[]) {
  for (const key of keys) {
    const directValue = user[key]
    if (typeof directValue === "string" && directValue.trim()) return directValue
  }

  const sources = [asRecord(user.profile), asRecord(user.metadata), user.user_metadata, user.app_metadata]
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const value = source[key]
      if (typeof value === "string" && value.trim()) return value
    }
  }

  return ""
}

function getProviders(user: AuthUser) {
  if (Array.isArray(user.providers)) return user.providers.map(String)

  const source = user.app_metadata || user.metadata || undefined
  const providers = source?.providers || source?.provider
  if (Array.isArray(providers)) return providers.map(String)
  if (typeof providers === "string" && providers.trim()) return [providers]

  return []
}

function normalizeUserProfile(user: AuthUser, _event: ProfileSyncEvent) {
  void _event
  const now = new Date().toISOString()

  return {
    id: user.id,
    name: getProfileValue(user, ["name", "full_name", "displayName", "display_name"]),
    email: getProfileValue(user, ["email"]) || user.email || "",
    avatar_url: getProfileValue(user, ["avatar_url", "avatarUrl", "picture", "image"]),
    providers: getProviders(user),
    email_verified: Boolean(user.emailVerified || user.email_verified),
    last_sign_in_at: now,
    updated_at: now,
  }
}

async function readBody(response: Response) {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() }
  }
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>
    return String(record.message || record.error || fallback)
  }

  return fallback
}

async function insforgeDatabaseRequest(path: string, accessToken: string, init: RequestInit = {}) {
  const { baseUrl, apiKey } = getInsForgeConfig()
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  headers.set("Authorization", `Bearer ${accessToken}`)
  headers.set("x-insforge-api-key", apiKey)

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })

  return {
    response,
    body: await readBody(response),
  }
}

export async function syncUserProfile(accessToken: string, user: AuthUser | undefined, event: ProfileSyncEvent) {
  if (!accessToken || !user?.id) return

  const profile = normalizeUserProfile(user, event)
  const insertResult = await insforgeDatabaseRequest("/api/database/records/users", accessToken, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([profile]),
  })

  if (insertResult.response.ok) return

  if (insertResult.response.status !== 409) {
    throw new Error(getErrorMessage(insertResult.body, "Could not sync user profile."))
  }

  const updateResult = await insforgeDatabaseRequest(
    `/api/database/records/users?id=eq.${encodeURIComponent(profile.id)}`,
    accessToken,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(profile),
    }
  )

  if (!updateResult.response.ok) {
    throw new Error(getErrorMessage(updateResult.body, "Could not update user profile."))
  }
}

export function getOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host")
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

export function isSafeInternalPath(value: string | null | undefined) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"))
}
