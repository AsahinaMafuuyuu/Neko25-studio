import type { LucideIcon } from "lucide-react"
import type React from "react"

import { cn } from "@/lib/utils"

function DashboardPage({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("grid gap-6", className)}>{children}</div>
}

function DashboardPageHeader({
  actions,
  children,
  className,
  description,
  eyebrow,
  icon: Icon,
  meta,
  title,
}: {
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  icon?: LucideIcon
  meta?: React.ReactNode
  title: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/70 bg-card px-5 py-5 shadow-sm sm:px-6",
        className
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            {Icon ? (
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border/70 bg-background text-foreground shadow-xs">
                <Icon className="size-5" />
              </span>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
              ) : null}
              <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {title}
              </h2>
            </div>
          </div>
          {description ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
        {actions || meta ? (
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            {meta}
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function DashboardActionGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      {children}
    </div>
  )
}

function DashboardMetric({
  className,
  label,
  value,
}: {
  className?: string
  label: React.ReactNode
  value: React.ReactNode
}) {
  return (
    <div className={cn("rounded-lg border border-border/70 bg-background px-4 py-3", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function DashboardPanel({
  children,
  className,
  compact = false,
}: {
  children: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/70 bg-card shadow-sm",
        compact ? "p-4" : "p-5 sm:p-6",
        className
      )}
    >
      {children}
    </section>
  )
}

function DashboardSectionHeader({
  action,
  className,
  description,
  title,
}: {
  action?: React.ReactNode
  className?: string
  description?: React.ReactNode
  title: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function DashboardEmptyState({
  action,
  className,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode
  className?: string
  description: React.ReactNode
  icon?: LucideIcon
  title: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center shadow-sm",
        className
      )}
    >
      {Icon ? (
        <div className="mx-auto grid size-11 place-items-center rounded-lg border border-border/70 bg-background text-foreground">
          <Icon className="size-5" />
        </div>
      ) : null}
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

function DashboardError({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive",
        className
      )}
    >
      {children}
    </div>
  )
}

export {
  DashboardActionGroup,
  DashboardEmptyState,
  DashboardError,
  DashboardMetric,
  DashboardPage,
  DashboardPageHeader,
  DashboardPanel,
  DashboardSectionHeader,
}
