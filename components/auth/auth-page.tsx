"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"

import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  OAuthProvider,
  getOAuthProviders,
  resendVerificationEmail,
  signInWithPassword,
  signUpWithPassword,
  startOAuth,
  verifyEmailCode,
} from "@/lib/insforge"
import { showAppToast } from "@/components/ui/app-toast"
import { Link, useRouter } from "@/src/i18n/navigation"

type AuthMode = "sign-in" | "sign-up"

type FieldErrors = {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  verificationCode?: string
}

type FormValues = {
  name: string
  email: string
  password: string
  confirmPassword: string
  verificationCode: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(
  mode: AuthMode,
  values: FormValues,
  t: ReturnType<typeof useTranslations<"Auth">>
) {
  const errors: FieldErrors = {}

  if (mode === "sign-up" && values.name.trim().length < 2) {
    errors.name = t("validation.name")
  }

  if (!emailPattern.test(values.email.trim())) {
    errors.email = t("validation.email")
  }

  if (values.password.length < 8) {
    errors.password = t("validation.passwordLength")
  } else if (
    !/[a-z]/.test(values.password) ||
    !/[A-Z]/.test(values.password) ||
    !/[0-9]/.test(values.password) ||
    !/[^A-Za-z0-9]/.test(values.password)
  ) {
    errors.password = t("validation.passwordContent")
  }

  if (mode === "sign-up" && values.password !== values.confirmPassword) {
    errors.confirmPassword = t("validation.confirmPassword")
  }

  return errors
}

function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === "google") {
    return <span className="text-base font-semibold leading-none">G</span>
  }

  return <span className="text-base font-semibold leading-none">X</span>
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("Auth")
  const common = useTranslations("Common")
  const next = searchParams.get("next") || "/dashboard"
  const isSignUp = mode === "sign-up"
  const [pending, setPending] = useState(false)
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [verificationEmail, setVerificationEmail] = useState("")
  const [values, setValues] = useState<FormValues>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    verificationCode: "",
  })
  const [resending, setResending] = useState(false)
  const [enabledProviders, setEnabledProviders] = useState<Set<OAuthProvider>>(
    () => new Set(["google", "x"] as OAuthProvider[])
  )

  const title = isSignUp ? t("signUpTitle") : t("signInTitle")
  const description = isSignUp ? t("signUpDescription") : t("signInDescription")
  const switchHref = isSignUp
    ? `/sign-in?next=${encodeURIComponent(next)}`
    : `/sign-up?next=${encodeURIComponent(next)}`
  const switchText = isSignUp ? t("switchToSignInText") : t("switchToSignUpText")
  const switchAction = isSignUp
    ? t("switchToSignInAction")
    : t("switchToSignUpAction")

  const passwordHint = useMemo(() => {
    if (!isSignUp) return t("passwordHintSignIn")
    return t("passwordHintSignUp")
  }, [isSignUp, t])

  useEffect(() => {
    let cancelled = false

    getOAuthProviders()
      .then((providers) => {
        if (!cancelled) setEnabledProviders(providers)
      })
      .catch(() => {
        if (!cancelled) setEnabledProviders(new Set(["google", "x"] as OAuthProvider[]))
      })

    return () => {
      cancelled = true
    }
  }, [])

  function updateValue(field: keyof FormValues) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setValues((current) => ({ ...current, [field]: value }))
      if (fieldErrors[field]) {
        setFieldErrors((current) => ({ ...current, [field]: undefined }))
      }
    }
  }

  function showAuthError(error: unknown) {
    showAppToast(error instanceof Error ? error.message : t("authenticationFailed"), {
      variant: "error",
    })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSignUp && verificationEmail) {
      const verificationCode = values.verificationCode.trim()
      if (!/^\d{6}$/.test(verificationCode)) {
        setFieldErrors({ verificationCode: t("validation.verificationCode") })
        return
      }

      setFieldErrors({})
      setPending(true)
      try {
        await verifyEmailCode(verificationEmail, verificationCode)
        showAppToast(t("verificationSuccess"))
        router.replace(`/sign-in?next=${encodeURIComponent(next)}`)
      } catch (error) {
        showAuthError(error)
      } finally {
        setPending(false)
      }
      return
    }

    const nextErrors = validate(mode, values, t)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setPending(true)
    try {
      if (isSignUp) {
        const session = await signUpWithPassword(values.name, values.email, values.password)
        if (session.needsEmailVerification) {
          const email = values.email.trim()
          setVerificationEmail(email)
          setValues((current) => ({
            ...current,
            email,
            password: "",
            confirmPassword: "",
            verificationCode: "",
          }))
          showAppToast(t("verificationEmailSent"))
          return
        }
        showAppToast(t("accountCreated"))
        router.replace(`/sign-in?next=${encodeURIComponent(next)}`)
        return
      } else {
        await signInWithPassword(values.email, values.password)
        showAppToast(t("signInSuccess"))
      }
      router.replace(next)
    } catch (error) {
      showAuthError(error)
    } finally {
      setPending(false)
    }
  }

  async function onResendVerification() {
    if (!verificationEmail) return
    setResending(true)
    try {
      await resendVerificationEmail(verificationEmail)
      showAppToast(t("verificationCodeResent"))
    } catch (error) {
      showAuthError(error)
    } finally {
      setResending(false)
    }
  }

  async function onOAuth(provider: OAuthProvider) {
    setOauthPending(provider)
    try {
      await startOAuth(provider, next)
    } catch (error) {
      showAppToast(
        error instanceof Error
          ? error.message
          : t("oauthUnavailable", { provider }),
        { variant: "error" }
      )
      setOauthPending(null)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[1fr_520px]">
        <section className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden px-6 py-6 sm:px-10 lg:min-h-screen lg:px-12">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_22%,color-mix(in_oklch,var(--accent),transparent_50%),transparent_32%),radial-gradient(circle_at_82%_18%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_28%)]" />
          <nav className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3 font-semibold">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="size-4" />
              </span>
              {common("brand")}
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </nav>

          <div className="max-w-2xl py-12 lg:py-0">
            <p className="mb-5 w-fit rounded-full border border-border bg-card/70 px-3 py-1 text-sm text-muted-foreground shadow-sm backdrop-blur">
              {t("heroEyebrow")}
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              {t("heroDescription")}
            </p>
          </div>

          <div className="grid max-w-2xl grid-cols-3 gap-3 text-sm">
            {(["oauth", "theme", "routing"] as const).map((item) => (
              <div
                key={item}
                className="rounded-xl border border-border bg-card/70 px-3 py-3 text-muted-foreground shadow-sm backdrop-blur"
              >
                {t(`heroPills.${item}`)}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center px-4 py-8 sm:px-8 lg:px-0 lg:pr-10">
          <Card className="w-full border-border/80 bg-card/90 shadow-2xl shadow-primary/10 backdrop-blur">
            <CardHeader className="gap-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["google", "x"] as OAuthProvider[]).map((provider) => {
                  const loading = oauthPending === provider
                  const enabled = enabledProviders.has(provider)
                  return (
                    <Button
                      key={provider}
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={loading || pending || !enabled}
                      onClick={() => onOAuth(provider)}
                      className="h-11"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <ProviderIcon provider={provider} />
                      )}
                      {provider === "google" ? "Google" : "X"}
                    </Button>
                  )
                })}
              </div>

              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {common("email")}
                <span className="h-px flex-1 bg-border" />
              </div>

              <form className="grid gap-5" onSubmit={onSubmit} noValidate>
                {isSignUp && verificationEmail ? (
                  <FieldGroup>
                    <Field>
                      <FieldLabel>{common("email")}</FieldLabel>
                      <Input value={verificationEmail} readOnly disabled />
                      <FieldDescription>{t("verificationCodeDescription")}</FieldDescription>
                    </Field>
                    <Field data-invalid={Boolean(fieldErrors.verificationCode)}>
                      <FieldLabel htmlFor="verificationCode">{t("verificationCode")}</FieldLabel>
                      <Input
                        id="verificationCode"
                        name="verificationCode"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoComplete="one-time-code"
                        placeholder="123456"
                        value={values.verificationCode}
                        onChange={updateValue("verificationCode")}
                        aria-invalid={Boolean(fieldErrors.verificationCode)}
                        disabled={pending}
                      />
                      <FieldError>{fieldErrors.verificationCode}</FieldError>
                    </Field>
                  </FieldGroup>
                ) : (
                  <FieldGroup>
                    {isSignUp ? (
                      <Field data-invalid={Boolean(fieldErrors.name)}>
                        <FieldLabel htmlFor="name">{common("name")}</FieldLabel>
                        <Input
                          id="name"
                          name="name"
                          autoComplete="name"
                          placeholder="Maya Chen"
                          value={values.name}
                          onChange={updateValue("name")}
                          aria-invalid={Boolean(fieldErrors.name)}
                          disabled={pending}
                        />
                        <FieldError>{fieldErrors.name}</FieldError>
                      </Field>
                    ) : null}

                    <Field data-invalid={Boolean(fieldErrors.email)}>
                      <FieldLabel htmlFor="email">{common("email")}</FieldLabel>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={values.email}
                        onChange={updateValue("email")}
                        aria-invalid={Boolean(fieldErrors.email)}
                        disabled={pending}
                      />
                      <FieldError>{fieldErrors.email}</FieldError>
                    </Field>

                    <Field data-invalid={Boolean(fieldErrors.password)}>
                      <FieldLabel htmlFor="password">{common("password")}</FieldLabel>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete={isSignUp ? "new-password" : "current-password"}
                        placeholder={common("password")}
                        value={values.password}
                        onChange={updateValue("password")}
                        aria-invalid={Boolean(fieldErrors.password)}
                        disabled={pending}
                      />
                      <FieldDescription>{passwordHint}</FieldDescription>
                      <FieldError>{fieldErrors.password}</FieldError>
                    </Field>

                    {isSignUp ? (
                      <Field data-invalid={Boolean(fieldErrors.confirmPassword)}>
                        <FieldLabel htmlFor="confirmPassword">
                          {t("confirmPassword")}
                        </FieldLabel>
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          placeholder={common("password")}
                          value={values.confirmPassword}
                          onChange={updateValue("confirmPassword")}
                          aria-invalid={Boolean(fieldErrors.confirmPassword)}
                          disabled={pending}
                        />
                        <FieldError>{fieldErrors.confirmPassword}</FieldError>
                      </Field>
                    ) : null}
                  </FieldGroup>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={pending || Boolean(oauthPending)}
                  className="h-11"
                >
                  {pending ? <Loader2 className="animate-spin" /> : null}
                  {isSignUp && verificationEmail
                    ? t("submitVerificationCode")
                    : isSignUp
                      ? t("createAccount")
                      : common("signIn")}
                </Button>

                {isSignUp && verificationEmail ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending || resending}
                    onClick={onResendVerification}
                    className="h-10"
                  >
                    {resending ? <Loader2 className="animate-spin" /> : null}
                    {t("resendVerificationCode")}
                  </Button>
                ) : null}
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {switchText}{" "}
                <Link
                  href={switchHref}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {switchAction}
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
