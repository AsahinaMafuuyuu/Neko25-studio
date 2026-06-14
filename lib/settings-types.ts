export type DefaultAspectRatio = "16:9" | "9:16"
export type PlanTier = "Free Plan" | "Pro Plan" | "Max Plan"
export type PlanStatus = "active" | "inactive" | "past_due" | "canceled"

export type AccountProfile = {
  id: string
  username: string
  email: string
  phone: string
  description: string
  avatarUrl: string
  emailVerified: boolean
  passwordChangedAt: string | null
  twoFactorEnabled: boolean
}

export type AccountPreferences = {
  emailNotifications: boolean
  defaultAspectRatio: DefaultAspectRatio
}

export type WorkspaceSummary = {
  planTier: PlanTier
  planStatus: PlanStatus
  monthlyCreditAllowance: number
  monthlyCreditRemaining: number
  paidCreditBalance: number
  totalCredits: number
}

export type AccountSettingsPayload = {
  profile: AccountProfile
  preferences: AccountPreferences
  workspace: WorkspaceSummary
}

export type TwoFactorChallenge = {
  requiresTwoFactor: true
  challengeId: string
  user?: {
    email?: string
    name?: string
  }
}

export function isDefaultAspectRatio(value: unknown): value is DefaultAspectRatio {
  return value === "16:9" || value === "9:16"
}
