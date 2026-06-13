"use client"

import { Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { completeOAuth, getOAuthNext } from "@/lib/insforge"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get("code") || searchParams.get("insforge_code")
  const oauthError = searchParams.get("error") || searchParams.get("insforge_error")
  const handledRef = useRef(false)
  const [error, setError] = useState(
    oauthError || (code ? "" : "OAuth did not return a code. Please try signing in again.")
  )

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
      .then(() => router.replace(next))
      .catch((nextError) => {
        handledRef.current = false
        setError(nextError instanceof Error ? nextError.message : "OAuth sign-in failed.")
      })
  }, [code, oauthError, router, searchParams])

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-md border-border/80 bg-card/90 text-center shadow-xl">
        <CardHeader>
          <CardTitle>Completing sign in</CardTitle>
          <CardDescription>Finishing the secure InsForge OAuth handshake.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {error ? (
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
