export type OAuthProvider = "google" | "x"

export type AuthUser = {
  id: string
  email?: string
  name?: string
  avatar_url?: string
  avatarUrl?: string
  email_verified?: boolean
  emailVerified?: boolean
  providers?: string[]
  profile?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
  [key: string]: unknown
}

export type AuthSession = {
  accessToken?: string
  refreshToken?: string
  user?: AuthUser
}

export type TwoFactorAuthChallenge = {
  requiresTwoFactor: true
  challengeId: string
  user?: {
    email?: string
    name?: string
  }
}

export type AuthResult = AuthSession | TwoFactorAuthChallenge

export type SignUpResult = AuthSession & {
  created?: boolean
  needsEmailVerification?: boolean
  verificationMethod?: "code" | "link"
}

export type VerifyEmailResult = {
  verified: boolean
  user?: AuthUser
}

export type ProfileSyncEvent = "sign_in" | "sign_up" | "oauth"
