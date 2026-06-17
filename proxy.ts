import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"

import { isDevelopmentAuthBypassEnabled } from "@/lib/auth/dev-bypass"
import { routing } from "@/src/i18n/routing"

const intlMiddleware = createMiddleware(routing)
const accessTokenCookie = "supabase_access_token"
const refreshTokenCookie = "supabase_refresh_token"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = getPathLocale(pathname)
  const unprefixedPathname = stripLocale(pathname)
  const response = intlMiddleware(request)

  if (isProtectedAppPath(unprefixedPathname) && isDevelopmentAuthBypassEnabled()) {
    return response
  }

  const session = await getUsableSession(request, response).catch(() => null)
  const hasUsableSession = Boolean(session?.accessToken)

  if (isProtectedAppPath(unprefixedPathname) && !hasUsableSession) {
    const signInUrl = new URL(`/${locale}/sign-in`, request.url)
    signInUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(signInUrl)
  }

  return response
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
}

function getPathLocale(pathname: string) {
  const segment = pathname.split("/")[1]
  return routing.locales.includes(segment as (typeof routing.locales)[number])
    ? segment
    : routing.defaultLocale
}

function stripLocale(pathname: string) {
  const locale = getPathLocale(pathname)
  return pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
    ? pathname.slice(locale.length + 1) || "/"
    : pathname
}

function isProtectedAppPath(pathname: string) {
  return pathname.startsWith("/studio") || pathname.startsWith("/dashboard")
}

async function getUsableSession(request: NextRequest, response: NextResponse) {
  const accessToken = request.cookies.get(accessTokenCookie)?.value
  if (accessToken && (await verifyAccessToken(accessToken))) {
    return { accessToken }
  }

  const refreshToken = request.cookies.get(refreshTokenCookie)?.value
  if (!refreshToken) return null

  const refreshed = await refreshSupabaseSession(refreshToken)
  if (!refreshed?.access_token) return null

  response.cookies.set(accessTokenCookie, refreshed.access_token, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.max(Number(refreshed.expires_in || 3600), 0),
  })
  if (refreshed.refresh_token) {
    response.cookies.set(refreshTokenCookie, refreshed.refresh_token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  return { accessToken: refreshed.access_token }
}

async function verifyAccessToken(accessToken: string) {
  const config = getSupabasePublicConfig()
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  return response.ok
}

async function refreshSupabaseSession(refreshToken: string) {
  const config = getSupabasePublicConfig()
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) return null
  return (await response.json().catch(() => null)) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  } | null
}

function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Supabase public configuration is missing.")
  return { url: url.replace(/\/+$/, ""), anonKey }
}
