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
        "group relative flex min-h-[220px] overflow-hidden rounded-2xl border border-border/70 bg-card text-white shadow-[0_18px_48px_rgba(16,18,34,0.16)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_64px_rgba(16,18,34,0.22)]",
        className
      )}
    >
      <DashboardMediaSurface alt={title} mediaSrc={mediaSrc} mediaType={mediaType} />

      <div className="relative flex w-full flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="inline-flex size-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur">
            <Icon className="size-5" />
          </div>
          {eyebrow ? (
            <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs font-medium text-white/82 backdrop-blur">
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
