"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { FormEvent, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  OAuthProvider,
  ensureOAuthProvider,
  signInWithPassword,
  signUpWithPassword,
  startOAuth,
} from "@/lib/insforge"

type AuthMode = "sign-in" | "sign-up"

type FieldErrors = {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(mode: AuthMode, values: Record<string, string>) {
  const errors: FieldErrors = {}

  if (mode === "sign-up" && values.name.trim().length < 2) {
    errors.name = "Enter at least 2 characters."
  }

  if (!emailPattern.test(values.email.trim())) {
    errors.email = "Enter a valid email address."
  }

  if (values.password.length < 8) {
    errors.password = "Use at least 8 characters."
  } else if (!/[A-Za-z]/.test(values.password) || !/[0-9]/.test(values.password)) {
    errors.password = "Use at least one letter and one number."
  }

  if (mode === "sign-up" && values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match."
  }

  return errors
}

function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === "google") return <span className="text-base font-semibold leading-none">G</span>
  return <span className="text-base font-semibold leading-none">X</span>
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/dashboard"
  const isSignUp = mode === "sign-up"
  const [pending, setPending] = useState(false)
  const [oauthPending, setOauthPending] = useState<OAuthProvider | null>(null)
  const [serverError, setServerError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const title = isSignUp ? "Create your studio" : "Welcome back"
  const description = isSignUp
    ? "Start building AI workflows, datasets, and launch-ready product experiences."
    : "Sign in to continue your AI Studio workspace."
  const switchHref = isSignUp ? `/sign-in?next=${encodeURIComponent(next)}` : `/sign-up?next=${encodeURIComponent(next)}`
  const switchText = isSignUp ? "Already have an account?" : "New to Kravix?"
  const switchAction = isSignUp ? "Sign in" : "Create an account"

  const passwordHint = useMemo(() => {
    if (!isSignUp) return "Use your workspace password."
    return "Minimum 8 characters with at least one letter and one number."
  }, [isSignUp])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError("")

    const form = new FormData(event.currentTarget)
    const values = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      confirmPassword: String(form.get("confirmPassword") || ""),
    }

    const nextErrors = validate(mode, values)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setPending(true)
    try {
      if (isSignUp) {
        await signUpWithPassword(values.name, values.email, values.password)
      } else {
        await signInWithPassword(values.email, values.password)
      }
      router.replace(next)
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Authentication failed.")
    } finally {
      setPending(false)
    }
  }

  async function onOAuth(provider: OAuthProvider) {
    setServerError("")
    setOauthPending(provider)
    try {
      await ensureOAuthProvider(provider)
      await startOAuth(provider, next)
    } catch (error) {
      setServerError(error instanceof Error ? error.message : `${provider} OAuth is unavailable.`)
      setOauthPending(null)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:grid-cols-[1fr_520px]">
        <section className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden px-6 py-6 sm:px-10 lg:min-h-screen lg:px-12">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_22%,color-mix(in_oklch,var(--accent),transparent_50%),transparent_32%),radial-gradient(circle_at_82%_18%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_28%)]" />
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 font-semibold">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="size-4" />
              </span>
              Kravix AI Studio
            </Link>
            <ThemeToggle />
          </nav>

          <div className="max-w-2xl py-12 lg:py-0">
            <p className="mb-5 w-fit rounded-full border border-border bg-card/70 px-3 py-1 text-sm text-muted-foreground shadow-sm backdrop-blur">
              InsForge powered authentication
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Build polished AI products from one focused studio.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Secure sign-in, a refined workspace, and production-grade interface patterns are ready for your SaaS workflow.
            </p>
          </div>

          <div className="grid max-w-2xl grid-cols-3 gap-3 text-sm">
            {["OAuth ready", "Dark mode", "Studio routing"].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-card/70 px-3 py-3 text-muted-foreground shadow-sm backdrop-blur">
                {item}
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
                  return (
                    <Button
                      key={provider}
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={loading || pending}
                      onClick={() => onOAuth(provider)}
                      className="h-11"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <ProviderIcon provider={provider} />}
                      {provider === "google" ? "Google" : "X"}
                    </Button>
                  )
                })}
              </div>

              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                Email
                <span className="h-px flex-1 bg-border" />
              </div>

              <form className="grid gap-5" onSubmit={onSubmit} noValidate>
                <FieldGroup>
                  {isSignUp ? (
                    <Field data-invalid={Boolean(fieldErrors.name)}>
                      <FieldLabel htmlFor="name">Name</FieldLabel>
                      <Input
                        id="name"
                        name="name"
                        autoComplete="name"
                        placeholder="Maya Chen"
                        aria-invalid={Boolean(fieldErrors.name)}
                        disabled={pending}
                      />
                      <FieldError>{fieldErrors.name}</FieldError>
                    </Field>
                  ) : null}

                  <Field data-invalid={Boolean(fieldErrors.email)}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      aria-invalid={Boolean(fieldErrors.email)}
                      disabled={pending}
                    />
                    <FieldError>{fieldErrors.email}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(fieldErrors.password)}>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      placeholder="Password"
                      aria-invalid={Boolean(fieldErrors.password)}
                      disabled={pending}
                    />
                    <FieldDescription>{passwordHint}</FieldDescription>
                    <FieldError>{fieldErrors.password}</FieldError>
                  </Field>

                  {isSignUp ? (
                    <Field data-invalid={Boolean(fieldErrors.confirmPassword)}>
                      <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Password"
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        disabled={pending}
                      />
                      <FieldError>{fieldErrors.confirmPassword}</FieldError>
                    </Field>
                  ) : null}
                </FieldGroup>

                {serverError ? (
                  <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </div>
                ) : null}

                <Button type="submit" size="lg" disabled={pending || Boolean(oauthPending)} className="h-11">
                  {pending ? <Loader2 className="animate-spin" /> : null}
                  {isSignUp ? "Create account" : "Sign in"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {switchText}{" "}
                <Link href={switchHref} className="font-medium text-primary underline-offset-4 hover:underline">
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
