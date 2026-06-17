import { createAuthAdminClient } from "@/lib/auth/server"

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

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") || ""
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : ""

    if (!accessToken) {
      return Response.json({ message: "Missing authenticated session token." }, { status: 401 })
    }

    const admin = createAuthAdminClient()
    const { data: userResult, error: userError } = await admin.auth.getUser(accessToken)
    if (userError || !userResult.user?.id) {
      return Response.json({ message: userError?.message || "Could not read the current user." }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { profile?: unknown }
    const profile = normalizeProfile(body.profile)
    if (profile.id !== userResult.user.id) {
      return Response.json({ message: "Profile id does not match the authenticated user." }, { status: 403 })
    }

    const { data, error } = await admin.from("users").upsert(profile, { onConflict: "id" }).select()
    if (error) {
      return Response.json({ message: error.message || "Could not sync user profile." }, { status: 400 })
    }

    return Response.json({ profile: data })
  } catch (error) {
    return Response.json(
      {
        message: error instanceof Error ? error.message : "Could not sync user profile.",
      },
      { status: 500 }
    )
  }
}
