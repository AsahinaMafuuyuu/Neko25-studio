import {
  ArrowRight,
  Bot,
  Database,
  LockKeyhole,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Link } from "@/src/i18n/navigation"

const featureConfig = [
  { key: "prompt", icon: Bot },
  { key: "context", icon: Database },
  { key: "workflow", icon: Workflow },
] as const

const stats = [
  ["3.8x", "cycles"],
  ["99.9%", "availability"],
  ["24/7", "workflows"],
] as const

export default function Home() {
  const t = useTranslations("Home")
  const common = useTranslations("Common")

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" />
            </span>
            {common("brand")}
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">
              {t("nav.features")}
            </a>
            <a href="#security" className="transition hover:text-foreground">
              {t("nav.security")}
            </a>
            <a href="#metrics" className="transition hover:text-foreground">
              {t("nav.metrics")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              href="/sign-in?next=%2Fdashboard"
              className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}
            >
              {common("signIn")}
            </Link>
            <Link href="/sign-up?next=%2Fdashboard" className={buttonVariants()}>
              {common("start")}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_520px] lg:px-8 lg:py-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(circle_at_12%_16%,color-mix(in_oklch,var(--accent),transparent_48%),transparent_26%),radial-gradient(circle_at_82%_8%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_30%)]" />
        <div className="flex flex-col justify-center">
          <p className="mb-5 flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-sm text-muted-foreground shadow-sm backdrop-blur">
            <Zap className="size-4 text-primary" />
            {t("eyebrow")}
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t("description")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up?next=%2Fdashboard" className={cn(buttonVariants({ size: "lg" }), "h-12")}>
              {t("createWorkspace")}
              <ArrowRight />
            </Link>
            <Link
              href="/sign-in?next=%2Fdashboard"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12")}
            >
              {t("openStudio")}
            </Link>
          </div>
        </div>

        <div className="relative min-h-[420px] rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-primary/15">
          <div className="grid h-full gap-4">
            <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("workflowQuality")}</p>
                  <p className="text-2xl font-semibold">98.4%</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                  {t("live")}
                </span>
              </div>
              <div className="space-y-3">
                {[82, 94, 68].map((value, index) => (
                  <div key={value} className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("evalLane", { index: index + 1 })}</span>
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
                <p className="font-medium">{t("secureAccess")}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("secureAccessDescription")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
                <Sparkles className="mb-4 size-5 text-primary" />
                <p className="font-medium">{t("studioPolish")}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("studioPolishDescription")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-primary">{t("featuresEyebrow")}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("featuresTitle")}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {featureConfig.map((feature) => (
            <Card
              key={feature.key}
              className="border-border/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <CardHeader>
                <div className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle>{t(`features.${feature.key}.title`)}</CardTitle>
                <CardDescription>{t(`features.${feature.key}.description`)}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="security" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/10 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-sm font-medium text-primary">{t("securityEyebrow")}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                {t("securityTitle")}
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
                {t("securityDescription")}
              </p>
            </div>
            <div className="grid gap-3">
              {(["oauth", "protected", "theme"] as const).map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm"
                >
                  {t(`checks.${item}`)}
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
              <p className="mt-2 text-sm text-muted-foreground">{t(`stats.${label}`)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
