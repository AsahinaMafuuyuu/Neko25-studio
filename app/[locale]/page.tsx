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
      <header className="sticky top-0 z-20 border-b border-border bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
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

      <section className="relative min-h-[72svh] overflow-hidden bg-foreground text-background">
        <video
          aria-label={t("title")}
          autoPlay
          className="absolute inset-0 size-full object-cover opacity-58"
          loop
          muted
          playsInline
        >
          <source src="/ai-video-agent.mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,12,18,0.96)_0%,rgba(10,12,18,0.72)_48%,rgba(10,12,18,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,12,18,0.18)_0%,rgba(10,12,18,0.34)_100%)]" />

        <div className="relative mx-auto flex min-h-[72svh] max-w-7xl flex-col justify-center px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <p className="mb-5 flex w-fit items-center gap-2 rounded-md border border-background/14 bg-background/10 px-3 py-1 text-sm font-medium text-background/78 shadow-sm">
              <Zap className="size-4 text-accent" />
              {t("eyebrow")}
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-7xl">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-background/74">
              {t("description")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up?next=%2Fdashboard"
                className={cn(buttonVariants({ size: "lg" }), "h-12 bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                {t("createWorkspace")}
                <ArrowRight />
              </Link>
              <Link
                href="/sign-in?next=%2Fdashboard"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 border-background/20 bg-background/10 text-background hover:bg-background/16 hover:text-background"
                )}
              >
                {t("openStudio")}
              </Link>
            </div>
          </div>
        </div>

        <div className="relative hidden border-t border-background/10 bg-foreground/82 sm:block">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-background/12 bg-background/[0.06] p-4">
              <LockKeyhole className="mb-3 size-4 text-accent" />
              <p className="text-sm font-semibold">{t("secureAccess")}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-background/62">
                {t("secureAccessDescription")}
              </p>
            </div>
            <div className="rounded-xl border border-background/12 bg-background/[0.06] p-4">
              <Sparkles className="mb-3 size-4 text-primary" />
              <p className="text-sm font-semibold">{t("studioPolish")}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-background/62">
                {t("studioPolishDescription")}
              </p>
            </div>
            <div className="rounded-xl border border-background/12 bg-background/[0.06] p-4">
              <Workflow className="mb-3 size-4 text-background/78" />
              <p className="text-sm font-semibold">{t("workflowQuality")}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/14">
                <div className="h-full w-[84%] rounded-full bg-accent" />
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="p-6 sm:p-8">
              <div className="mb-5 grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="size-5" />
              </div>
              <CardTitle className="text-2xl tracking-tight">
                {t("features.prompt.title")}
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7">
                {t("features.prompt.description")}
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid gap-3">
            {featureConfig.slice(1).map((feature) => (
              <Card key={feature.key} className="border-border/80 shadow-sm" size="sm">
                <CardHeader className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                  <div className="grid size-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <feature.icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle>{t(`features.${feature.key}.title`)}</CardTitle>
                    <CardDescription>{t(`features.${feature.key}.description`)}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
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
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-3">
            {stats.map(([value, label]) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">{t(`stats.${label}`)}</p>
                <p className="text-lg font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
