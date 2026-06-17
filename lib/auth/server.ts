import type { NextResponse } from "next/server"

import type { AuthSession, AuthUser, ProfileSyncEvent } from "@/lib/auth/types"
import {
  clearAuthSessionCookies,
  createSupabaseAnonClient,
  createSupabaseAdminClient,
  toAuthSession,
  toAuthUser,
  writeSessionCookies,
} from "@/lib/supabase/server"

type TokenSession = {
  accessToken?: string | null
  refreshToken?: string | null
  user?: AuthUser
}

export function createAuthServerClient() {
  return createSupabaseAnonClient()
}

export function createAuthAdminClient() {
  return createSupabaseAdminClient()
}

export function normalizeSupabaseSession(session: Parameters<typeof toAuthSession>[0]): AuthSession {
  return toAuthSession(session)
}

export function normalizeSupabaseUser(user: Parameters<typeof toAuthUser>[0]): AuthUser | undefined {
  return toAuthUser(user)
}

export function writeAuthCookies(response: NextResponse, session: TokenSession) {
  writeSessionCookies(response, {
    accessToken: session.accessToken || undefined,
    refreshToken: session.refreshToken || undefined,
    user: session.user,
  })
}

export function clearAllAuthCookies(response: NextResponse) {
  clearAuthSessionCookies(response)
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

export async function syncUserProfile(accessToken: string, user: AuthUser | undefined, event: ProfileSyncEvent) {
  if (!accessToken || !user?.id) return

  const admin = createSupabaseAdminClient()
  const profile = normalizeUserProfile(user, event)
  const { error } = await admin.from("users").upsert(profile, { onConflict: "id" }).select()

  if (error) {
    throw new Error(error.message || "Could not sync user profile.")
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
