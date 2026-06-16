import { useTranslations } from "next-intl"

import { DashboardMediaSurface } from "@/components/dashboard/dashboard-media-surface"
import {
  DashboardPanel,
  DashboardSectionHeader,
} from "@/components/dashboard/dashboard-layout"
import type { DashboardNavItem } from "@/lib/dashboard"

export function DashboardModulePage({
  item,
  checklist,
}: {
  item: DashboardNavItem
  checklist?: string[]
}) {
  const t = useTranslations("Dashboard")
  const Icon = item.icon
  const resolvedChecklist = checklist || [
    t("module.defaultChecklist.entry"),
    t("module.defaultChecklist.media"),
    t("module.defaultChecklist.workflow"),
  ]

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[360px] overflow-hidden rounded-xl border border-foreground/10 bg-card shadow-[0_18px_48px_rgba(16,18,34,0.16)]">
          <DashboardMediaSurface
            alt={item.title}
            mediaSrc={item.mediaSrc}
            mediaType={item.mediaType}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,color-mix(in_oklch,var(--primary),transparent_62%),transparent_32%),radial-gradient(circle_at_78%_24%,color-mix(in_oklch,var(--accent),transparent_76%),transparent_28%)]"
          />
          <div className="relative flex h-full flex-col justify-end p-6 text-white sm:p-8">
            <div className="mb-5 inline-flex size-11 items-center justify-center rounded-lg border border-white/18 bg-background text-foreground shadow-sm">
              <Icon className="size-6" />
            </div>
            <p className="text-sm font-medium text-white/74">
              {t("module.workspaceModule")}
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {item.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
              {item.description}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <DashboardPanel compact>
            <DashboardSectionHeader
              title={t("module.statusTitle")}
              description={t("module.statusDescription")}
            />
          </DashboardPanel>

          <DashboardPanel compact>
            <DashboardSectionHeader title={t("module.includesLabel")} />
            <ul className="mt-4 space-y-3">
              {resolvedChecklist.map((entry) => (
                <li
                  key={entry}
                  className="flex items-start gap-3 text-sm leading-6 text-foreground"
                >
                  <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <span className="size-1.5 rounded-full bg-current" />
                  </span>
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </DashboardPanel>
        </div>
      </section>
    </div>
  )
}
