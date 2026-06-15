import { useTranslations } from "next-intl"

import { DashboardMediaSurface } from "@/components/dashboard/dashboard-media-surface"
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
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="relative min-h-[320px] overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgb(0_0_0_/_0.05),0_14px_34px_rgb(0_0_0_/_0.08)]">
          <DashboardMediaSurface
            alt={item.title}
            mediaSrc={item.mediaSrc}
            mediaType={item.mediaType}
          />
          <div className="relative flex h-full flex-col justify-end p-6 text-white sm:p-8">
            <div className="mb-5 inline-flex size-12 items-center justify-center rounded-lg border border-white/20 bg-white/14 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.2)] backdrop-blur-md">
              <Icon className="size-6" />
            </div>
            <p className="text-sm font-medium text-white/72">
              {t("module.workspaceModule")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {item.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
              {item.description}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-lg border border-border/70 bg-card/95 p-5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_10px_24px_rgb(0_0_0_/_0.05)] backdrop-blur-xl">
            <p className="text-sm font-medium text-muted-foreground">
              {t("module.statusLabel")}
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">
              {t("module.statusTitle")}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("module.statusDescription")}
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-card/95 p-5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_10px_24px_rgb(0_0_0_/_0.05)] backdrop-blur-xl">
            <p className="text-sm font-medium text-muted-foreground">
              {t("module.includesLabel")}
            </p>
            <ul className="mt-4 space-y-3">
              {resolvedChecklist.map((entry) => (
                <li
                  key={entry}
                  className="flex items-start gap-3 text-sm leading-6 text-foreground"
                >
                  <span className="mt-1 size-2 rounded-full bg-primary" />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
