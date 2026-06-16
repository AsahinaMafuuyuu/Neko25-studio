"use client"

import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Clock3,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
} from "lucide-react"
import { useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react"

import { useTheme } from "@/components/theme-provider"
import {
  DashboardError,
  DashboardPage,
  DashboardPageHeader,
  DashboardPanel,
  DashboardSectionHeader,
} from "@/components/dashboard/dashboard-layout"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { showAppToast } from "@/components/ui/app-toast"
import { clearLocalSession, getValidAccessToken, refreshSession } from "@/lib/insforge"
import type { AccountSettingsPayload, DefaultAspectRatio } from "@/lib/settings-types"
import { cn } from "@/lib/utils"
import { usePathname, useRouter } from "@/src/i18n/navigation"
import { routing, type AppLocale } from "@/src/i18n/routing"

type ProfileForm = {
  username: string
  phone: string
  description: string
}

type PasswordForm = {
  code: string
  newPassword: string
  confirmPassword: string
}

type TwoFactorSetup = {
  secret: string
  otpauthUri: string
}

const resendSeconds = 60

export function PersonalSettingsPage() {
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme, setTheme } = useTheme()
  const [data, setData] = useState<AccountSettingsPayload | null>(null)
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    username: "",
    phone: "",
    description: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState("")
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    code: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [passwordError, setPasswordError] = useState("")
  const [passwordSending, setPasswordSending] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [resendRemaining, setResendRemaining] = useState(0)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [twoFactorError, setTwoFactorError] = useState("")
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deleteBusy, setDeleteBusy] = useState(false)

  const username = data?.profile.username || "User"
  const deleteText = `我确认删除账户${username}`
  const monthlyUsagePercent = useMemo(() => {
    if (!data?.workspace.monthlyCreditAllowance) return 0
    const used = data.workspace.monthlyCreditAllowance - data.workspace.monthlyCreditRemaining
    return Math.min(Math.max((used / data.workspace.monthlyCreditAllowance) * 100, 0), 100)
  }, [data])

  const loadSettings = useCallback(async () => {
    const response = await apiFetch("/api/settings/profile")
    const payload = await readJson<AccountSettingsPayload>(response)
    setData(payload)
    setProfileForm({
      username: payload.profile.username,
      phone: payload.profile.phone,
      description: payload.profile.description,
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      loadSettings()
        .then(() => {
          if (!cancelled) setError("")
        })
        .catch((nextError) => {
          if (!cancelled) setError(nextError instanceof Error ? nextError.message : "Could not load account settings.")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadSettings])

  useEffect(() => {
    if (resendRemaining <= 0) return
    const timeout = window.setTimeout(() => setResendRemaining((value) => Math.max(value - 1, 0)), 1000)
    return () => window.clearTimeout(timeout)
  }, [resendRemaining])

  function updateProfileField(field: keyof ProfileForm) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setProfileForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  async function saveProfile(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setSaving(true)
    try {
      const response = await apiFetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      })
      const payload = await readJson<AccountSettingsPayload>(response)
      setData(payload)
      showAppToast("Account settings saved.")
    } catch (nextError) {
      showAppToast(nextError instanceof Error ? nextError.message : "Could not save settings.", { variant: "error" })
    } finally {
      setSaving(false)
    }
  }

  async function updatePreference(values: Partial<{
    emailNotifications: boolean
    defaultAspectRatio: DefaultAspectRatio
  }>) {
    if (!data) return
    setData({
      ...data,
      preferences: {
        ...data.preferences,
        ...values,
      },
    })

    try {
      const response = await apiFetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      setData(await readJson<AccountSettingsPayload>(response))
    } catch (nextError) {
      showAppToast(nextError instanceof Error ? nextError.message : "Could not save preference.", { variant: "error" })
      await loadSettings().catch(() => null)
    }
  }

  async function onAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const formData = new FormData()
    formData.append("avatar", file)
    setUploadingAvatar(true)
    try {
      const response = await apiFetch("/api/settings/avatar", {
        method: "POST",
        body: formData,
      })
      setData(await readJson<AccountSettingsPayload>(response))
      showAppToast("Avatar updated.")
    } catch (nextError) {
      showAppToast(nextError instanceof Error ? nextError.message : "Could not upload avatar.", { variant: "error" })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function requestPasswordCode() {
    if (resendRemaining > 0) return
    setPasswordSending(true)
    setPasswordError("")
    try {
      await readJson(await apiFetch("/api/settings/password/request-code", { method: "POST" }))
      setResendRemaining(resendSeconds)
      showAppToast("Verification code sent.")
    } catch (nextError) {
      setPasswordError(nextError instanceof Error ? nextError.message : "Could not send verification code.")
    } finally {
      setPasswordSending(false)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{6}$/.test(passwordForm.code.trim())) {
      setPasswordError("Enter the 6-digit verification code.")
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match.")
      return
    }

    setPasswordSaving(true)
    setPasswordError("")
    try {
      await readJson(await apiFetch("/api/settings/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: passwordForm.code,
          newPassword: passwordForm.newPassword,
        }),
      }))
      setPasswordOpen(false)
      setPasswordForm({ code: "", newPassword: "", confirmPassword: "" })
      await loadSettings()
      showAppToast("Password changed.")
    } catch (nextError) {
      setPasswordError(nextError instanceof Error ? nextError.message : "Could not change password.")
    } finally {
      setPasswordSaving(false)
    }
  }

  async function startTwoFactorSetup() {
    setTwoFactorOpen(true)
    setTwoFactorBusy(true)
    setTwoFactorError("")
    setTwoFactorCode("")
    try {
      const response = await apiFetch("/api/settings/2fa/setup", { method: "POST" })
      setTwoFactorSetup(await readJson<TwoFactorSetup>(response))
    } catch (nextError) {
      setTwoFactorError(nextError instanceof Error ? nextError.message : "Could not start two-factor setup.")
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function confirmTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTwoFactorBusy(true)
    setTwoFactorError("")
    try {
      const response = await apiFetch("/api/settings/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFactorCode }),
      })
      setData(await readJson<AccountSettingsPayload>(response))
      setTwoFactorOpen(false)
      setTwoFactorSetup(null)
      showAppToast("Two-factor authentication enabled.")
    } catch (nextError) {
      setTwoFactorError(nextError instanceof Error ? nextError.message : "Could not confirm authenticator code.")
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTwoFactorBusy(true)
    setTwoFactorError("")
    try {
      const response = await apiFetch("/api/settings/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFactorCode }),
      })
      setData(await readJson<AccountSettingsPayload>(response))
      setTwoFactorOpen(false)
      setTwoFactorCode("")
      showAppToast("Two-factor authentication disabled.")
    } catch (nextError) {
      setTwoFactorError(nextError instanceof Error ? nextError.message : "Could not disable two-factor authentication.")
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function deleteAccount() {
    setDeleteBusy(true)
    try {
      await readJson(await apiFetch("/api/settings/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      }))
      clearLocalSession()
      router.replace("/sign-in")
    } catch (nextError) {
      showAppToast(nextError instanceof Error ? nextError.message : "Could not delete account.", { variant: "error" })
    } finally {
      setDeleteBusy(false)
    }
  }

  function changeLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) return
    const query = Object.fromEntries(searchParams.entries())
    router.replace({ pathname, query }, { locale: nextLocale })
  }

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading account settings...
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <DashboardError>{error || "Could not load account settings."}</DashboardError>
    )
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={UserRound}
        eyebrow="Personal Settings"
        title="Account Settings"
        description="Manage your profile, security, workspace preferences, and credits from one account surface."
      />

      <form onSubmit={saveProfile} className="rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
        <SectionHeader icon={UserRound} title="Profile" description="Control how your profile appears across the studio." />
        <div className="mt-5 grid gap-5">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium">Avatar Image</p>
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, or WebP.</p>
                <Avatar className="mt-4 size-32 sm:size-36" size="lg">
                  {data.profile.avatarUrl ? <AvatarImage src={data.profile.avatarUrl} alt={data.profile.username} /> : null}
                  <AvatarFallback className="text-3xl">{getInitials(data.profile.username)}</AvatarFallback>
                </Avatar>
              </div>
              <label className={cn(buttonVariants({ variant: "outline" }), "w-fit cursor-pointer")}>
                  {uploadingAvatar ? <Loader2 className="animate-spin" /> : <Upload />}
                  Upload photo
                  <input className="sr-only" type="file" accept="image/*" onChange={onAvatarSelected} disabled={uploadingAvatar} />
              </label>
            </div>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input id="username" value={profileForm.username} onChange={updateProfileField("username")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" value={data.profile.email} readOnly disabled />
              <FieldDescription>Email changes are not enabled for this release.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Phone</FieldLabel>
              <Input id="phone" value={profileForm.phone} onChange={updateProfileField("phone")} placeholder="+1 555 0100" />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" value={profileForm.description} onChange={updateProfileField("description")} maxLength={280} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Check />}
                Save profile
              </Button>
            </div>
          </FieldGroup>
        </div>
      </form>

      <DashboardPanel>
        <DashboardSectionHeader
          title={<span className="inline-flex items-center gap-2"><ShieldCheck className="size-5" />Security</span>}
          description="Protect your account and manage high-risk actions."
        />
        <div className="mt-5 divide-y divide-border/70 rounded-lg border border-border/70">
          <SettingsRow
            title="Password"
            description={`Last changed ${formatPasswordAge(data.profile.passwordChangedAt)}`}
            action={<Button variant="outline" onClick={() => setPasswordOpen(true)}><KeyRound />Change password</Button>}
          />
          <SettingsRow
            title="Two-factor authentication"
            description={data.profile.twoFactorEnabled ? "Authenticator app is enabled." : "Use Google Authenticator or Microsoft Authenticator."}
            action={
              data.profile.twoFactorEnabled ? (
                <Button variant="outline" onClick={() => {
                  setTwoFactorOpen(true)
                  setTwoFactorSetup(null)
                  setTwoFactorCode("")
                  setTwoFactorError("")
                }}>
                  Disable
                </Button>
              ) : (
                <Button onClick={startTwoFactorSetup}><ShieldCheck />Set up</Button>
              )
            }
          />
          <SettingsRow
            danger
            title="Delete account"
            description="Permanently delete this account and return to sign in."
            action={<Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 />Delete account</Button>}
          />
        </div>
      </DashboardPanel>

      <DashboardPanel>
        <DashboardSectionHeader
          title={<span className="inline-flex items-center gap-2"><Monitor className="size-5" />Preference</span>}
          description="Set your workspace defaults."
        />
        <div className="mt-5 grid gap-4">
          <PreferenceRow title="Theme" description="Choose how the interface should render.">
            <div className="flex flex-wrap gap-2">
              {([
                ["light", Sun],
                ["dark", Moon],
                ["system", Monitor],
              ] as const).map(([value, Icon]) => (
                <Button key={value} type="button" variant={theme === value ? "default" : "outline"} onClick={() => setTheme(value)}>
                  <Icon />
                  {titleCase(value)}
                </Button>
              ))}
            </div>
          </PreferenceRow>
          <PreferenceRow title="Language" description="Switch the dashboard language.">
            <NativeSelect className="min-w-32" size="sm" value={locale} onChange={(event) => changeLocale(event.target.value as AppLocale)}>
              {routing.locales.map((item) => (
                <NativeSelectOption key={item} value={item}>{item.toUpperCase()}</NativeSelectOption>
              ))}
            </NativeSelect>
          </PreferenceRow>
          <PreferenceRow title="Email notification" description="Receive releases, news, invoices, and product updates.">
            <Switch
              checked={data.preferences.emailNotifications}
              onCheckedChange={(checked) => updatePreference({ emailNotifications: checked })}
            />
          </PreferenceRow>
          <PreferenceRow title="Default video aspect ratio" description="Used as the default ratio for new video workflows.">
            <div className="flex gap-2">
              {(["16:9", "9:16"] as DefaultAspectRatio[]).map((ratio) => (
                <Button
                  key={ratio}
                  type="button"
                  variant={data.preferences.defaultAspectRatio === ratio ? "default" : "outline"}
                  onClick={() => updatePreference({ defaultAspectRatio: ratio })}
                >
                  {ratio}
                </Button>
              ))}
            </div>
          </PreferenceRow>
        </div>
      </DashboardPanel>

      <DashboardPanel>
        <DashboardSectionHeader
          title={<span className="inline-flex items-center gap-2"><WalletCards className="size-5" />Workspace</span>}
          description="Review your plan, workload, and available credits."
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <WorkspacePanel title="Plan">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-semibold tracking-tight">{data.workspace.planTier}</p>
              <Badge className="rounded-full" variant="outline">
                <BadgeCheck className="size-3.5" />
                {data.workspace.planStatus}
              </Badge>
            </div>
          </WorkspacePanel>
          <WorkspacePanel title="Credits">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatNumber(data.workspace.monthlyCreditAllowance)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{formatNumber(data.workspace.monthlyCreditRemaining)} remaining</p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${100 - monthlyUsagePercent}%` }}
              />
            </div>
          </WorkspacePanel>
          <WorkspacePanel title="Paid credits">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatNumber(data.workspace.paidCreditBalance)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Credits from direct recharge.</p>
          </WorkspacePanel>
        </div>
      </DashboardPanel>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Use the verification code sent to your email to set a new password.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={changePassword}>
            <FieldGroup>
              <Field data-invalid={Boolean(passwordError)}>
                <FieldLabel htmlFor="passwordCode">Verification code</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="passwordCode"
                    inputMode="numeric"
                    maxLength={6}
                    value={passwordForm.code}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, code: event.target.value }))}
                    placeholder="123456"
                  />
                  <Button type="button" variant="outline" onClick={requestPasswordCode} disabled={passwordSending || resendRemaining > 0}>
                    {passwordSending ? <Loader2 className="animate-spin" /> : <Clock3 />}
                    {resendRemaining > 0 ? `${resendRemaining}s` : "Send"}
                  </Button>
                </div>
                <FieldError>{passwordError}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="newPassword">New password</FieldLabel>
                <Input id="newPassword" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                <Input id="confirmPassword" type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={passwordSaving}>
                {passwordSaving ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Change password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{data.profile.twoFactorEnabled ? "Disable two-factor authentication" : "Set up two-factor authentication"}</DialogTitle>
            <DialogDescription>
              {data.profile.twoFactorEnabled ? "Enter your current authenticator code to disable 2FA." : "Add this account to Google Authenticator or Microsoft Authenticator, then enter the code."}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={data.profile.twoFactorEnabled ? disableTwoFactor : confirmTwoFactor}>
            {!data.profile.twoFactorEnabled ? (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Manual secret</p>
                <p className="mt-2 break-all font-mono text-sm">{twoFactorBusy ? "Generating..." : twoFactorSetup?.secret || "Unavailable"}</p>
                <p className="mt-2 break-all text-xs text-muted-foreground">{twoFactorSetup?.otpauthUri}</p>
              </div>
            ) : null}
            <Field data-invalid={Boolean(twoFactorError)}>
              <FieldLabel htmlFor="twoFactorCode">Authenticator code</FieldLabel>
              <Input
                id="twoFactorCode"
                inputMode="numeric"
                maxLength={6}
                value={twoFactorCode}
                onChange={(event) => {
                  setTwoFactorCode(event.target.value)
                  setTwoFactorError("")
                }}
                placeholder="123456"
              />
              <FieldError>{twoFactorError}</FieldError>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTwoFactorOpen(false)}>Cancel</Button>
              <Button type="submit" variant={data.profile.twoFactorEnabled ? "destructive" : "default"} disabled={twoFactorBusy}>
                {twoFactorBusy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                {data.profile.twoFactorEnabled ? "Disable" : "Enable"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete account</DialogTitle>
            <DialogDescription>This is permanent. Type the exact confirmation text before deleting this account.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mb-2 size-4" />
            {deleteText}
          </div>
          <Field data-invalid={deleteConfirmation.length > 0 && deleteConfirmation !== deleteText}>
            <FieldLabel htmlFor="deleteConfirmation">Confirmation</FieldLabel>
            <Input id="deleteConfirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />
            <FieldError>{deleteConfirmation.length > 0 && deleteConfirmation !== deleteText ? "Confirmation text does not match." : ""}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleteConfirmation !== deleteText || deleteBusy} onClick={deleteAccount}>
              {deleteBusy ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardPage>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function SettingsRow({
  title,
  description,
  action,
  danger = false,
}: {
  title: string
  description: string
  action: ReactNode
  danger?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className={cn("text-sm font-medium", danger && "text-destructive")}>{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

function PreferenceRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function WorkspacePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("") || "U"
}

function formatPasswordAge(value: string | null) {
  if (!value) return "never"
  const changedAt = new Date(value).getTime()
  if (!Number.isFinite(changedAt)) return "never"

  const days = Math.max(Math.floor((Date.now() - changedAt) / 86_400_000), 0)
  if (days < 1) return "today"
  if (days < 365) return `${days} day${days === 1 ? "" : "s"} ago`

  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? "" : "s"} ago`
}

function formatNumber(value: number) {
  return value.toLocaleString("en")
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1)
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await getValidAccessToken()
  if (!token) throw new Error("Your session has expired. Please sign in again.")
  const makeRequest = (accessToken: string) => {
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${accessToken}`)
    return fetch(path, { ...init, headers })
  }
  const response = await makeRequest(token)
  if (response.status !== 401) return response
  const refreshed = await refreshSession().catch(() => null)
  if (!refreshed?.accessToken) return response
  return makeRequest(refreshed.accessToken)
}

async function readJson<T = { ok: boolean }>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (!response.ok) throw new Error(body.message || "Request failed.")
  return body
}
