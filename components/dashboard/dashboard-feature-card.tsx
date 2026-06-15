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
        "group relative flex min-h-[220px] overflow-hidden rounded-2xl border border-foreground/10 bg-card text-white shadow-[0_18px_48px_rgba(16,18,34,0.16)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_64px_rgba(16,18,34,0.22)]",
        className
      )}
    >
      <DashboardMediaSurface alt={title} mediaSrc={mediaSrc} mediaType={mediaType} />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,color-mix(in_oklch,var(--primary),transparent_58%),transparent_34%),radial-gradient(circle_at_82%_22%,color-mix(in_oklch,var(--accent),transparent_72%),transparent_28%)] opacity-90 transition-opacity duration-200 group-hover:opacity-100"
      />

      <div className="relative flex w-full flex-col justify-between p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="inline-flex size-12 items-center justify-center rounded-xl border border-white/18 bg-primary text-primary-foreground shadow-sm">
            <Icon className="size-5" />
          </div>
          {eyebrow ? (
            <span className="rounded-full border border-white/18 bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
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
