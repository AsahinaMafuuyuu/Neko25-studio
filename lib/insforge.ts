export type OAuthProvider = "google" | "x"

export type AuthUser = {
  id: string
  email?: string
  name?: string
  avatar_url?: string
  avatarUrl?: string
  email_verified?: boolean
  emailVerified?: boolean
  providers?: string[]
  profile?: Record<string, unknown>
  metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
  [key: string]: unknown
}

type AuthSession = {
  accessToken?: string
  csrfToken?: string
  user?: AuthUser
}

type PublicConfig = {
  oAuthProviders?: string[]
  customOAuthProviders?: string[]
  auth?: {
    oauth?: {
      providers?: string[]
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

type OAuthInitResponse = {
  authUrl?: string
}

type ProfileSyncEvent = "sign_in" | "sign_up" | "oauth"

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
const apiKey = process.env.NEXT_PUBLIC_INSFORGE_API_KEY

const accessTokenKey = "kravix.insforge.accessToken"
const csrfTokenKey = "kravix.insforge.csrfToken"
const oauthVerifierKey = "kravix.insforge.oauthVerifier"
const oauthNextKey = "kravix.insforge.oauthNext"
const appSessionCookie = "kravix_ai_studio_session"

function requireConfig() {
  if (!baseUrl || !apiKey) {
    throw new Error("InsForge is not configured. Add NEXT_PUBLIC_INSFORGE_URL and NEXT_PUBLIC_INSFORGE_API_KEY.")
  }
}

function getStoredAccessToken() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(accessTokenKey)
}

function getStoredCsrfToken() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(csrfTokenKey)
}

function storeSession(session: AuthSession) {
  if (typeof window === "undefined") return

  if (session.accessToken) {
    window.localStorage.setItem(accessTokenKey, session.accessToken)
    document.cookie = `${appSessionCookie}=active; Path=/; Max-Age=2592000; SameSite=Lax`
  }

  if (session.csrfToken) {
    window.localStorage.setItem(csrfTokenKey, session.csrfToken)
  }
}

export function clearLocalSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(accessTokenKey)
  window.localStorage.removeItem(csrfTokenKey)
  document.cookie = `${appSessionCookie}=; Path=/; Max-Age=0; SameSite=Lax`
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return undefined
}

function readString(sources: Array<Record<string, unknown> | undefined>, keys: string[]) {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      const value = source[key]
      if (typeof value === "string" && value.trim()) return value
    }
  }

  return ""
}

function readUser(sources: Array<unknown>) {
  for (const source of sources) {
    const record = asRecord(source)
    if (record && typeof record.id === "string" && record.id.trim()) {
      return record as AuthUser
    }
  }

  return undefined
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  requireConfig()

  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  headers.set("x-insforge-api-key", apiKey!)

  const token = getStoredAccessToken()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })

  const text = await response.text()
  const contentType = response.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")
  let body: Record<string, unknown> | string = {}

  if (text && isJson) {
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      body = text
    }
  } else if (text) {
    body = text
  }

  if (!response.ok) {
    const message =
      typeof body === "string"
        ? body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        : body.message || body.error

    throw new Error(
      `${response.status} ${response.statusText || "InsForge request failed"} for ${path}${
        message ? `: ${String(message).slice(0, 180)}` : ""
      }`
    )
  }

  return body as T
}

async function databaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  requireConfig()

  const token = getStoredAccessToken()
  if (!token) {
    throw new Error("Cannot sync user profile before an InsForge session is stored.")
  }

  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  headers.set("x-insforge-api-key", apiKey!)
  headers.set("Authorization", `Bearer ${token}`)

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })

  const text = await response.text()
  const contentType = response.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")
  let body: Record<string, unknown> | string | unknown[] = {}

  if (text && isJson) {
    try {
      body = JSON.parse(text) as Record<string, unknown> | unknown[]
    } catch {
      body = text
    }
  } else if (text) {
    body = text
  }

  if (!response.ok) {
    const message =
      typeof body === "string"
        ? body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        : Array.isArray(body)
          ? ""
          : body.message || body.error

    throw new Error(
      `${response.status} ${response.statusText || "InsForge database request failed"} for ${path}${
        message ? `: ${String(message).slice(0, 180)}` : ""
      }`
    )
  }

  return body as T
}

function normalizeSession(body: Record<string, unknown>): AuthSession {
  const data = asRecord(body.data)
  const session = asRecord(body.session) || asRecord(data?.session)
  const auth = asRecord(body.auth) || asRecord(data?.auth)
  const profile = asRecord(body.profile) || asRecord(data?.profile)
  const sources = [body, data, session, auth]

  return {
    accessToken: readString(sources, [
      "accessToken",
      "access_token",
      "access",
      "token",
      "jwt",
      "idToken",
      "id_token",
    ]),
    csrfToken: readString(sources, ["csrfToken", "csrf_token", "csrf"]),
    user: readUser([
      body.user,
      data?.user,
      session?.user,
      auth?.user,
      profile,
      data,
      body,
    ]),
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

  const source = user.app_metadata || user.metadata
  const providers = source?.providers || source?.provider
  if (Array.isArray(providers)) return providers.map(String)
  if (typeof providers === "string" && providers.trim()) return [providers]

  return []
}

async function syncCurrentUserProfile(user: AuthUser | undefined, _event: ProfileSyncEvent) {
  void _event
  if (!user?.id) return

  const now = new Date().toISOString()
  const payload = {
    id: user.id,
    name: getProfileValue(user, ["name", "full_name", "displayName", "display_name"]),
    email: getProfileValue(user, ["email"]),
    avatar_url: getProfileValue(user, ["avatar_url", "avatarUrl", "picture", "image"]),
    providers: getProviders(user),
    email_verified: Boolean(user.emailVerified || user.email_verified),
    last_sign_in_at: now,
    updated_at: now,
  }

  try {
    await databaseRequest("/api/database/records/users", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([payload]),
    })
  } catch (error) {
    if (!String(error instanceof Error ? error.message : error).includes("409")) {
      throw error
    }

    await databaseRequest(`/api/database/records/users?id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    })
  }
}

async function ensureSessionUser(session: AuthSession) {
  if (session.user?.id) return session.user

  if (!session.accessToken && !getStoredAccessToken()) {
    throw new Error("InsForge authenticated the user, but did not return an access token for database sync.")
  }

  const body = await request<Record<string, unknown>>("/api/auth/sessions/current")
  const normalized = normalizeSession(body)
  const user = normalized.user
  if (!user?.id) {
    throw new Error("InsForge current session did not return a user id for database sync.")
  }

  session.user = user
  return user
}

async function syncCurrentUserProfileOrThrow(session: AuthSession, event: ProfileSyncEvent) {
  const user = await ensureSessionUser(session)

  if (!user?.id) {
    throw new Error("InsForge authenticated the user, but did not return a user id for database sync.")
  }

  await syncCurrentUserProfile(user, event)
}

async function syncCurrentUserProfileSafely(session: AuthSession, event: ProfileSyncEvent) {
  try {
    await syncCurrentUserProfileOrThrow(session, event)
  } catch (error) {
    console.error("Failed to sync InsForge user profile.", error)
    throw new Error(
      error instanceof Error
        ? `Authentication succeeded, but saving the user profile failed: ${error.message}`
        : "Authentication succeeded, but saving the user profile failed."
    )
  }
}

export async function retryUserProfileSync(event: ProfileSyncEvent = "sign_in") {
  const session: AuthSession = {
    accessToken: getStoredAccessToken() || undefined,
    csrfToken: getStoredCsrfToken() || undefined,
  }

  await syncCurrentUserProfileSafely(session, event)
}

export async function syncAuthenticatedUserFromCurrentSession(event: ProfileSyncEvent = "sign_in") {
  const user = await getCurrentUser()
  if (!user?.id) {
    throw new Error("No current InsForge user is available for database sync.")
  }

  await syncCurrentUserProfile(user, event)
  return user
}

export async function signInWithPassword(email: string, password: string) {
  const body = await request<Record<string, unknown>>("/api/auth/sessions", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  const session = normalizeSession(body)
  storeSession(session)
  await syncCurrentUserProfileSafely(session, "sign_in")
  return session
}

export async function signUpWithPassword(name: string, email: string, password: string) {
  const body = await request<Record<string, unknown>>("/api/auth/users", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  })
  const session = normalizeSession(body)
  storeSession(session)
  await syncCurrentUserProfileSafely(session, "sign_up")
  return session
}

export async function refreshSession() {
  const csrfToken = getStoredCsrfToken()
  if (!csrfToken) return null

  const body = await request<Record<string, unknown>>("/api/auth/refresh", {
    method: "POST",
    headers: {
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({}),
  })
  const session = normalizeSession(body)
  storeSession(session)
  return session
}

export async function getCurrentUser() {
  try {
    const body = await request<Record<string, unknown>>("/api/auth/sessions/current")
    return normalizeSession(body).user || null
  } catch {
    const refreshed = await refreshSession().catch(() => null)
    if (!refreshed?.accessToken) return null
    const body = await request<Record<string, unknown>>("/api/auth/sessions/current")
    return normalizeSession(body).user || null
  }
}

export async function signOut() {
  try {
    await request("/api/auth/sessions/current", {
      method: "DELETE",
      body: JSON.stringify({}),
    })
  } catch {
    // Local logout should still succeed when the remote session endpoint is unavailable.
  } finally {
    clearLocalSession()
  }
}

export async function getOAuthProviders() {
  try {
    const config = await request<PublicConfig>("/api/auth/public-config", {
      method: "GET",
    })
    return new Set([
      ...(config.oAuthProviders || []),
      ...(config.customOAuthProviders || []),
      ...(config.auth?.oauth?.providers || []),
    ])
  } catch {
    return new Set<OAuthProvider>(["google", "x"])
  }
}

export async function ensureOAuthProvider(provider: OAuthProvider) {
  const response = await fetch("/api/oauth/providers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider }),
  })

  const body = (await response.json().catch(() => ({}))) as { message?: string }

  if (!response.ok) {
    throw new Error(body.message || `${provider} OAuth could not be enabled.`)
  }

  return body
}

async function sha256Base64Url(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function randomString(length = 64) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function startOAuth(provider: OAuthProvider, next = "/studio") {
  requireConfig()

  const verifier = randomString()
  const challenge = await sha256Base64Url(verifier)
  const redirectTo = new URL("/auth/callback", window.location.origin)
  redirectTo.searchParams.set("next", next)

  window.sessionStorage.setItem(oauthVerifierKey, verifier)
  window.sessionStorage.setItem(oauthNextKey, next)

  const url = new URL(`/api/oauth/start/${provider}`, window.location.origin)
  url.searchParams.set("redirect_uri", redirectTo.toString())
  url.searchParams.set("code_challenge", challenge)
  url.searchParams.set("code_challenge_method", "S256")

  const response = await fetch(`${url.pathname}${url.search}`)
  const body = (await response.json().catch(() => ({}))) as OAuthInitResponse & { message?: string }

  if (!response.ok) {
    window.sessionStorage.removeItem(oauthVerifierKey)
    window.sessionStorage.removeItem(oauthNextKey)
    throw new Error(body.message || `${provider} OAuth could not be started.`)
  }

  if (!body.authUrl) {
    window.sessionStorage.removeItem(oauthVerifierKey)
    window.sessionStorage.removeItem(oauthNextKey)
    throw new Error(`${provider} OAuth did not return an authorization URL.`)
  }

  window.location.assign(body.authUrl)
}

export async function completeOAuth(code: string) {
  const verifier = window.sessionStorage.getItem(oauthVerifierKey)
  if (!verifier) {
    throw new Error("OAuth session expired. Please try signing in again.")
  }

  const body = await request<Record<string, unknown>>("/api/auth/oauth/exchange", {
    method: "POST",
    body: JSON.stringify({
      code,
      code_verifier: verifier,
    }),
  })

  window.sessionStorage.removeItem(oauthVerifierKey)
  const session = normalizeSession(body)
  storeSession(session)
  await syncCurrentUserProfileSafely(session, "oauth")
  return session
}

export function getOAuthNext() {
  if (typeof window === "undefined") return "/studio"
  const next = window.sessionStorage.getItem(oauthNextKey) || "/studio"
  window.sessionStorage.removeItem(oauthNextKey)
  return next
}
