import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import type { CSSProperties } from "react"

import { DashboardFeatureCard } from "@/components/dashboard/dashboard-feature-card"
import {
  dashboardFooterMeta,
  getDashboardHomeCards,
} from "@/lib/dashboard"
import { Link } from "@/src/i18n/navigation"

const priorityTones = [
  { color: "var(--primary)", ink: "var(--primary-foreground)" },
  { color: "var(--accent)", ink: "var(--accent-foreground)" },
  { color: "var(--chart-3)", ink: "var(--foreground)" },
] as const

const moduleTones = [
  { color: "var(--primary)", ink: "var(--primary-foreground)" },
  { color: "var(--accent)", ink: "var(--accent-foreground)" },
  { color: "var(--chart-4)", ink: "var(--foreground)" },
  { color: "var(--chart-5)", ink: "var(--primary-foreground)" },
] as const

function toneStyle(tone: { color: string; ink: string }) {
  return {
    "--tone": tone.color,
    "--tone-ink": tone.ink,
  } as CSSProperties
}

export default function DashboardHomePage() {
  const t = useTranslations("Dashboard")
  const HeroIcon = dashboardFooterMeta.heroIcon
  const dashboardHomeCards = getDashboardHomeCards(t)
  const featuredCard = dashboardHomeCards[0]
  const moduleCards = dashboardHomeCards.slice(1)
  const priorityCards = dashboardHomeCards.slice(0, 3)

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-foreground/10 bg-foreground text-background shadow-[0_24px_72px_rgba(16,18,34,0.18)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,color-mix(in_oklch,var(--primary),transparent_68%),transparent_34%),radial-gradient(circle_at_58%_82%,color-mix(in_oklch,var(--accent),transparent_78%),transparent_30%)]"
        />
        <div className="absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden border-l border-background/10 lg:block">
          <video
            aria-label={featuredCard.title}
            autoPlay
            className="size-full object-cover"
            loop
            muted
            playsInline
          >
            <source src={featuredCard.mediaSrc} />
          </video>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,12,18,0.92)_0%,rgba(10,12,18,0.28)_42%,rgba(10,12,18,0)_100%)]" />
        </div>

        <div className="relative grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(300px,0.48fr)] lg:p-8">
          <div className="flex min-w-0 flex-col justify-between gap-10">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-background text-foreground shadow-sm">
                  <HeroIcon className="size-5" />
                </span>
                <p className="text-sm font-semibold text-background/76">
                  {t("homeHeroEyebrow")}
                </p>
              </div>
              <h2 className="mt-7 max-w-3xl text-3xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
                {t("homeHeroTitle")}
              </h2>
            </div>

            <Link
              href={featuredCard.href}
              className="group inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <span>{featuredCard.title}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="grid content-end gap-2.5">
            {priorityCards.map((item, index) => {
              const Icon = item.icon
              const isFeatured = index === 0
              const tone = priorityTones[index % priorityTones.length]

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={toneStyle(tone)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-[color-mix(in_oklch,var(--tone),transparent_62%)] bg-[color-mix(in_oklch,var(--tone),transparent_86%)] px-3 py-3 text-sm shadow-sm transition-colors hover:bg-[color-mix(in_oklch,var(--tone),transparent_80%)]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--tone)] text-[var(--tone-ink)] shadow-sm">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-background">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-background/60">
                        {isFeatured
                          ? t("cardEyebrows.featured")
                          : t("cardEyebrows.module")}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-background/58 transition-transform group-hover:translate-x-0.5 group-hover:text-background" />
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.34fr)_minmax(340px,0.66fr)]">
        <DashboardFeatureCard
          {...featuredCard}
          className="min-h-[360px] xl:min-h-[460px]"
          eyebrow={t("cardEyebrows.featured")}
        />

        <div className="grid gap-3">
          {moduleCards.map((item, index) => {
            const Icon = item.icon
            const isLast = index === moduleCards.length - 1
            const tone = moduleTones[index % moduleTones.length]

            return (
              <Link
                key={item.href}
                href={item.href}
                style={toneStyle(tone)}
                className="group grid gap-4 rounded-2xl border border-[color-mix(in_oklch,var(--tone),transparent_76%)] bg-[color-mix(in_oklch,var(--tone),transparent_94%)] p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--tone),transparent_52%)] hover:bg-[color-mix(in_oklch,var(--tone),transparent_90%)] hover:shadow-[0_18px_44px_rgba(16,18,34,0.1)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-[var(--tone)] text-[var(--tone-ink)] shadow-sm">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-xs font-semibold text-[color-mix(in_oklch,var(--tone),var(--foreground)_42%)]">
                    {isLast ? t("cardEyebrows.overview") : t("cardEyebrows.module")}
                  </span>
                  <span className="mt-1 block truncate text-base font-semibold tracking-tight">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <ArrowRight className="hidden size-4 text-[color-mix(in_oklch,var(--tone),var(--foreground)_48%)] transition-transform group-hover:translate-x-0.5 sm:block" />
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
