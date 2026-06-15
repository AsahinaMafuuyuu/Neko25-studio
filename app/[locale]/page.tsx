import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  Film,
  Layers3,
  LockKeyhole,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Link } from "@/src/i18n/navigation"

const featureConfig = [
  { key: "prompt", icon: Bot, metric: "01" },
  { key: "context", icon: Database, metric: "02" },
  { key: "workflow", icon: Workflow, metric: "03" },
] as const

const stats = [
  ["3.8x", "cycles"],
  ["99.9%", "availability"],
  ["24/7", "workflows"],
] as const

const workflowLanes = [82, 94, 68] as const
const productModules = [
  { label: "AI Video Agent", icon: Film },
  { label: "AI Avatar", icon: Sparkles },
  { label: "Voice Clone", icon: Zap },
] as const

export default function Home() {
  const t = useTranslations("Home")
  const common = useTranslations("Common")

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/78 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/68">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-md font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/18"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18),0_1px_2px_rgb(0_0_0_/_0.12)]">
              <Sparkles className="size-4" />
            </span>
            <span className="truncate">{common("brand")}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a
              href="#features"
              className="rounded-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/18"
            >
              {t("nav.features")}
            </a>
            <a
              href="#security"
              className="rounded-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/18"
            >
              {t("nav.security")}
            </a>
            <a
              href="#metrics"
              className="rounded-sm transition hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/18"
            >
              {t("nav.metrics")}
            </a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
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

      <section className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(440px,0.78fr)] lg:px-8 lg:py-20">
        <div className="absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(circle_at_22%_18%,color-mix(in_oklch,var(--primary),transparent_84%),transparent_28%),linear-gradient(180deg,color-mix(in_oklch,var(--background),white_32%),var(--background))]" />
        <div className="flex flex-col justify-center lg:pb-8">
          <p className="mb-5 flex w-fit items-center gap-2 rounded-md border border-border/70 bg-card/86 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur-xl">
            <Zap className="size-4 text-primary" />
            {t("eyebrow")}
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.03] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-[64ch] text-base leading-8 text-muted-foreground sm:text-lg">
            {t("description")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up?next=%2Fdashboard"
              className={cn(buttonVariants({ size: "lg" }), "h-12 px-5")}
            >
              {t("createWorkspace")}
              <ArrowRight />
            </Link>
            <Link
              href="/sign-in?next=%2Fdashboard"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 px-5")}
            >
              {t("openStudio")}
            </Link>
          </div>

          <div className="mt-8 grid max-w-xl gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            {productModules.map((module) => (
              <div
                key={module.label}
                className="flex min-h-11 items-center gap-2 rounded-md border border-border/70 bg-card/72 px-3 shadow-sm backdrop-blur-xl"
              >
                <module.icon className="size-4 text-primary" />
                <span className="truncate">{module.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative lg:pt-4">
          <div className="relative overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_24px_70px_rgb(0_0_0_/_0.12)]">
            <div className="relative aspect-[16/11] min-h-[360px] bg-muted">
              <Image
                src="/voice-cloning.png"
                alt="Kravix AI voice cloning workflow preview"
                fill
                priority
                sizes="(min-width: 1024px) 520px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0_/_0.08),rgb(0_0_0_/_0.58))]" />
              <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
                <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/18 bg-black/30 px-3 text-sm font-medium text-white shadow-sm backdrop-blur-md">
                  <Film className="size-4" />
                  {t("live")}
                </span>
                <span className="rounded-md border border-white/18 bg-black/30 px-3 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-md">
                  98.4%
                </span>
              </div>
              <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/14 bg-black/34 p-4 text-white shadow-[0_10px_34px_rgb(0_0_0_/_0.24)] backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/72">{t("workflowQuality")}</p>
                    <p className="mt-1 text-lg font-semibold">AI Video Agent</p>
                  </div>
                  <Layers3 className="size-5 text-white/72" />
                </div>
                <div className="space-y-3">
                  {workflowLanes.map((value, index) => (
                    <div key={value} className="space-y-2">
                      <div className="flex justify-between text-xs text-white/72">
                        <span>{t("evalLane", { index: index + 1 })}</span>
                        <span>{value}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/18">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-px bg-border/70 sm:grid-cols-2">
              <TrustPanel icon={LockKeyhole} title={t("secureAccess")}>
                {t("secureAccessDescription")}
              </TrustPanel>
              <TrustPanel icon={Sparkles} title={t("studioPolish")}>
                {t("studioPolishDescription")}
              </TrustPanel>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] lg:items-start">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-primary">{t("featuresEyebrow")}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t("featuresTitle")}
            </h2>
          </div>
          <div className="grid gap-3">
            {featureConfig.map((feature) => (
              <Card
                key={feature.key}
                className="border-border/70 shadow-sm transition hover:border-border hover:bg-card/96 hover:shadow-[0_10px_28px_rgb(0_0_0_/_0.08)]"
              >
                <CardHeader className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                  <div className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle>{t(`features.${feature.key}.title`)}</CardTitle>
                    <CardDescription className="mt-2 leading-6">
                      {t(`features.${feature.key}.description`)}
                    </CardDescription>
                  </div>
                  <span className="hidden font-mono text-sm text-muted-foreground sm:block">
                    {feature.metric}
                  </span>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-border/70 bg-card/95 p-6 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_16px_44px_rgb(0_0_0_/_0.08)] backdrop-blur-xl sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-sm font-medium text-primary">{t("securityEyebrow")}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
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
                  className="flex min-h-12 items-center gap-3 rounded-lg border border-border/70 bg-background/78 px-4 py-3 text-sm text-muted-foreground shadow-sm"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                  <span>{t(`checks.${item}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="metrics" className="mx-auto max-w-7xl px-4 py-10 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map(([value, label]) => (
            <div
              key={label}
              className="rounded-lg border border-border/70 bg-card/95 p-6 shadow-sm transition-colors hover:bg-card"
            >
              <p className="text-3xl font-semibold">{value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t(`stats.${label}`)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function TrustPanel({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode
  icon: typeof LockKeyhole
  title: string
}) {
  return (
    <div className="bg-card/95 p-5">
      <Icon className="mb-4 size-5 text-primary" />
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  )
}
