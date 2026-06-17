import { ArrowRight, FolderKanban } from "lucide-react"
import { useTranslations } from "next-intl"

import { DashboardMediaSurface } from "@/components/dashboard/dashboard-media-surface"
import {
  DashboardPanel,
  DashboardSectionHeader,
} from "@/components/dashboard/dashboard-layout"
import { dashboardFooterMeta, getDashboardHomeCards } from "@/lib/dashboard"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Link } from "@/src/i18n/navigation"

export default function DashboardHomePage() {
  const t = useTranslations("Dashboard")
  const HeroIcon = dashboardFooterMeta.heroIcon
  const dashboardHomeCards = getDashboardHomeCards(t)
  const primaryCard = dashboardHomeCards[0]
  const moduleCards = dashboardHomeCards.slice(1)

  return (
    <div className="grid gap-6">
      <section>
        <div className="relative overflow-hidden rounded-xl border border-foreground/10 bg-foreground text-background shadow-[0_18px_48px_rgba(16,18,34,0.16)] ring-1 ring-background/10">
          <div className="absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden border-l border-background/10 lg:block">
            <DashboardMediaSurface
              alt={primaryCard.title}
              mediaSrc={primaryCard.mediaSrc}
              mediaType={primaryCard.mediaType}
            />
          </div>

          <div className="relative grid min-h-[430px] content-between gap-10 p-5 sm:p-7 lg:w-[66%] lg:p-8">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-background text-foreground shadow-sm">
                  <HeroIcon className="size-5" />
                </span>
                <p className="text-sm font-medium text-background/72">
                  {t("homeHeroEyebrow")}
                </p>
              </div>
              <h2 className="mt-6 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl lg:text-5xl">
                {t("homeHeroTitle")}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-background/72 sm:text-base">
                {primaryCard.description}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={primaryCard.href}
                className={cn(buttonVariants({ size: "lg" }), "h-11 px-4")}
              >
                <span>{primaryCard.title}</span>
                <ArrowRight />
              </Link>
              <Link
                href="/dashboard/library"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-11 border-background/20 bg-background/10 text-background hover:bg-background/16 hover:text-background"
                )}
              >
                <FolderKanban />
                {t("nav.library.title")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <DashboardPanel>
        <DashboardSectionHeader
          title={t("homeModules.title")}
          description={t("homeModules.description")}
        />
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {moduleCards.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group grid gap-4 rounded-lg border border-border/70 bg-background/70 p-4 text-left shadow-xs transition-[background-color,border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-primary/25 hover:bg-secondary/35 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground ring-1 ring-border/60">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold tracking-tight">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <ArrowRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
              </Link>
            )
          })}
        </div>
      </DashboardPanel>
    </div>
  )
}
