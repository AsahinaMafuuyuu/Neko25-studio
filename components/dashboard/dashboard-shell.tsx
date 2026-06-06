"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, LogOut } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  AuthUser,
  getCurrentUser,
  signOut,
} from "@/lib/insforge"
import {
  dashboardFooterMeta,
  dashboardNavItems,
  dashboardQuickStats,
} from "@/lib/dashboard"

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href
  return pathname.startsWith(href)
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    getCurrentUser()
      .then((nextUser) => {
        if (!nextUser) {
          router.replace(`/sign-in?next=${encodeURIComponent(pathname || "/dashboard")}`)
          return
        }

        setUser(nextUser)
      })
      .catch(() => router.replace(`/sign-in?next=${encodeURIComponent(pathname || "/dashboard")}`))
      .finally(() => setLoading(false))
  }, [pathname, router])

  const currentItem = useMemo(
    () =>
      dashboardNavItems.find((item) => isActivePath(pathname, item.href)) || dashboardNavItems[0],
    [pathname]
  )
  const BrandIcon = dashboardFooterMeta.brandIcon
  const BillingIcon = dashboardFooterMeta.billingIcon

  async function onSignOut() {
    setSigningOut(true)
    await signOut()
    router.replace("/sign-in")
  }

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          正在准备你的仪表板
        </div>
      </main>
    )
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar className="border-r border-sidebar-border/70" side="left">
        <SidebarHeader className="gap-4 px-3 py-4">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-2 py-2 font-semibold">
            <span className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <BrandIcon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm">Kravix AI Studio</span>
              <span className="truncate text-xs font-normal text-sidebar-foreground/65">Creative dashboard</span>
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-2">
          <SidebarMenu>
            {dashboardNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActivePath(pathname, item.href)}
                  render={
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  }
                  size="lg"
                  tooltip={item.title}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="gap-3 px-3 pb-4">
          <SidebarSeparator />
          <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/40 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-background/80 text-foreground shadow-sm">
                <BillingIcon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{dashboardFooterMeta.billingTitle}</p>
                <p className="mt-1 text-xs leading-5 text-sidebar-foreground/72">
                  {dashboardFooterMeta.billingDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/40 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sidebar-foreground/66">
              {dashboardFooterMeta.creditsTitle}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{dashboardFooterMeta.creditsValue}</p>
            <p className="mt-2 text-xs leading-5 text-sidebar-foreground/72">
              {dashboardFooterMeta.creditsDescription}
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/82 backdrop-blur-xl">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="md:hidden" />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Dashboard
                </p>
                <h1 className="truncate text-lg font-semibold tracking-tight">{currentItem.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm sm:block">
                {user?.email || "Authenticated user"}
              </div>
              <ThemeToggle />
              <Button variant="outline" onClick={onSignOut} disabled={signingOut}>
                {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <section className="grid gap-4 md:grid-cols-3">
              {dashboardQuickStats.map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-sm">
                  <p className="text-2xl font-semibold tracking-tight">{value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                </div>
              ))}
            </section>
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
