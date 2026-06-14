import createMiddleware from "next-intl/middleware"
import { updateSession } from "@insforge/sdk/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { routing } from "@/src/i18n/routing"

const intlMiddleware = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = getPathLocale(pathname)
  const unprefixedPathname = stripLocale(pathname)
  const response = intlMiddleware(request)
  const requestCookies = {
    get: (name: string) => request.cookies.get(name),
  } as Parameters<typeof updateSession>[0]["requestCookies"]
  const session = await updateSession({
    requestCookies,
    responseCookies: response.cookies,
  }).catch(() => null)
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
