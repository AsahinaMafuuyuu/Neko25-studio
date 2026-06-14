type ProfilePayload = {
  id?: string
  name?: string
  email?: string
  avatar_url?: string
  providers?: string[]
  email_verified?: boolean
  last_sign_in_at?: string
  updated_at?: string
}

type InsForgeResult = {
  response: Response
  body: unknown
}

function getInsForgeConfig() {
  const baseUrl = process.env.INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error("InsForge is not configured. Add INSFORGE_URL and INSFORGE_API_KEY.")
  }

  return { baseUrl, apiKey }
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

function normalizeProfile(value: unknown) {
  const profile = value && typeof value === "object" ? (value as ProfilePayload) : {}

  if (!profile.id || typeof profile.id !== "string") {
    throw new Error("Missing authenticated user id for profile sync.")
  }

  return {
    id: profile.id,
    name: typeof profile.name === "string" ? profile.name : "",
    email: typeof profile.email === "string" ? profile.email : "",
    avatar_url: typeof profile.avatar_url === "string" ? profile.avatar_url : "",
    providers: Array.isArray(profile.providers) ? profile.providers.map(String) : [],
    email_verified: Boolean(profile.email_verified),
    last_sign_in_at: typeof profile.last_sign_in_at === "string" ? profile.last_sign_in_at : new Date().toISOString(),
    updated_at: typeof profile.updated_at === "string" ? profile.updated_at : new Date().toISOString(),
  }
}

async function insforgeDatabaseRequest(path: string, accessToken: string, init: RequestInit = {}): Promise<InsForgeResult> {
  const { baseUrl, apiKey } = getInsForgeConfig()
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  headers.set("Authorization", `Bearer ${accessToken}`)
  headers.set("x-insforge-api-key", apiKey)

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })

  const text = await response.text()
  const body = text ? tryParseJson(text) : {}

  return { response, body }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") || ""
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : ""

    if (!accessToken) {
      return Response.json({ message: "Missing authenticated session token." }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { profile?: unknown }
    const profile = normalizeProfile(body.profile)

    const insertResult = await insforgeDatabaseRequest("/api/database/records/users", accessToken, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([profile]),
    })

    if (insertResult.response.ok) {
      return Response.json({ profile: insertResult.body })
    }

    if (insertResult.response.status !== 409) {
      return Response.json(
        { message: getErrorMessage(insertResult.body, "Could not sync user profile.") },
        { status: insertResult.response.status }
      )
    }

    const updateResult = await insforgeDatabaseRequest(
      `/api/database/records/users?id=eq.${encodeURIComponent(profile.id)}`,
      accessToken,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(profile),
      }
    )

    if (!updateResult.response.ok) {
      return Response.json(
        { message: getErrorMessage(updateResult.body, "Could not update user profile.") },
        { status: updateResult.response.status }
      )
    }

    return Response.json({ profile: updateResult.body })
  } catch (error) {
    return Response.json(
      {
        message: error instanceof Error ? error.message : "Could not sync user profile.",
      },
      { status: 500 }
    )
  }
}
