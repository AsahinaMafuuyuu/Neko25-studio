"use client"

import { CreditCard, Loader2, LogOut, UserCog } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
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
import { dashboardFooterMeta, getDashboardNavItems } from "@/lib/dashboard"
import type { AccountSettingsPayload } from "@/lib/settings-types"
import {
  AuthUser,
  clearLocalSession,
  getCurrentUser,
  getValidAccessToken,
  refreshSession,
  signOut,
} from "@/lib/insforge"
import { cn } from "@/lib/utils"
import { Link, usePathname, useRouter } from "@/src/i18n/navigation"

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href
  return pathname.startsWith(href)
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("Dashboard")
  const common = useTranslations("Common")
  const [loading, setLoading] = useState(true)
  const [routeTransitioning, setRouteTransitioning] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accountSettings, setAccountSettings] = useState<AccountSettingsPayload | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [creditBalanceFailed, setCreditBalanceFailed] = useState(false)
  const routeTransitionTimeoutRef = useRef<number | null>(null)
  const previousPathnameRef = useRef(pathname)
  const dashboardNavItems = useMemo(() => getDashboardNavItems(t), [t])

  useEffect(() => {
    const signInPath = `/sign-in?next=${encodeURIComponent(pathname || "/dashboard")}`

    getCurrentUser()
      .then((nextUser) => {
        if (!nextUser) {
          clearLocalSession()
          router.replace(signInPath)
          return
        }

        setUser(nextUser)
      })
      .catch(() => {
        clearLocalSession()
        router.replace(signInPath)
      })
      .finally(() => setLoading(false))
  }, [pathname, router])

  const currentItem = useMemo(
    () => {
      if (pathname.startsWith("/dashboard/billing")) {
        return {
          title: t("billingTitle"),
        }
      }

      if (pathname.startsWith("/dashboard/personal-settings")) {
        return {
          title: "Personal Settings",
        }
      }

      return (
        dashboardNavItems.find((item) => isActivePath(pathname, item.href)) ||
        dashboardNavItems[0]
      )
    },
    [dashboardNavItems, pathname, t]
  )
  const BrandIcon = dashboardFooterMeta.brandIcon
  const BillingIcon = dashboardFooterMeta.billingIcon

  const loadCreditBalance = useCallback(async () => {
    try {
      const response = await apiFetch("/api/billing/balance")
      const body = await readJson<{ creditBalance: number }>(response)
      setCreditBalance(body.creditBalance)
      setCreditBalanceFailed(false)
    } catch {
      setCreditBalanceFailed(true)
    }
  }, [])

  const loadAccountSettings = useCallback(async () => {
    try {
      const response = await apiFetch("/api/settings/profile")
      const body = await readJson<AccountSettingsPayload>(response)
      setAccountSettings(body)
      setCreditBalance(body.workspace.totalCredits)
      setCreditBalanceFailed(false)
    } catch {
      await loadCreditBalance()
    }
  }, [loadCreditBalance])

  useEffect(() => {
    if (!user) return
    const timeout = window.setTimeout(() => {
      loadAccountSettings()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadAccountSettings, user])

  useEffect(() => {
    const previousPathname = previousPathnameRef.current
    previousPathnameRef.current = pathname

    if (previousPathname === pathname) return

    if (routeTransitionTimeoutRef.current) {
      window.clearTimeout(routeTransitionTimeoutRef.current)
    }

    setRouteTransitioning(true)
    routeTransitionTimeoutRef.current = window.setTimeout(
      () => setRouteTransitioning(false),
      420
    )
  }, [pathname])

  useEffect(() => {
    return () => {
      if (routeTransitionTimeoutRef.current) {
        window.clearTimeout(routeTransitionTimeoutRef.current)
      }
    }
  }, [])

  async function onSignOut() {
    setSigningOut(true)
    await signOut()
    router.replace("/sign-in")
  }

  function onNavigationStart(href: string) {
    if (href === pathname) return

    if (routeTransitionTimeoutRef.current) {
      window.clearTimeout(routeTransitionTimeoutRef.current)
    }

    setRouteTransitioning(true)
    routeTransitionTimeoutRef.current = window.setTimeout(
      () => setRouteTransitioning(false),
      900
    )
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          {common("loadingDashboard")}
        </div>
      </main>
    )
  }

  if (!user) {
    const signInPath = `/sign-in?next=${encodeURIComponent(pathname || "/dashboard")}`

    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{common("redirecting")}</p>
          <Link
            href={signInPath}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {common("goToSignIn")}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar className="border-r border-sidebar-border/70" side="left">
        <SidebarHeader className="gap-3 px-3 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 font-semibold transition-colors hover:bg-sidebar-accent/70"
            onClick={() => onNavigationStart("/dashboard")}
          >
            <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <BrandIcon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm">{common("brand")}</span>
              <span className="truncate text-xs font-normal text-sidebar-foreground/65">
                {t("brandSubtitle")}
              </span>
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-2 py-1">
          <SidebarMenu>
            {dashboardNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActivePath(pathname, item.href)}
                  render={
                    <Link href={item.href} onClick={() => onNavigationStart(item.href)}>
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

        <SidebarFooter className="gap-2 px-3 pb-3">
          <SidebarSeparator />
          <Link
            href="/dashboard/billing"
            className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/35 px-3 py-2.5 transition-colors hover:bg-sidebar-accent/70"
            onClick={() => onNavigationStart("/dashboard/billing")}
          >
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-background/80 text-foreground shadow-sm">
                <BillingIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("billingTitle")}</p>
                <p className="mt-0.5 truncate text-xs text-sidebar-foreground/72">
                  {t("billingDescription")}
                </p>
              </div>
            </div>
          </Link>

          <div className="rounded-lg border border-sidebar-border/70 bg-background/45 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.12em] text-sidebar-foreground/66">
                {t("creditsTitle")}
              </p>
              <span className="rounded-md border border-accent/40 bg-accent/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-accent-foreground">
                {creditBalanceFailed ? "--" : creditBalance === null ? "..." : creditBalance.toLocaleString("en")}
              </span>
            </div>
          </div>

          <Link
            href="/dashboard/personal-settings"
            className="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/35 px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent/70"
            onClick={() => onNavigationStart("/dashboard/personal-settings")}
          >
            <span className="grid size-9 place-items-center rounded-lg bg-background/60 text-foreground shadow-sm">
              <UserCog className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">Personal Settings</span>
              <span className="block truncate text-xs text-sidebar-foreground/62">Profile and security</span>
            </span>
          </Link>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-screen">
        <PageRouteTransition show={routeTransitioning} />

        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
          <div className="flex min-h-14 items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <SidebarTrigger className="md:hidden" />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:block">
                    {t("eyebrow")}
                  </p>
                  <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
                  <h1 className="truncate text-base font-semibold tracking-tight">
                    {currentItem.title}
                  </h1>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <AccountHoverCard
                settings={accountSettings}
                email={user?.email || t("emailFallback")}
                credits={creditBalance}
                creditsFailed={creditBalanceFailed}
                onNavigate={onNavigationStart}
              />
              <LanguageSwitcher />
              <ThemeToggle />
              <Button variant="outline" onClick={onSignOut} disabled={signingOut}>
                {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                <span className="hidden sm:inline">{common("signOut")}</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 bg-background px-3 py-5 sm:px-5 lg:px-6 lg:py-6">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AccountHoverCard({
  settings,
  email,
  credits,
  creditsFailed,
  onNavigate,
}: {
  settings: AccountSettingsPayload | null
  email: string
  credits: number | null
  creditsFailed: boolean
  onNavigate: (href: string) => void
}) {
  const username = settings?.profile.username || email.split("@")[0] || "User"
  const avatarUrl = settings?.profile.avatarUrl || ""
  const plan = settings?.workspace.planTier || "Free Plan"
  const creditsLabel = creditsFailed ? "--" : credits === null ? "..." : credits.toLocaleString("en")

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted/60"
          />
        }
      >
        <UserAvatar avatarUrl={avatarUrl} username={username} />
        <span className="hidden max-w-44 truncate sm:inline">{email}</span>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-80 p-0">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <UserAvatar avatarUrl={avatarUrl} username={username} className="size-16" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{username}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full">{plan}</Badge>
                <Badge className="rounded-full border border-foreground/15 bg-foreground text-background shadow-none">
                  {creditsLabel} credits
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border/70 p-3">
          <Button
            variant="outline"
            nativeButton={false}
            onClick={() => onNavigate("/dashboard/personal-settings")}
            render={<Link href="/dashboard/personal-settings" />}
          >
            <UserCog />
            Personal
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            onClick={() => onNavigate("/dashboard/billing")}
            render={<Link href="/dashboard/billing" />}
          >
            <CreditCard />
            Billing
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function UserAvatar({
  avatarUrl,
  username,
  className,
}: {
  avatarUrl: string
  username: string
  className?: string
}) {
  return (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={username} /> : null}
      <AvatarFallback>{getInitials(username)}</AvatarFallback>
    </Avatar>
  )
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join("") || "U"
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await getValidAccessToken()
  if (!token) throw new Error("Your session has expired. Please sign in again.")
  const makeRequest = (accessToken: string) => {
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${accessToken}`)
    return fetch(path, { ...init, headers })
  }
  const response = await makeRequest(token)
  if (response.status !== 401) return response
  const refreshed = await refreshSession().catch(() => null)
  if (!refreshed?.accessToken) return response
  return makeRequest(refreshed.accessToken)
}

async function readJson<T>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (!response.ok) throw new Error(body.message || "Request failed.")
  return body
}

function PageRouteTransition({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/45 backdrop-blur-[2px] transition-opacity duration-200",
        show ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="w-44 overflow-hidden rounded-full border border-border/70 bg-card/90 p-1.5 shadow-lg">
        <div className="studio-route-loader h-1.5 w-full overflow-hidden rounded-full">
          <div className="studio-route-loader__bar h-full w-1/2 rounded-full" />
        </div>
      </div>
    </div>
  )
}
