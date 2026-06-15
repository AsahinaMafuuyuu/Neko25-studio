import { useTranslations } from "next-intl"

import { DashboardFeatureCard } from "@/components/dashboard/dashboard-feature-card"
import {
  dashboardFooterMeta,
  getDashboardHomeCards,
} from "@/lib/dashboard"

export default function DashboardHomePage() {
  const t = useTranslations("Dashboard")
  const HeroIcon = dashboardFooterMeta.heroIcon
  const dashboardHomeCards = getDashboardHomeCards(t)

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-lg border border-border/70 bg-card/95 px-6 py-8 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_14px_36px_rgb(0_0_0_/_0.06)] backdrop-blur-xl sm:px-8 sm:py-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary),transparent_93%),transparent_46%)]" />
        <div className="relative max-w-3xl">
          <div className="mb-5 inline-flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18),0_1px_2px_rgb(0_0_0_/_0.12)]">
            <HeroIcon className="size-5" />
          </div>
          <p className="text-sm font-medium text-primary">
            {t("homeHeroEyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            {t("homeHeroTitle")}
          </h2>
        </div>
      </section>

      <section className="grid auto-rows-[minmax(220px,1fr)] gap-4 md:grid-cols-6 xl:grid-cols-8">
        {dashboardHomeCards.map((item, index) => (
          <DashboardFeatureCard
            key={item.href}
            {...item}
            eyebrow={
              index === 0
                ? t("cardEyebrows.featured")
                : index === dashboardHomeCards.length - 1
                  ? t("cardEyebrows.overview")
                  : t("cardEyebrows.module")
            }
          />
        ))}
      </section>
    </div>
  )
}
