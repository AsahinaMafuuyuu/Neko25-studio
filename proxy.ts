import { NextResponse, type NextRequest } from "next/server"

const appSessionCookie = "kravix_ai_studio_session"

export function proxy(request: NextRequest) {
  const hasSessionHint = request.cookies.has(appSessionCookie)

  if (!hasSessionHint) {
    const signInUrl = new URL("/sign-in", request.url)
    signInUrl.searchParams.set("next", request.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/studio/:path*"],
}
