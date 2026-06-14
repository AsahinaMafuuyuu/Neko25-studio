"use client"

import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { FormEvent, Suspense, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { completeOAuth, getOAuthNext, isTwoFactorChallenge, verifyTwoFactorChallenge } from "@/lib/insforge"
import type { TwoFactorAuthChallenge } from "@/lib/auth/types"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get("code") || searchParams.get("insforge_code")
  const oauthError = searchParams.get("error") || searchParams.get("insforge_error")
  const handledRef = useRef(false)
  const [error, setError] = useState(
    oauthError || (code ? "" : "OAuth did not return a code. Please try signing in again.")
  )
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorAuthChallenge | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [twoFactorError, setTwoFactorError] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (oauthError) {
      return
    }

    if (!code || handledRef.current) {
      return
    }

    handledRef.current = true
    const next = searchParams.get("next") || getOAuthNext()
    completeOAuth(code)
      .then((session) => {
        if (isTwoFactorChallenge(session)) {
          setTwoFactorChallenge(session)
          return
        }

        router.replace(next)
      })
      .catch((nextError) => {
        handledRef.current = false
        setError(nextError instanceof Error ? nextError.message : "OAuth sign-in failed.")
      })
  }, [code, oauthError, router, searchParams])

  async function onVerifyTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!twoFactorChallenge) return

    const codeValue = twoFactorCode.trim()
    if (!/^\d{6}$/.test(codeValue)) {
      setTwoFactorError("Enter the 6-digit authenticator code.")
      return
    }

    setVerifying(true)
    setTwoFactorError("")
    try {
      await verifyTwoFactorChallenge(twoFactorChallenge.challengeId, codeValue)
      router.replace(searchParams.get("next") || getOAuthNext())
    } catch (nextError) {
      setTwoFactorError(nextError instanceof Error ? nextError.message : "Could not verify two-factor code.")
    } finally {
      setVerifying(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-md border-border/80 bg-card/90 text-center shadow-xl">
        <CardHeader>
          <CardTitle>Completing sign in</CardTitle>
          <CardDescription>Finishing the secure InsForge OAuth handshake.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {twoFactorChallenge ? (
            <form className="grid w-full gap-4 text-left" onSubmit={onVerifyTwoFactor}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input value={twoFactorChallenge.user?.email || ""} readOnly disabled />
                  <FieldDescription>Enter the 6-digit code from your authenticator app.</FieldDescription>
                </Field>
                <Field data-invalid={Boolean(twoFactorError)}>
                  <FieldLabel htmlFor="oauthTwoFactorCode">Authenticator code</FieldLabel>
                  <Input
                    id="oauthTwoFactorCode"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={twoFactorCode}
                    onChange={(event) => {
                      setTwoFactorCode(event.target.value)
                      setTwoFactorError("")
                    }}
                    placeholder="123456"
                    disabled={verifying}
                  />
                  <FieldError>{twoFactorError}</FieldError>
                </Field>
              </FieldGroup>
              <Button type="submit" disabled={verifying}>
                {verifying ? <Loader2 className="animate-spin" /> : null}
                Verify code
              </Button>
            </form>
          ) : error ? (
            <>
              <p role="alert" className="text-sm text-destructive">{error}</p>
              <Button onClick={() => router.replace("/sign-in")}>Back to sign in</Button>
            </>
          ) : (
            <>
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Redirecting to your studio...</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
