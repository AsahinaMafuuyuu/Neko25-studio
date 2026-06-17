import { NextRequest, NextResponse } from "next/server"

import { createSupabaseRouteClient, mapOAuthProvider } from "@/lib/supabase/server"
import type { OAuthProvider } from "@/lib/auth/types"

const allowedProviders = new Set(["google", "x"])

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

    const routeClient = createSupabaseRouteClient(request)
    const { data, error } = await routeClient.client.auth.signInWithOAuth({
      provider: mapOAuthProvider(provider as OAuthProvider),
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      return Response.json(
        { message: getErrorMessage(error, `${provider} OAuth could not be started.`) },
        { status: error.status || 400 }
      )
    }

    if (!data.url) {
      return Response.json({ message: `${provider} OAuth did not return an authorization URL.` }, { status: 502 })
    }

    const response = NextResponse.json({ authUrl: data.url })
    return routeClient.applyCookies(response)
  } catch (error) {
    return Response.json(
      {
        message: error instanceof Error ? error.message : "OAuth could not be started.",
      },
      { status: 500 }
    )
  }
}
