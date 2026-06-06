const allowedProviders = new Set(["google", "x"])

type OAuthConfig = {
  provider?: string
  clientId?: string
  useSharedKey?: boolean
}

type OAuthConfigList = {
  data?: OAuthConfig[]
}

function getInsForgeConfig() {
  const baseUrl = process.env.INSFORGE_URL || process.env.NEXT_PUBLIC_INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error("InsForge is not configured. Add INSFORGE_URL and INSFORGE_API_KEY.")
  }

  return { baseUrl, apiKey }
}

async function insforgeRequest(path: string, init: RequestInit = {}) {
  const { baseUrl, apiKey } = getInsForgeConfig()
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  headers.set("Authorization", `Bearer ${apiKey}`)
  headers.set("x-insforge-api-key", apiKey)

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })

  const text = await response.text()
  const body = text ? tryParseJson(text) : {}

  return { response, body }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() }
  }
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>
    return String(record.message || record.error || fallback)
  }

  return fallback
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { provider?: string }
    const provider = body.provider

    if (!provider || !allowedProviders.has(provider)) {
      return Response.json({ message: "Unsupported OAuth provider." }, { status: 400 })
    }

    const listResult = await insforgeRequest("/api/auth/oauth/configs", {
      method: "GET",
    })

    if (!listResult.response.ok) {
      return Response.json(
        {
          message: getErrorMessage(listResult.body, `Could not read ${provider} OAuth configuration.`),
        },
        { status: listResult.response.status }
      )
    }

    const configs = listResult.body as OAuthConfigList
    const existingConfig = configs.data?.find((config) => config.provider === provider)

    if (existingConfig) {
      if (!existingConfig.useSharedKey && !existingConfig.clientId) {
        const updateResult = await insforgeRequest(`/api/auth/oauth/configs/${provider}`, {
          method: "PUT",
          body: JSON.stringify({
            useSharedKey: true,
          }),
        })

        if (!updateResult.response.ok) {
          return Response.json(
            {
              message: getErrorMessage(updateResult.body, `Could not enable ${provider} OAuth.`),
            },
            { status: updateResult.response.status }
          )
        }
      }

      return Response.json({ provider, enabled: true })
    }

    const createResult = await insforgeRequest("/api/auth/oauth/configs", {
      method: "POST",
      body: JSON.stringify({
        provider,
        useSharedKey: true,
      }),
    })

    if (!createResult.response.ok) {
      return Response.json(
        {
          message: getErrorMessage(createResult.body, `Could not enable ${provider} OAuth.`),
        },
        { status: createResult.response.status }
      )
    }

    return Response.json({ provider, enabled: true })
  } catch (error) {
    return Response.json(
      {
        message: error instanceof Error ? error.message : "Could not enable OAuth provider.",
      },
      { status: 500 }
    )
  }
}
