import { DashboardFeatureCard } from "@/components/dashboard/dashboard-feature-card"
import { dashboardFooterMeta, dashboardHomeCards } from "@/lib/dashboard"

export default function DashboardHomePage() {
  const HeroIcon = dashboardFooterMeta.heroIcon

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-8 shadow-[0_20px_60px_rgba(16,18,34,0.08)] sm:px-8 sm:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--accent),transparent_58%),transparent_32%),radial-gradient(circle_at_86%_18%,color-mix(in_oklch,var(--primary),transparent_80%),transparent_26%)]" />
        <div className="relative max-w-3xl">
          <div className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <HeroIcon className="size-5" />
          </div>
          <p className="text-sm font-medium text-primary">Creative Command Center</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            在一个干净的工作台里管理视频、虚拟人、声音与素材库。
          </h2>
        </div>
      </section>

      <section className="grid auto-rows-[minmax(220px,1fr)] gap-4 md:grid-cols-6 xl:grid-cols-8">
        {dashboardHomeCards.map((item, index) => (
          <DashboardFeatureCard
            key={item.href}
            {...item}
            eyebrow={index === 0 ? "Featured" : index === dashboardHomeCards.length - 1 ? "Overview" : "Module"}
          />
        ))}
      </section>
    </div>
  )
}
