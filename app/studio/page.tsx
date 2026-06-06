"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { BarChart3, Bot, Database, Layers3, Loader2, LogOut, Sparkles, Workflow } from "lucide-react"
import { useEffect, useState } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthUser, getCurrentUser, signOut, syncAuthenticatedUserFromCurrentSession } from "@/lib/insforge"

const modules = [
  {
    title: "Prompt lab",
    description: "Compose, evaluate, and refine production prompts.",
    icon: Bot,
  },
  {
    title: "Knowledge base",
    description: "Organize datasets and retrieval-ready context.",
    icon: Database,
  },
  {
    title: "Workflow runs",
    description: "Track experiments, outputs, and launch checks.",
    icon: Workflow,
  },
]

const metrics = [
  ["24", "Active flows"],
  ["98%", "Eval pass rate"],
  ["12k", "Monthly runs"],
]

export default function StudioPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    getCurrentUser()
      .then((nextUser) => {
        if (!nextUser) {
          router.replace("/sign-in?next=/studio")
          return
        }
        setUser(nextUser)
        syncAuthenticatedUserFromCurrentSession("sign_in").catch((error) => {
          console.error("Failed to sync current user into InsForge users table.", error)
        })
      })
      .catch(() => router.replace("/sign-in?next=/studio"))
      .finally(() => setLoading(false))
  }, [router])

  async function onSignOut() {
    setSigningOut(true)
    await signOut()
    router.replace("/sign-in")
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          Preparing your studio
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" />
            </span>
            Kravix Studio
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={onSignOut} disabled={signingOut}>
              {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_340px] lg:px-8">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/10">
            <div className="relative p-6 sm:p-8">
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_20%,color-mix(in_oklch,var(--accent),transparent_45%),transparent_30%),radial-gradient(circle_at_88%_12%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_24%)]" />
              <p className="mb-4 text-sm font-medium text-muted-foreground">Welcome back{user?.email ? `, ${user.email}` : ""}</p>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
                Your AI product command center is online.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Shape prompts, connect knowledge, and move promising experiments toward production without leaving the studio.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg">
                  <Sparkles />
                  New workflow
                </Button>
                <Button size="lg" variant="outline">
                  <Layers3 />
                  Import context
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {modules.map((module) => (
              <Card key={module.title} className="border-border/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <CardHeader>
                  <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <module.icon className="size-5" />
                  </div>
                  <CardTitle>{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Studio health</CardTitle>
              <CardDescription>Operational signals for this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {metrics.map(([value, label]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-lg font-semibold">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <div className="mb-3 grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <BarChart3 className="size-5" />
              </div>
              <CardTitle>Next launch check</CardTitle>
              <CardDescription>Connect your first dataset and run an evaluation suite.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">Open checklist</Button>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  )
}
