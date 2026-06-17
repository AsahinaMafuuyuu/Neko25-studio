import { createRequire } from "node:module"

import { createServerClient } from "@supabase/ssr"
import { createClient, type Provider, type Session, type User } from "@supabase/supabase-js"
import type { NextRequest, NextResponse } from "next/server"

import type { AuthSession, AuthUser, OAuthProvider } from "@/lib/auth/types"

type PendingCookie = {
  name: string
  value: string
  options?: Record<string, unknown>
}

type WebSocketConstructor = typeof WebSocket

export const supabaseAccessTokenCookie = "supabase_access_token"
export const supabaseRefreshTokenCookie = "supabase_refresh_token"
export const legacyAccessTokenCookie = "insforge_access_token"
export const legacyCsrfTokenCookie = "insforge_csrf_token"
export const legacyOAuthVerifierCookie = "insforge_code_verifier"
export const legacyAppSessionCookie = "kravix_ai_studio_session"

const nodeRequire = createRequire(import.meta.url)

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function readSupabaseUrl() {
  const value = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "")
  if (!/^https?:\/\//i.test(value)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must start with http:// or https://.")
  }
  return value
}

export function getSupabaseConfig() {
  return {
    url: readSupabaseUrl(),
    anonKey: readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  }
}

function getRealtimeTransport(): WebSocketConstructor | undefined {
  if (typeof globalThis.WebSocket === "function") return globalThis.WebSocket

  try {
    const wsModule = nodeRequire("ws") as
      | WebSocketConstructor
      | {
          WebSocket?: WebSocketConstructor
          default?: WebSocketConstructor
        }

    if (typeof wsModule === "function") return wsModule
    if (typeof wsModule.WebSocket === "function") return wsModule.WebSocket
    if (typeof wsModule.default === "function") return wsModule.default
  } catch {
    return undefined
  }

  return undefined
}

function getSupabaseClientOptions() {
  const transport = getRealtimeTransport()

  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    realtime: transport ? { transport } : undefined,
  }
}

export function createSupabaseAnonClient() {
  const { url, anonKey } = getSupabaseConfig()
  const options = getSupabaseClientOptions()

  return createClient(url, anonKey, {
    ...options,
    auth: { ...options.auth, flowType: "pkce" },
  })
}

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseConfig()
  return createClient(url, serviceRoleKey, getSupabaseClientOptions())
}

export function createSupabaseRouteClient(request: NextRequest) {
  const { url, anonKey } = getSupabaseConfig()
  const pendingCookies: PendingCookie[] = []
  const client = createServerClient(url, anonKey, {
    ...getSupabaseClientOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }))
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet)
      },
    },
  })

  return {
    client,
    applyCookies(response: NextResponse) {
      for (const cookie of pendingCookies) {
        response.cookies.set(cookie.name, cookie.value, cookie.options)
      }
      return response
    },
  }
}

export function mapOAuthProvider(provider: OAuthProvider): Provider {
  return provider === "x" ? "twitter" : provider
}

export function toAuthUser(user: User | null | undefined): AuthUser | undefined {
  if (!user) return undefined
  const metadata = user.user_metadata || {}
  const appMetadata = user.app_metadata || {}

  return {
    id: user.id,
    email: user.email || undefined,
    name: readMetadataString(metadata, ["name", "full_name", "displayName", "display_name"]),
    avatar_url: readMetadataString(metadata, ["avatar_url", "avatarUrl", "picture", "image"]),
    email_verified: Boolean(user.email_confirmed_at),
    emailVerified: Boolean(user.email_confirmed_at),
    providers: Array.isArray(appMetadata.providers) ? appMetadata.providers.map(String) : [],
    metadata,
    user_metadata: metadata,
    app_metadata: appMetadata,
  }
}

export function toAuthSession(session: Session | null | undefined): AuthSession {
  return {
    accessToken: session?.access_token,
    refreshToken: session?.refresh_token,
    user: toAuthUser(session?.user),
  }
}

export function writeSessionCookies(response: NextResponse, session: AuthSession) {
  clearAuthSessionCookies(response)
  if (!session.accessToken) return

  response.cookies.set(supabaseAccessTokenCookie, session.accessToken, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: getJwtMaxAgeSeconds(session.accessToken),
  })

  if (session.refreshToken) {
    response.cookies.set(supabaseRefreshTokenCookie, session.refreshToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    })
  }
}

export function clearAuthSessionCookies(response: NextResponse) {
  for (const name of [
    supabaseAccessTokenCookie,
    supabaseRefreshTokenCookie,
    legacyAccessTokenCookie,
    legacyCsrfTokenCookie,
    legacyOAuthVerifierCookie,
    legacyAppSessionCookie,
  ]) {
    response.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    })
  }
}

function readMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) return value
  }

  return undefined
}

function getJwtMaxAgeSeconds(token: string) {
  const [, payload] = token.split(".")
  if (!payload) return 60 * 60

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { exp?: unknown }
    if (typeof decoded.exp !== "number") return 60 * 60
    return Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0)
  } catch {
    return 60 * 60
  }
}
