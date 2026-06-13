import { Suspense } from "react"

import { AuthPage } from "@/components/auth/auth-page"

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AuthPage mode="sign-in" />
    </Suspense>
  )
}
