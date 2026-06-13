import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"

import { routing } from "@/src/i18n/routing"

const appSessionCookie = "kravix_ai_studio_session"
const intlMiddleware = createMiddleware(routing)

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = getPathLocale(pathname)
  const unprefixedPathname = stripLocale(pathname)
  const hasSessionHint = request.cookies.has(appSessionCookie)

  if (unprefixedPathname.startsWith("/studio") && !hasSessionHint) {
    const signInUrl = new URL(`/${locale}/sign-in`, request.url)
    signInUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(signInUrl)
  }

  return intlMiddleware(request)
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
