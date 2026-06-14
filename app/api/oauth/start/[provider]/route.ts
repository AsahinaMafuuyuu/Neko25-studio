import { createServerClient } from "@insforge/sdk/ssr"
import { NextRequest, NextResponse } from "next/server"

const allowedProviders = new Set(["google", "x"])
const verifierCookie = "insforge_code_verifier"

type OAuthInitResponse = {
  authUrl?: string
  message?: string
  error?: string
}

function getErrorMessage(body: OAuthInitResponse, fallback: string) {
  return body.message || body.error || fallback
}

function isAllowedRedirect(redirectUri: string, requestUrl: string) {
  try {
    const redirectUrl = new URL(redirectUri)
    const originUrl = new URL(requestUrl)
    return redirectUrl.origin === originUrl.origin && redirectUrl.pathname === "/auth/callback"
  } catch {
    return false
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await context.params
    const requestUrl = new URL(request.url)
    const redirectUri = requestUrl.searchParams.get("redirect_uri")

    if (!allowedProviders.has(provider)) {
      return Response.json({ message: "Unsupported OAuth provider." }, { status: 400 })
    }

    if (!redirectUri || !isAllowedRedirect(redirectUri, request.url)) {
      return Response.json({ message: "Invalid OAuth redirect URI." }, { status: 400 })
    }

    const client = createServerClient()
    const { data, error } = await client.auth.signInWithOAuth(provider, {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    })

    if (error) {
      return Response.json(
        { message: getErrorMessage(error, `${provider} OAuth could not be started.`) },
        { status: error.statusCode || 400 }
      )
    }

    if (!data.url || !data.codeVerifier) {
      return Response.json({ message: `${provider} OAuth did not return an authorization URL.` }, { status: 502 })
    }

    const response = NextResponse.json({ authUrl: data.url })
    response.cookies.set(verifierCookie, data.codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    })

    return response
  } catch (error) {
    return Response.json(
      {
        message: error instanceof Error ? error.message : "OAuth could not be started.",
      },
      { status: 500 }
    )
  }
}
