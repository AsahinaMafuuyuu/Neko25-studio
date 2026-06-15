import { DashboardMediaSurface } from "@/components/dashboard/dashboard-media-surface"
import type { DashboardNavItem } from "@/lib/dashboard"
import { cn } from "@/lib/utils"
import { Link } from "@/src/i18n/navigation"

type DashboardFeatureCardProps = DashboardNavItem & {
  className?: string
  eyebrow?: string
}

export function DashboardFeatureCard({
  className,
  description,
  eyebrow,
  href,
  icon: Icon,
  mediaSrc,
  mediaType,
  title,
}: DashboardFeatureCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[220px] overflow-hidden rounded-lg border border-border/70 bg-card text-white shadow-[0_1px_2px_rgb(0_0_0_/_0.06),0_14px_34px_rgb(0_0_0_/_0.10)] transition duration-200 hover:border-border hover:shadow-[0_1px_2px_rgb(0_0_0_/_0.08),0_18px_42px_rgb(0_0_0_/_0.14)]",
        className
      )}
    >
      <DashboardMediaSurface alt={title} mediaSrc={mediaSrc} mediaType={mediaType} />

      <div className="relative flex w-full flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="inline-flex size-11 items-center justify-center rounded-lg border border-white/20 bg-white/14 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.2)] backdrop-blur-md">
            <Icon className="size-5" />
          </div>
          {eyebrow ? (
            <span className="rounded-md border border-white/18 bg-black/20 px-3 py-1 text-xs font-medium text-white/82 backdrop-blur-md">
              {eyebrow}
            </span>
          ) : null}
        </div>

        <div className="max-w-sm">
          <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/78 sm:text-[15px]">{description}</p>
        </div>
      </div>
    </Link>
  )
}
