import type { AuthUser } from "@/lib/auth/types"
import { getInsForgeAdmin } from "@/lib/avatar-server"
import { encryptText, decryptText } from "@/lib/totp"
import type {
  AccountSettingsPayload,
  DefaultAspectRatio,
  PlanStatus,
  PlanTier,
  WorkspaceSummary,
} from "@/lib/settings-types"
import { isDefaultAspectRatio } from "@/lib/settings-types"

type UserRecord = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  description: string | null
  avatar_url: string | null
  avatar_key: string | null
  email_verified: boolean | null
  email_notifications: boolean | null
  default_aspect_ratio: string | null
  password_changed_at: string | null
  two_factor_enabled: boolean | null
  two_factor_secret_encrypted: string | null
  two_factor_pending_secret_encrypted: string | null
}

type CreditBalanceRecord = {
  user_id: string
  balance: number
  plan_tier?: PlanTier
  plan_status?: PlanStatus
  monthly_credit_allowance?: number
  monthly_credit_remaining?: number
  paid_credit_balance?: number
}

type TwoFactorChallengeRecord = {
  id: string
  user_id: string
  session_payload: string
  expires_at: string
  consumed_at: string | null
}

function sdkErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    return String(record.message || record.error || fallback)
  }

  if (typeof error === "string" && error.trim()) return error
  return fallback
}

function throwIfSdkError(error: unknown, fallback: string) {
  if (error) throw new Error(sdkErrorMessage(error, fallback))
}

function readString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key]
  return typeof value === "string" ? value : ""
}

function usernameFromUser(user: AuthUser | null | undefined) {
  return (
    readString(user, "name") ||
    readString(user?.profile as Record<string, unknown>, "name") ||
    readString(user?.metadata as Record<string, unknown>, "name") ||
    readString(user?.user_metadata, "name") ||
    readString(user?.app_metadata, "name") ||
    (typeof user?.email === "string" ? user.email.split("@")[0] : "")
  )
}

export function normalizeUsername(value: string, fallback: string) {
  const nextValue = value.trim().replace(/\s+/g, " ")
  return nextValue || fallback || "User"
}

function normalizePhone(value: string) {
  return value.trim().slice(0, 40)
}

function normalizeDescription(value: string) {
  return value.trim().slice(0, 280)
}

function toWorkspaceSummary(record: CreditBalanceRecord | null | undefined): WorkspaceSummary {
  const monthlyCreditAllowance = Math.max(Number(record?.monthly_credit_allowance ?? 1280), 0)
  const monthlyCreditRemaining = Math.max(Number(record?.monthly_credit_remaining ?? record?.balance ?? 1280), 0)
  const paidCreditBalance = Math.max(Number(record?.paid_credit_balance ?? 0), 0)

  return {
    planTier: record?.plan_tier || "Free Plan",
    planStatus: record?.plan_status || "active",
    monthlyCreditAllowance,
    monthlyCreditRemaining,
    paidCreditBalance,
    totalCredits: monthlyCreditRemaining + paidCreditBalance,
  }
}

export async function getUserProfileRecord(userId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("users")
    .select()
    .eq("id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load user profile.")
  return ((data || []) as UserRecord[])[0] || null
}

export async function upsertUserProfileRecord(
  userId: string,
  values: Partial<Pick<
    UserRecord,
    | "name"
    | "email"
    | "phone"
    | "description"
    | "avatar_url"
    | "avatar_key"
    | "email_notifications"
    | "default_aspect_ratio"
    | "password_changed_at"
    | "two_factor_enabled"
    | "two_factor_secret_encrypted"
    | "two_factor_pending_secret_encrypted"
  >>
) {
  const admin = await getInsForgeAdmin()
  const existing = await getUserProfileRecord(userId)
  const payload = { ...values, updated_at: new Date().toISOString() }

  const result = existing
    ? await admin.database.from("users").update(payload).eq("id", userId).select()
    : await admin.database.from("users").insert([{ id: userId, ...payload }]).select()

  throwIfSdkError(result.error, "Could not save user profile.")
  return ((result.data || []) as UserRecord[])[0] || null
}

export async function ensureWorkspaceSummary(userId: string) {
  const admin = await getInsForgeAdmin()
  await admin.database.rpc("ensure_user_credit_balance", { p_user_id: userId, p_default_balance: 1280 })

  const { data, error } = await admin
    .database
    .from("user_credit_balances")
    .select()
    .eq("user_id", userId)
    .limit(1)

  throwIfSdkError(error, "Could not load workspace credits.")
  return toWorkspaceSummary(((data || []) as CreditBalanceRecord[])[0] || null)
}

export async function getAccountSettingsPayload(userId: string, authUser?: AuthUser | null): Promise<AccountSettingsPayload> {
  const [profileRecord, workspace] = await Promise.all([
    getUserProfileRecord(userId),
    ensureWorkspaceSummary(userId),
  ])
  const fallbackUsername = usernameFromUser(authUser)
  const email = profileRecord?.email || (typeof authUser?.email === "string" ? authUser.email : "")
  const username = normalizeUsername(profileRecord?.name || "", fallbackUsername)
  const aspectRatio = isDefaultAspectRatio(profileRecord?.default_aspect_ratio)
    ? profileRecord.default_aspect_ratio
    : "16:9"

  return {
    profile: {
      id: userId,
      username,
      email,
      phone: profileRecord?.phone || "",
      description: profileRecord?.description || "",
      avatarUrl: profileRecord?.avatar_url || readString(authUser, "avatar_url") || readString(authUser, "avatarUrl"),
      emailVerified: Boolean(profileRecord?.email_verified || authUser?.emailVerified || authUser?.email_verified),
      passwordChangedAt: profileRecord?.password_changed_at || null,
      twoFactorEnabled: Boolean(profileRecord?.two_factor_enabled),
    },
    preferences: {
      emailNotifications: profileRecord?.email_notifications !== false,
      defaultAspectRatio: aspectRatio,
    },
    workspace,
  }
}

export async function updateAccountSettings(input: {
  userId: string
  authUser?: AuthUser | null
  username?: string
  phone?: string
  description?: string
  emailNotifications?: boolean
  defaultAspectRatio?: DefaultAspectRatio
}) {
  const current = await getAccountSettingsPayload(input.userId, input.authUser)
  await upsertUserProfileRecord(input.userId, {
    name: input.username === undefined ? current.profile.username : normalizeUsername(input.username, current.profile.username),
    phone: input.phone === undefined ? current.profile.phone : normalizePhone(input.phone),
    description: input.description === undefined ? current.profile.description : normalizeDescription(input.description),
    email_notifications: input.emailNotifications === undefined ? current.preferences.emailNotifications : input.emailNotifications,
    default_aspect_ratio: input.defaultAspectRatio || current.preferences.defaultAspectRatio,
    email: current.profile.email,
  })

  return getAccountSettingsPayload(input.userId, input.authUser)
}

export async function getTwoFactorStatus(userId: string) {
  const profile = await getUserProfileRecord(userId)
  return {
    enabled: Boolean(profile?.two_factor_enabled && profile.two_factor_secret_encrypted),
    secret: profile?.two_factor_secret_encrypted ? decryptText(profile.two_factor_secret_encrypted) : "",
    pendingSecret: profile?.two_factor_pending_secret_encrypted
      ? decryptText(profile.two_factor_pending_secret_encrypted)
      : "",
  }
}

export async function savePendingTwoFactorSecret(userId: string, secret: string) {
  await upsertUserProfileRecord(userId, {
    two_factor_pending_secret_encrypted: encryptText(secret),
  })
}

export async function enableTwoFactorSecret(userId: string, secret: string) {
  await upsertUserProfileRecord(userId, {
    two_factor_enabled: true,
    two_factor_secret_encrypted: encryptText(secret),
    two_factor_pending_secret_encrypted: "",
  })
}

export async function disableTwoFactorSecret(userId: string) {
  await upsertUserProfileRecord(userId, {
    two_factor_enabled: false,
    two_factor_secret_encrypted: "",
    two_factor_pending_secret_encrypted: "",
  })
}

export async function createTwoFactorChallenge(input: {
  userId: string
  accessToken: string
  refreshToken?: string | null
  user?: AuthUser
}) {
  const admin = await getInsForgeAdmin()
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
  const payload = encryptText(JSON.stringify(input))
  const { data, error } = await admin
    .database
    .from("user_two_factor_challenges")
    .insert([{ user_id: input.userId, session_payload: payload, expires_at: expiresAt }])
    .select()

  throwIfSdkError(error, "Could not create two-factor challenge.")
  return ((data || []) as TwoFactorChallengeRecord[])[0] || null
}

export async function consumeTwoFactorChallenge(challengeId: string) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("user_two_factor_challenges")
    .select()
    .eq("id", challengeId)
    .is("consumed_at", null)
    .limit(1)

  throwIfSdkError(error, "Could not load two-factor challenge.")
  const challenge = ((data || []) as TwoFactorChallengeRecord[])[0] || null
  if (!challenge) throw new Error("Two-factor challenge was not found.")
  if (new Date(challenge.expires_at).getTime() < Date.now()) throw new Error("Two-factor challenge expired.")

  const update = await admin
    .database
    .from("user_two_factor_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challengeId)

  throwIfSdkError(update.error, "Could not consume two-factor challenge.")

  return JSON.parse(decryptText(challenge.session_payload)) as {
    userId: string
    accessToken: string
    refreshToken?: string | null
    user?: AuthUser
  }
}
