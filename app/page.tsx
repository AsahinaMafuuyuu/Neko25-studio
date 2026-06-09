import Link from "next/link"
import { ArrowRight, Bot, Database, LockKeyhole, Sparkles, Workflow, Zap } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const features = [
  {
    title: "Prompt operations",
    description: "Design, compare, and ship prompts with repeatable evaluation habits.",
    icon: Bot,
  },
  {
    title: "Context vault",
    description: "Prepare datasets, docs, and retrieval context for every product surface.",
    icon: Database,
  },
  {
    title: "Launch workflows",
    description: "Coordinate model runs, QA, and release signals from one workspace.",
    icon: Workflow,
  },
]

const stats = [
  ["3.8x", "faster experiment cycles"],
  ["99.9%", "backend availability target"],
  ["24/7", "studio-ready workflows"],
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" />
            </span>
            Kravix AI Studio
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <a href="#security" className="transition hover:text-foreground">Security</a>
            <a href="#metrics" className="transition hover:text-foreground">Metrics</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/sign-in?next=%2Fdashboard" className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}>
              Sign in
            </Link>
            <Link href="/sign-up?next=%2Fdashboard" className={buttonVariants()}>
              Start
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_520px] lg:px-8 lg:py-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(circle_at_12%_16%,color-mix(in_oklch,var(--accent),transparent_48%),transparent_26%),radial-gradient(circle_at_82%_8%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_30%)]" />
        <div className="flex flex-col justify-center">
          <p className="mb-5 flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-sm text-muted-foreground shadow-sm backdrop-blur">
            <Zap className="size-4 text-primary" />
            AI Studio SaaS powered by InsForge
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            The calm control room for production AI products.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Kravix brings authentication, prompt workflows, knowledge assets, and launch readiness into a polished studio your team can use every day.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up?next=%2Fdashboard" className={cn(buttonVariants({ size: "lg" }), "h-12")}>
              Create workspace
              <ArrowRight />
            </Link>
            <Link href="/sign-in?next=%2Fdashboard" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12")}>
              Open studio
            </Link>
          </div>
        </div>

        <div className="relative min-h-[420px] rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-primary/15">
          <div className="grid h-full gap-4">
            <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Workflow quality</p>
                  <p className="text-2xl font-semibold">98.4%</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">Live</span>
              </div>
              <div className="space-y-3">
                {[82, 94, 68].map((value, index) => (
                  <div key={value} className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Eval lane {index + 1}</span>
                      <span>{value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
                <LockKeyhole className="mb-4 size-5 text-primary" />
                <p className="font-medium">Secure access</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Email auth plus Google and X OAuth entry points.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
                <Sparkles className="mb-4 size-5 text-primary" />
                <p className="font-medium">Studio polish</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Light and dark themes with consistent design tokens.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">Designed for daily product work</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Everything feels close at hand.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="security" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/10 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-sm font-medium text-primary">InsForge backend</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Authentication and product state share one foundation.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                The app is linked to InsForge for auth, future database work, storage, realtime, and backend functions without spreading secrets through the UI.
              </p>
            </div>
            <div className="grid gap-3">
              {["OAuth login", "Protected studio route", "Theme-safe components"].map((item) => (
                <div key={item} className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="metrics" className="mx-auto max-w-7xl px-4 py-10 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-3xl font-semibold">{value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
