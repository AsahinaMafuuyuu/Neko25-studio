const allowedProviders = new Set(["google", "x"])

type OAuthInitResponse = {
  authUrl?: string
  message?: string
  error?: string
}

function getInsForgeConfig() {
  const baseUrl = process.env.INSFORGE_URL || process.env.NEXT_PUBLIC_INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error("InsForge is not configured. Add INSFORGE_URL and INSFORGE_API_KEY.")
  }

  return { baseUrl, apiKey }
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

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await context.params
    const requestUrl = new URL(request.url)
    const redirectUri = requestUrl.searchParams.get("redirect_uri")
    const codeChallenge = requestUrl.searchParams.get("code_challenge")
    const codeChallengeMethod = requestUrl.searchParams.get("code_challenge_method") || "S256"

    if (!allowedProviders.has(provider)) {
      return Response.json({ message: "Unsupported OAuth provider." }, { status: 400 })
    }

    if (!redirectUri || !isAllowedRedirect(redirectUri, request.url)) {
      return Response.json({ message: "Invalid OAuth redirect URI." }, { status: 400 })
    }

    if (!codeChallenge) {
      return Response.json({ message: "Missing OAuth code challenge." }, { status: 400 })
    }

    const { baseUrl, apiKey } = getInsForgeConfig()
    const url = new URL(`/api/auth/oauth/${provider}`, baseUrl)
    url.searchParams.set("redirect_uri", redirectUri)
    url.searchParams.set("code_challenge", codeChallenge)
    url.searchParams.set("code_challenge_method", codeChallengeMethod)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "x-insforge-api-key": apiKey,
      },
    })

    const body = (await response.json().catch(() => ({}))) as OAuthInitResponse

    if (!response.ok) {
      return Response.json(
        { message: getErrorMessage(body, `${provider} OAuth could not be started.`) },
        { status: response.status }
      )
    }

    if (!body.authUrl) {
      return Response.json({ message: `${provider} OAuth did not return an authorization URL.` }, { status: 502 })
    }

    return Response.json({ authUrl: body.authUrl })
  } catch (error) {
    return Response.json(
      {
        message: error instanceof Error ? error.message : "OAuth could not be started.",
      },
      { status: 500 }
    )
  }
}
