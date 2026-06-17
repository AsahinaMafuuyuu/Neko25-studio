"use client"

import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  CreditCard,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as echarts from "echarts"
import type { EChartsOption } from "echarts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DashboardActionGroup,
  DashboardError,
  DashboardPage,
  DashboardPageHeader,
  DashboardPanel,
  DashboardSectionHeader,
} from "@/components/dashboard/dashboard-layout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getValidAccessToken, refreshSession } from "@/lib/backend"
import { cn } from "@/lib/utils"
import type { BillingPayload, BillingRange } from "@/lib/billing"

type CreditPackage = {
  credits: number
  price: string
  value: string
}

type PaymentMethod = "alipay" | "wechat"
type EChartsInstance = ReturnType<typeof echarts.init>

const creditPackages: CreditPackage[] = [
  { credits: 1000, price: "\uFFE51", value: "1000" },
  { credits: 5000, price: "\uFFE53", value: "5000" },
  { credits: 10000, price: "\uFFE56", value: "10000" },
]

const categoryColors = {
  "AI Voice Cloning": "--primary",
  "AI Avatar": "--foreground",
  "AI Video Agent": "--accent",
  "AI Video Avatar": "--secondary-foreground",
} as const

const creditMeterStyles: Record<string, { width: string; bar: string }> = {
  "1000": {
    width: "33%",
    bar: "bg-[color-mix(in_oklch,var(--primary),var(--accent)_12%)]",
  },
  "5000": {
    width: "66%",
    bar: "bg-[color-mix(in_oklch,var(--primary),var(--accent)_16%)]",
  },
  "10000": {
    width: "100%",
    bar: "bg-[color-mix(in_oklch,var(--primary),var(--accent)_20%)]",
  },
}

const billingDateInputClasses =
  "h-8 w-36 border-border/70 bg-[color-mix(in_oklch,var(--secondary),var(--background)_42%)] text-foreground transition-[background-color,border-color,box-shadow] duration-200 hover:border-primary/30 hover:bg-background focus-visible:bg-background"

const billingChoiceClasses =
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"

export function BillingPage() {
  const router = useRouter()
  const chartRef = useRef<EChartsInstance | null>(null)
  const rechargeRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState<BillingRange>("7d")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [data, setData] = useState<BillingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [chartVersion, setChartVersion] = useState(0)
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("alipay")

  const requestPath = useMemo(() => {
    const params = new URLSearchParams({ range })
    if (range === "custom") {
      if (customFrom) params.set("from", customFrom)
      if (customTo) params.set("to", customTo)
    }
    return `/api/billing?${params.toString()}`
  }, [customFrom, customTo, range])

  const loadBilling = useCallback(async () => {
    const response = await apiFetch(requestPath)
    const body = await readJson<BillingPayload>(response)
    setData(body)
    setChartVersion((current) => current + 1)
  }, [requestPath])
  const handleUsageChartReady = useCallback((chart: EChartsInstance) => {
    chartRef.current = chart
  }, [])

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      loadBilling()
        .then(() => {
          if (!cancelled) setError("")
        })
        .catch((nextError) => {
          if (!cancelled) {
            setError(nextError instanceof Error ? nextError.message : "Could not load billing data.")
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadBilling])

  async function onRefresh() {
    setRefreshing(true)
    try {
      await loadBilling()
      setError("")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not refresh billing data.")
    } finally {
      setRefreshing(false)
    }
  }

  async function saveTrendChart() {
    if (!chartRef.current) {
      setError("There is no chart available to save yet.")
      return
    }

    setSaving(true)
    try {
      const pngUrl = chartRef.current.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: getCanvasBackground(),
      })
      const link = document.createElement("a")
      link.href = pngUrl
      link.download = `usage-trend-${range}.png`
      link.click()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save chart data.")
    } finally {
      setSaving(false)
    }
  }

  function buyCredits() {
    if (!selectedPackage) return
    const params = new URLSearchParams({
      credits: String(selectedPackage.credits),
      price: selectedPackage.price,
      method: paymentMethod,
    })
    router.push(`/dashboard/billing/checkout?${params.toString()}`)
  }

  const trend = useMemo(() => data?.trend || [], [data?.trend])
  const categoryTrend = useMemo(() => data?.categoryTrend || [], [data?.categoryTrend])
  const categoryCosts = useMemo(() => data?.categoryCosts || [], [data?.categoryCosts])
  const hasTrendData = trend.some((point) => point.cost > 0)
  const usageOption = useMemo<EChartsOption>(() => {
    return {
      animationDuration: 720,
      color: [getThemeColor("--primary")],
      grid: { left: 34, right: 22, top: 28, bottom: 34 },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          lineStyle: { color: "rgba(124,58,237,0.38)", width: 2 },
        },
        borderWidth: 0,
        backgroundColor: "rgba(17,24,39,0.92)",
        textStyle: { color: "#fff" },
        formatter(params) {
          const item = Array.isArray(params) ? params[0] : params
          const axisValue = String((item as { axisValue?: unknown } | undefined)?.axisValue || "")
          const point = trend.find((entry) => entry.date === axisValue)
          if (!point) return ""
          const diff = point.cost - point.previousCost
          return [
            `<strong>${formatDateLong(point.date)}</strong>`,
            `Cost: ${formatNumber(point.cost)} credits`,
            `vs yesterday: ${formatSignedNumber(diff)} credits`,
          ].join("<br/>")
        },
      },
      xAxis: {
        type: "category",
        data: trend.map((point) => point.date),
        boundaryGap: false,
        axisLabel: { color: "#8b93a7", formatter: shortDate },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#8b93a7" },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
      },
      series: [
        {
          name: "Cost",
          type: "line",
          smooth: true,
          data: trend.map((point) => point.cost),
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { width: 4, shadowColor: "rgba(124,58,237,0.3)", shadowBlur: 14 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(124,58,237,0.34)" },
              { offset: 1, color: "rgba(20,184,166,0.02)" },
            ]),
          },
          emphasis: {
            focus: "none",
            scale: 1.18,
            lineStyle: { width: 4, opacity: 1 },
            itemStyle: { opacity: 1 },
          },
          blur: {
            lineStyle: { opacity: 1 },
            itemStyle: { opacity: 1 },
            areaStyle: { opacity: 1 },
          },
        },
      ],
    }
  }, [trend])
  const categoryPieOption = useMemo<EChartsOption>(() => {
    return {
      animationDuration: 760,
      tooltip: {
        trigger: "item",
        formatter: "{b}<br/>{c} credits ({d}%)",
      },
      series: [
        {
          name: "Credits Costs",
          type: "pie",
          radius: ["42%", "72%"],
          center: ["50%", "50%"],
          minAngle: 8,
          avoidLabelOverlap: true,
          label: {
            show: true,
            formatter: "{b}\n{d}%",
            color: "#6b7280",
            fontSize: 12,
            lineHeight: 16,
          },
          labelLine: {
            show: true,
            length: 14,
            length2: 10,
          },
          itemStyle: {
            borderColor: getCanvasBackground(),
            borderWidth: 3,
          },
          data: categoryCosts.map((item) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: getThemeColor(categoryColors[item.name as keyof typeof categoryColors] || "--primary") },
          })),
        },
      ],
    }
  }, [categoryCosts])
  const categoryLineOption = useMemo<EChartsOption>(() => {
    return {
      animationDuration: 720,
      grid: { left: 34, right: 22, top: 38, bottom: 34 },
      legend: {
        top: 0,
        textStyle: { color: "#8b93a7" },
      },
      tooltip: {
        trigger: "axis",
        borderWidth: 0,
        backgroundColor: "rgba(17,24,39,0.92)",
        textStyle: { color: "#fff" },
      },
      xAxis: {
        type: "category",
        data: categoryTrend.map((point) => point.date),
        boundaryGap: false,
        axisLabel: { color: "#8b93a7", formatter: shortDate },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#8b93a7" },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.18)" } },
      },
      series: Object.keys(categoryColors).map((name) => {
        const color = getThemeColor(categoryColors[name as keyof typeof categoryColors])

        return {
          name,
          type: "line",
          smooth: true,
          data: categoryTrend.map((point) => point[name as keyof typeof categoryColors] || 0),
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 3, color, opacity: 1 },
          emphasis: {
            focus: "none",
            scale: 1.12,
            lineStyle: { width: 3, color, opacity: 1 },
            itemStyle: { color, opacity: 1 },
          },
          blur: {
            lineStyle: { opacity: 1 },
            itemStyle: { opacity: 1 },
          },
          itemStyle: { color },
        }
      }),
    }
  }, [categoryTrend])

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={BarChart3}
        eyebrow="Billing Overview"
        title="Billing & Credits"
        description="Track credit usage, review billing movement, and prepare recharge flows for Alipay or WeChat payments."
        actions={
          <DashboardActionGroup>
            <Button onClick={() => rechargeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <Zap />
              Recharge Credits
            </Button>
            <Button variant="outline" onClick={() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <FileText />
              View Invoices
            </Button>
          </DashboardActionGroup>
        }
      />

      {error ? (
        <DashboardError>{error}</DashboardError>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          icon={WalletCards}
          tone="bg-accent/16 text-foreground ring-accent/25"
          title="Total Credits"
          value={loading ? "..." : formatNumber(data?.summary.totalCredits || 0)}
          description="Available credits ready for generation jobs."
        />
        <SummaryCard
          icon={TrendingDown}
          tone="bg-destructive/10 text-destructive ring-destructive/20"
          title="Spent This Month"
          value={loading ? "..." : formatNumber(data?.summary.spentThisMonth || 0)}
          description="Credits consumed in the current billing cycle."
        />
        <SummaryCard
          icon={Sparkles}
          tone="bg-primary/10 text-primary ring-primary/20"
          title="Active Plan"
          value={loading ? "..." : data?.summary.activePlan || "Starter"}
          description="Plan data is a placeholder until subscriptions are wired."
        />
        <SummaryCard
          icon={TrendingUp}
          tone="bg-foreground/[0.06] text-foreground ring-foreground/15"
          title="Compare With Last Month"
          value={loading ? "..." : formatSignedNumber(data?.summary.compareWithLastMonth || 0)}
          description="Positive values mean higher spend than last month."
        />
      </section>

      <DashboardPanel compact>
        <DashboardSectionHeader
          title="Usage Trend"
          description="Cost over time with day-over-day context on hover."
          action={
          <ChartControls
            range={range}
            customFrom={customFrom}
            customTo={customTo}
            loading={refreshing}
            saving={saving}
            onRangeChange={setRange}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            onRefresh={onRefresh}
            onSave={saveTrendChart}
          />
          }
        />

        <div className="mt-5">
          <EChart
            key={`usage-${chartVersion}`}
            className="h-72 w-full"
            option={usageOption}
            onReady={handleUsageChartReady}
          />
          {!loading && !hasTrendData ? (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              No credit spending in this date range yet.
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <AnalysisCard
            icon={Activity}
            title="Peak Usage"
            value={loading ? "..." : `${formatNumber(data?.analytics.peakUsage.credits || 0)} credits`}
            description={loading ? "Loading usage peak." : `Highest day: ${data?.analytics.peakUsage.date || "No usage"}.`}
          />
          <AnalysisCard
            icon={CalendarDays}
            title="Average Daily"
            value={loading ? "..." : `${formatNumber(data?.analytics.averageDaily.credits || 0)} credits`}
            description={loading ? "Loading average." : `Across ${data?.analytics.averageDaily.label || "0 days"}.`}
          />
        </div>
      </DashboardPanel>

      <div ref={rechargeRef}>
        <DashboardPanel compact>
          <DashboardSectionHeader
            title="Recharge Credits"
            description="Select a credit package. Checkout is a placeholder for Alipay or WeChat integration."
          />
          <div className="mt-5 grid gap-3">
            {creditPackages.map((item) => (
              <CreditPackageCard
                key={item.value}
                item={item}
                selected={selectedPackage?.value === item.value}
                onSelect={() => setSelectedPackage(item)}
              />
            ))}
          </div>
          <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
          <Button
            className="mt-5 h-11 w-full text-base font-semibold"
            disabled={!selectedPackage}
            onClick={buyCredits}
          >
            <CreditCard />
            Buy Credits
          </Button>
        </DashboardPanel>
      </div>

      <section ref={summaryRef} className="space-y-4">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Billing Summary</CardTitle>
            <CardDescription>Current cycle information and consumed amount.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryRow label="Next invoice" value={data?.summary.nextInvoice || "..."} />
            <SummaryRow label="Total cost" value={data?.summary.totalCost || "..."} />
            <SummaryRow label="Payment" value={`${formatNumber(data?.summary.spentThisMonth || 0)} credits consumed`} />
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Billing History</CardTitle>
              <CardDescription>Recent credit movement in the selected date range.</CardDescription>
            </div>
            <div className="flex gap-2 rounded-lg border border-border/60 bg-secondary/35 p-1 shadow-xs">
              <Input className={billingDateInputClasses} type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
              <Input className={billingDateInputClasses} type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
              <Button size="sm" variant="outline" onClick={() => setRange("custom")}>Filter</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.history || []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDateTime(item.date)}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                    <TableCell>{item.amount}</TableCell>
                    <TableCell className={item.credits >= 0 ? "text-foreground" : "text-destructive"}>
                      {formatSignedNumber(item.credits)}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !data?.history.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No billing movement in this date range.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <DashboardPanel compact>
        <DashboardSectionHeader
          title="Credits Costs"
          description="Category share and daily cost by product."
          action={
          <ChartControls
            range={range}
            customFrom={customFrom}
            customTo={customTo}
            loading={refreshing}
            saving={false}
            onRangeChange={setRange}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            onRefresh={onRefresh}
          />
          }
        />

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <EChart className="h-80 w-full" option={categoryPieOption} />
          <EChart key={`category-${chartVersion}`} className="h-80 w-full" option={categoryLineOption} />
        </div>
      </DashboardPanel>
    </DashboardPage>
  )
}

function SummaryCard({
  icon: Icon,
  tone,
  title,
  value,
  description,
}: {
  icon: LucideIcon
  tone: string
  title: string
  value: string
  description: string
}) {
  return (
    <Card className="relative overflow-hidden border border-border/70 transition-colors hover:ring-foreground/15">
      <CardHeader>
        <div className={cn("mb-3 grid size-11 place-items-center rounded-lg ring-1", tone)}>
          <Icon className="size-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function EChart({
  option,
  className,
  onReady,
}: {
  option: EChartsOption
  className?: string
  onReady?: (chart: EChartsInstance) => void
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<EChartsInstance | null>(null)

  useEffect(() => {
    if (!elementRef.current) return
    const chart = echarts.init(elementRef.current, null, { renderer: "canvas" })
    chartRef.current = chart
    onReady?.(chart)

    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(elementRef.current)

    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [onReady])

  useEffect(() => {
    chartRef.current?.setOption(option, true)
  }, [option])

  return <div ref={elementRef} className={cn("min-h-64", className)} />
}

function CreditPackageCard({
  item,
  selected,
  onSelect,
}: {
  item: CreditPackage
  selected: boolean
  onSelect: () => void
}) {
  const meter = creditMeterStyles[item.value]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative overflow-hidden rounded-xl border p-4 text-left shadow-xs transition-[background-color,border-color,box-shadow,transform]",
        "duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0",
        billingChoiceClasses,
        selected
          ? "border-primary/55 bg-[color-mix(in_oklch,var(--primary),var(--background)_92%)] ring-2 ring-primary/20"
          : "border-border/70 bg-card hover:border-primary/25 hover:bg-[color-mix(in_oklch,var(--secondary),var(--background)_50%)] hover:shadow-sm"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span>
          <span className="block text-base font-semibold text-foreground">{formatNumber(item.credits)} credits</span>
          <span className="mt-1 block text-sm text-muted-foreground">Instant package for creative generation.</span>
        </span>
        <span className={cn(
          "rounded-full px-3 py-1 text-xl font-semibold tracking-tight shadow-sm transition-colors",
          selected ? "bg-primary text-primary-foreground" : "bg-background/85 text-foreground group-hover:bg-accent/20"
        )}>
          {item.price}
        </span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--secondary),var(--background)_30%)] shadow-inner">
        <div
          className={cn("h-full rounded-full transition-[width,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:brightness-105 motion-reduce:transition-none", meter.bar)}
          style={{ width: meter.width }}
        />
      </div>
    </button>
  )
}

function AnalysisCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: LucideIcon
  title: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-md bg-background text-primary shadow-sm">
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function ChartControls({
  range,
  customFrom,
  customTo,
  loading,
  saving,
  onRangeChange,
  onCustomFromChange,
  onCustomToChange,
  onRefresh,
  onSave,
}: {
  range: BillingRange
  customFrom: string
  customTo: string
  loading: boolean
  saving: boolean
  onRangeChange: (value: BillingRange) => void
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  onRefresh: () => void
  onSave?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-secondary/35 p-1 shadow-xs">
      <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
        Refresh
      </Button>
      {(["1d", "7d", "30d"] as const).map((item) => (
        <Button
          key={item}
          size="sm"
          variant={range === item ? "default" : "outline"}
          onClick={() => onRangeChange(item)}
        >
          {item}
        </Button>
      ))}
      <Input className={billingDateInputClasses} type="date" value={customFrom} onChange={(event) => onCustomFromChange(event.target.value)} />
      <Input className={billingDateInputClasses} type="date" value={customTo} onChange={(event) => onCustomToChange(event.target.value)} />
      <Button size="sm" variant={range === "custom" ? "default" : "outline"} onClick={() => onRangeChange("custom")}>
        Filter
      </Button>
      {onSave ? (
        <Button size="sm" variant="outline" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Download />}
          Save Data
        </Button>
      ) : null}
    </div>
  )
}

function PaymentMethodPicker({
  value,
  onChange,
  compact = false,
}: {
  value: PaymentMethod
  onChange: (value: PaymentMethod) => void
  compact?: boolean
}) {
  const options: Array<{ value: PaymentMethod; label: string; description: string }> = [
    { value: "alipay", label: "Alipay", description: "Default automatic payment preference." },
    { value: "wechat", label: "WeChat Pay", description: "Prepared for future setup." },
  ]

  return (
    <div className={cn("grid gap-3", compact ? "mt-3" : "mt-5 sm:grid-cols-2")}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "flex items-start justify-between rounded-xl border p-3 text-left shadow-xs transition-[background-color,border-color,box-shadow,transform]",
            "duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0",
            billingChoiceClasses,
            value === option.value
              ? "border-primary/55 bg-[color-mix(in_oklch,var(--primary),var(--background)_93%)] ring-2 ring-primary/15"
              : "border-border/70 bg-[color-mix(in_oklch,var(--secondary),var(--background)_58%)] hover:border-accent/45 hover:bg-[color-mix(in_oklch,var(--accent),var(--background)_92%)] hover:shadow-sm"
          )}
        >
          <span className="flex min-w-0 gap-3">
            <PaymentIcon method={option.value} active={value === option.value} />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
            </span>
          </span>
          <span className={cn(
            "grid size-5 place-items-center rounded-full border transition-[background-color,border-color,transform] duration-200",
            value === option.value ? "scale-105 border-primary bg-primary text-primary-foreground" : "border-border bg-background/70"
          )}>
            {value === option.value ? <Check className="size-3" /> : null}
          </span>
        </button>
      ))}
    </div>
  )
}

function PaymentIcon({ method, active }: { method: PaymentMethod; active: boolean }) {
  if (method === "alipay") {
    return (
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm",
          active && "ring-2 ring-primary/20"
        )}
        aria-hidden
      >
        Ali
      </span>
    )
  }

  return (
    <span
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground shadow-sm",
        active && "ring-2 ring-accent/30"
      )}
      aria-hidden
    >
      <span className="absolute left-2 top-2 size-4 rounded-full bg-background/95" />
      <span className="absolute bottom-2 right-2 size-4 rounded-full bg-background/80" />
      <span className="relative text-[10px] font-bold text-foreground">WX</span>
    </span>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatDateLong(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00.000Z`))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return value.toLocaleString("en")
}

function formatSignedNumber(value: number) {
  if (value > 0) return `+${formatNumber(value)}`
  return formatNumber(value)
}

function getCanvasBackground() {
  if (typeof window === "undefined") return "#ffffff"
  const value = getComputedStyle(document.documentElement).getPropertyValue("--background").trim()
  return value || "#ffffff"
}

function getThemeColor(tokenName: string | undefined, fallback = "oklch(0.56 0.19 267)") {
  if (!tokenName || typeof window === "undefined") return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim()
  return value || fallback
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
