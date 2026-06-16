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
        "group relative flex min-h-[220px] overflow-hidden rounded-xl border border-border/70 bg-card text-background shadow-sm transition-colors hover:border-foreground/20",
        className
      )}
    >
      <DashboardMediaSurface alt={title} mediaSrc={mediaSrc} mediaType={mediaType} />

      <div className="relative flex w-full flex-col justify-between p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="inline-flex size-12 items-center justify-center rounded-xl border border-white/18 bg-primary text-primary-foreground shadow-sm">
            <Icon className="size-5" />
          </div>
          {eyebrow ? (
            <span className="rounded-md border border-background/18 bg-background/12 px-3 py-1 text-xs font-semibold text-background">
              {eyebrow}
            </span>
          ) : null}
        </div>

        <div className="max-w-lg">
          <h3 className="text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
            {title}
          </h3>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/80 sm:text-[15px]">
            {description}
          </p>
        </div>
      </div>
    </Link>
  )
}
