"use client"

import { getDevelopmentAuthBypassUser, isDevelopmentAuthBypassEnabled } from "@/lib/auth/dev-bypass"
import type { AuthResult, AuthSession, AuthUser, OAuthProvider, SignUpResult, VerifyEmailResult } from "@/lib/auth/types"

const legacyAccessTokenKey = "kravix.insforge.accessToken"
const legacyCsrfTokenKey = "kravix.insforge.csrfToken"
const legacyOAuthVerifierKey = "kravix.insforge.oauthVerifier"
const oauthNextKey = "kravix.supabase.oauthNext"
const legacyAppSessionCookie = "kravix_ai_studio_session"
const accessTokenCookie = "supabase_access_token"
const refreshTokenCookie = "supabase_refresh_token"
const legacyInsforgeAccessTokenCookie = "insforge_access_token"
const legacyInsforgeCsrfTokenCookie = "insforge_csrf_token"
const csrfTokenCookie = "supabase_csrf_token"
const supportedOAuthProviders = new Set<OAuthProvider>(["google", "x"])
const defaultRequestTimeoutMs = 15_000

function getCookie(name: string) {
  if (typeof document === "undefined") return null
  const prefix = `${name}=`
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  return value ? decodeURIComponent(value.slice(prefix.length)) : null
}

function getJwtExpirationMs(token: string) {
  const [, payload] = token.split(".")
  if (!payload) return 0

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/")
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    )
    const decodedPayload = JSON.parse(atob(paddedPayload)) as { exp?: unknown }
    return typeof decodedPayload.exp === "number" ? decodedPayload.exp * 1000 : 0
  } catch {
    return 0
  }
}

function shouldRefreshAccessToken(token: string) {
  const expiresAt = getJwtExpirationMs(token)
  if (!expiresAt) return false

  return expiresAt - Date.now() < 60_000
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = defaultRequestTimeoutMs) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Authentication request timed out. Please try again.")
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function postJson<T>(path: string, payload: Record<string, unknown> = {}) {
  const response = await fetchWithTimeout(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  })
  const body = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string }

  if (!response.ok) {
    throw new Error(body.message || body.error || "Request failed.")
  }

  return body
}

export function getCurrentAccessToken() {
  return getCookie(accessTokenCookie)
}

export async function refreshSession() {
  const response = await fetchWithTimeout("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })
  const body = (await response.json().catch(() => ({}))) as AuthSession & { message?: string }

  if (!response.ok || !body.accessToken) {
    return null
  }

  return body
}

export async function getValidAccessToken() {
  const token = getCookie(accessTokenCookie)

  if (token && !shouldRefreshAccessToken(token)) {
    return token
  }

  const refreshed = await refreshSession().catch(() => null)
  return refreshed?.accessToken || getCookie(accessTokenCookie)
}

export function clearLocalSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(legacyAccessTokenKey)
  window.localStorage.removeItem(legacyCsrfTokenKey)
  window.sessionStorage.removeItem(legacyOAuthVerifierKey)
  document.cookie = `${legacyAppSessionCookie}=; Path=/; Max-Age=0; SameSite=Lax`
  document.cookie = `${accessTokenCookie}=; Path=/; Max-Age=0; SameSite=Lax`
  document.cookie = `${refreshTokenCookie}=; Path=/; Max-Age=0; SameSite=Lax`
  document.cookie = `${csrfTokenCookie}=; Path=/; Max-Age=0; SameSite=Lax`
  document.cookie = `${legacyInsforgeAccessTokenCookie}=; Path=/; Max-Age=0; SameSite=Lax`
  document.cookie = `${legacyInsforgeCsrfTokenCookie}=; Path=/; Max-Age=0; SameSite=Lax`
}

export async function getCurrentUser() {
  await getValidAccessToken().catch(() => null)

  const response = await fetchWithTimeout("/api/auth/user", {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })
  if (!response.ok) {
    return isDevelopmentAuthBypassEnabled() ? getDevelopmentAuthBypassUser() : null
  }

  const body = (await response.json().catch(() => ({}))) as { user?: AuthUser | null }
  return body.user || (isDevelopmentAuthBypassEnabled() ? getDevelopmentAuthBypassUser() : null)
}

export function isTwoFactorChallenge(value: unknown): value is Extract<AuthResult, { requiresTwoFactor: true }> {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as { requiresTwoFactor?: unknown }).requiresTwoFactor === true &&
    typeof (value as { challengeId?: unknown }).challengeId === "string"
  )
}

export async function signInWithPassword(email: string, password: string) {
  const session = await postJson<AuthResult>("/api/auth/sign-in", { email, password })

  return session
}

export async function signUpWithPassword(name: string, email: string, password: string) {
  return postJson<SignUpResult>("/api/auth/sign-up", { name, email, password })
}

export async function verifyEmailCode(email: string, otp: string) {
  const result = await postJson<VerifyEmailResult>("/api/auth/verify-email", { email, otp })
  return result
}

export async function resendVerificationEmail(email: string) {
  return postJson<{ success: boolean; message?: string }>("/api/auth/resend-verification", { email })
}

export async function signOut() {
  try {
    await postJson("/api/auth/sign-out", {})
  } catch {
    // Local logout should still succeed when the remote session endpoint is unavailable.
  } finally {
    clearLocalSession()
  }
}

function getProfileValue(user: AuthUser, keys: string[]) {
  for (const key of keys) {
    const directValue = user[key]
    if (typeof directValue === "string" && directValue.trim()) return directValue
  }

  const sources = [user.profile, user.metadata, user.user_metadata, user.app_metadata]
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

function buildProfilePayload(user: AuthUser) {
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

export async function getOAuthProviders() {
  return new Set<OAuthProvider>(["google", "x"])
}

export async function ensureOAuthProvider(provider: OAuthProvider) {
  const providers = await getOAuthProviders()
  if (!providers.has(provider)) {
    throw new Error(`${provider} OAuth is not enabled.`)
  }

  return { provider, enabled: true }
}

export async function startOAuth(provider: OAuthProvider, next = "/dashboard") {
  if (!supportedOAuthProviders.has(provider)) {
    throw new Error("Unsupported OAuth provider.")
  }

  window.sessionStorage.setItem(oauthNextKey, next)
  const redirectTo = new URL("/auth/callback", window.location.origin)
  const url = new URL(`/api/oauth/start/${provider}`, window.location.origin)
  url.searchParams.set("redirect_uri", redirectTo.toString())

  const response = await fetchWithTimeout(`${url.pathname}${url.search}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })
  const body = (await response.json().catch(() => ({}))) as { authUrl?: string; message?: string }

  if (!response.ok) {
    window.sessionStorage.removeItem(oauthNextKey)
    throw new Error(body.message || `${provider} OAuth could not be started.`)
  }

  if (!body.authUrl) {
    window.sessionStorage.removeItem(oauthNextKey)
    throw new Error(`${provider} OAuth did not return an authorization URL.`)
  }

  window.location.assign(body.authUrl)
}

export async function completeOAuth(code: string) {
  return postJson<AuthResult>("/api/auth/oauth/complete", { code })
}

export async function verifyTwoFactorChallenge(challengeId: string, code: string) {
  return postJson<AuthSession>("/api/auth/2fa/verify", { challengeId, code })
}

export function getOAuthNext() {
  if (typeof window === "undefined") return "/dashboard"
  const next = window.sessionStorage.getItem(oauthNextKey) || "/dashboard"
  window.sessionStorage.removeItem(oauthNextKey)
  return next
}

export async function retryUserProfileSync() {
  const user = await getCurrentUser()
  if (!user?.id) {
    throw new Error("Cannot sync user profile before signing in.")
  }

  const response = await fetchWithTimeout("/api/profile/sync", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getValidAccessToken()}`,
    },
    body: JSON.stringify({ profile: buildProfilePayload(user) }),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message || "Could not sync user profile.")
  }
}

export async function syncAuthenticatedUserFromCurrentSession() {
  return getCurrentUser()
}
