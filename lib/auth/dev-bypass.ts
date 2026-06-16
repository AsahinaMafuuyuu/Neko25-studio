import type { AuthUser } from "@/lib/auth/types"

export function isDevelopmentAuthBypassEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS !== "false"
  )
}

export function getDevelopmentAuthBypassUser(): AuthUser {
  const email = process.env.NEXT_PUBLIC_DEV_AUTH_EMAIL || "dev-preview@kravix.local"
  const name = process.env.NEXT_PUBLIC_DEV_AUTH_NAME || "Development Preview"
  const avatarUrl = process.env.NEXT_PUBLIC_DEV_AUTH_AVATAR_URL || ""

  return {
    id: "dev-auth-bypass-user",
    email,
    name,
    avatar_url: avatarUrl,
    avatarUrl,
    email_verified: true,
    emailVerified: true,
    providers: ["development"],
    profile: {
      name,
      email,
      avatar_url: avatarUrl,
    },
    metadata: {
      authBypass: true,
    },
  }
}
