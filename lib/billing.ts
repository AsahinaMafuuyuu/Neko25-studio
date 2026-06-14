import { getInsForgeAdmin } from "@/lib/avatar-server"
import { ensureCreditBalance } from "@/lib/voice-server"

export type BillingRange = "1d" | "7d" | "30d" | "custom"

export type BillingCategory =
  | "AI Voice Cloning"
  | "AI Avatar"
  | "AI Video Agent"
  | "AI Video Avatar"

export type BillingTrendPoint = {
  date: string
  cost: number
  previousCost: number
}

export type BillingCategoryPoint = {
  date: string
  "AI Voice Cloning": number
  "AI Avatar": number
  "AI Video Agent": number
  "AI Video Avatar": number
}

export type BillingHistoryItem = {
  id: string
  date: string
  type: string
  status: "Paid" | "success" | "pending" | "Failed"
  amount: string
  credits: number
}

export type BillingPayload = {
  creditBalance: number
  summary: {
    totalCredits: number
    spentThisMonth: number
    activePlan: string
    compareWithLastMonth: number
    nextInvoice: string
    totalCost: string
  }
  analytics: {
    peakUsage: {
      date: string
      credits: number
    }
    averageDaily: {
      credits: number
      label: string
    }
  }
  trend: BillingTrendPoint[]
  categoryTrend: BillingCategoryPoint[]
  categoryCosts: Array<{
    name: BillingCategory
    value: number
    fill: string
  }>
  history: BillingHistoryItem[]
}

type CreditLedgerRecord = {
  id: string
  amount: number
  balance_after: number
  entry_type: "debit" | "credit" | "refund"
  description: string
  reference_type: string
  created_at: string
}

const categoryNames = [
  "AI Voice Cloning",
  "AI Avatar",
  "AI Video Agent",
  "AI Video Avatar",
] as const

const categoryColors: Record<BillingCategory, string> = {
  "AI Voice Cloning": "var(--chart-1)",
  "AI Avatar": "var(--chart-4)",
  "AI Video Agent": "var(--chart-2)",
  "AI Video Avatar": "var(--chart-3)",
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDisplayDate(dateKey: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T00:00:00.000Z`))
}

function parseDateInput(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : startOfUtcDay(date)
}

function getRangeWindow(searchParams: URLSearchParams) {
  const range = (searchParams.get("range") || "7d") as BillingRange
  const today = startOfUtcDay(new Date())

  if (range === "custom") {
    const from = parseDateInput(searchParams.get("from"))
    const to = parseDateInput(searchParams.get("to"))

    if (from && to && from <= to) {
      return {
        range,
        start: from,
        end: addUtcDays(to, 1),
      }
    }
  }

  const days = range === "1d" ? 1 : range === "30d" ? 30 : 7
  return {
    range: range === "1d" || range === "30d" ? range : "7d",
    start: addUtcDays(today, -(days - 1)),
    end: addUtcDays(today, 1),
  }
}

function getMonthWindow(offsetMonths = 0) {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 1))
  return { start, end }
}

function getCategory(record: Pick<CreditLedgerRecord, "reference_type" | "description">): BillingCategory {
  if (record.reference_type === "ai_tts_jobs") return "AI Voice Cloning"
  if (record.reference_type === "ai_video_v2_projects" || record.reference_type === "ai_video_projects") return "AI Video Agent"
  if (record.reference_type === "ai_video_avatar_jobs") return "AI Video Avatar"
  if (record.description.toLowerCase().includes("avatar")) return "AI Avatar"
  return "AI Avatar"
}

function getHistoryType(record: CreditLedgerRecord) {
  if (record.amount > 0 && record.entry_type === "credit") return "Recharge"
  if (record.amount > 0 && record.entry_type === "refund") return "Refund"
  return getCategory(record)
}

function emptyCategoryPoint(date: string): BillingCategoryPoint {
  return {
    date,
    "AI Voice Cloning": 0,
    "AI Avatar": 0,
    "AI Video Agent": 0,
    "AI Video Avatar": 0,
  }
}

function getDayKeys(start: Date, end: Date) {
  const keys: string[] = []
  for (let cursor = new Date(start); cursor < end; cursor = addUtcDays(cursor, 1)) {
    keys.push(formatDateKey(cursor))
  }
  return keys
}

async function listCreditLedger(userId: string, start: Date, end: Date) {
  const admin = await getInsForgeAdmin()
  const { data, error } = await admin
    .database
    .from("credit_ledger")
    .select("id, amount, balance_after, entry_type, description, reference_type, created_at")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    const errorRecord = error as unknown as Record<string, unknown>
    const message =
      error && typeof error === "object"
        ? String(errorRecord.message || "Could not load billing ledger.")
        : "Could not load billing ledger."
    throw new Error(message)
  }

  return (data || []) as CreditLedgerRecord[]
}

function sumSpent(records: CreditLedgerRecord[]) {
  return records.reduce((total, record) => total + (record.amount < 0 ? Math.abs(record.amount) : 0), 0)
}

export async function getBillingBalance(userId: string) {
  return ensureCreditBalance(userId)
}

export async function getBillingPayload(userId: string, searchParams: URLSearchParams): Promise<BillingPayload> {
  const { start, end } = getRangeWindow(searchParams)
  const fetchStart = addUtcDays(start, -1)
  const currentMonth = getMonthWindow()
  const previousMonth = getMonthWindow(-1)

  const [creditBalance, ledger, monthLedger, previousMonthLedger] = await Promise.all([
    ensureCreditBalance(userId),
    listCreditLedger(userId, fetchStart, end),
    listCreditLedger(userId, currentMonth.start, currentMonth.end),
    listCreditLedger(userId, previousMonth.start, previousMonth.end),
  ])

  const selectedRecords = ledger.filter((record) => {
    const createdAt = new Date(record.created_at)
    return createdAt >= start && createdAt < end
  })

  const selectedDayKeys = getDayKeys(start, end)
  const allDayCosts = new Map<string, number>()
  const categoryByDay = new Map<string, BillingCategoryPoint>()

  for (const key of selectedDayKeys) {
    categoryByDay.set(key, emptyCategoryPoint(key))
  }

  for (const record of ledger) {
    if (record.amount >= 0) continue
    const key = formatDateKey(new Date(record.created_at))
    allDayCosts.set(key, (allDayCosts.get(key) || 0) + Math.abs(record.amount))

    if (categoryByDay.has(key)) {
      const category = getCategory(record)
      const current = categoryByDay.get(key) || emptyCategoryPoint(key)
      current[category] += Math.abs(record.amount)
      categoryByDay.set(key, current)
    }
  }

  const trend = selectedDayKeys.map((key) => {
    const previousKey = formatDateKey(addUtcDays(new Date(`${key}T00:00:00.000Z`), -1))
    return {
      date: key,
      cost: allDayCosts.get(key) || 0,
      previousCost: allDayCosts.get(previousKey) || 0,
    }
  })

  const categoryTrend = selectedDayKeys.map((key) => categoryByDay.get(key) || emptyCategoryPoint(key))
  const categoryTotals = Object.fromEntries(categoryNames.map((name) => [name, 0])) as Record<BillingCategory, number>

  for (const point of categoryTrend) {
    for (const category of categoryNames) {
      categoryTotals[category] += point[category]
    }
  }

  const peakPoint = trend.reduce(
    (peak, point) => (point.cost > peak.cost ? point : peak),
    { date: selectedDayKeys[0] || formatDateKey(start), cost: 0, previousCost: 0 }
  )
  const spentThisMonth = sumSpent(monthLedger)
  const previousSpent = sumSpent(previousMonthLedger)
  const totalSelectedCost = sumSpent(selectedRecords)
  const average = selectedDayKeys.length ? Math.round(totalSelectedCost / selectedDayKeys.length) : 0
  const nextInvoiceDate = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(currentMonth.end)

  return {
    creditBalance,
    summary: {
      totalCredits: creditBalance,
      spentThisMonth,
      activePlan: "Starter",
      compareWithLastMonth: spentThisMonth - previousSpent,
      nextInvoice: nextInvoiceDate,
      totalCost: `\uFFE5${(spentThisMonth / 100).toFixed(2)}`,
    },
    analytics: {
      peakUsage: {
        date: formatDisplayDate(peakPoint.date),
        credits: peakPoint.cost,
      },
      averageDaily: {
        credits: average,
        label: `${selectedDayKeys.length} day${selectedDayKeys.length === 1 ? "" : "s"}`,
      },
    },
    trend,
    categoryTrend,
    categoryCosts: categoryNames.map((name) => ({
      name,
      value: categoryTotals[name],
      fill: categoryColors[name],
    })),
    history: selectedRecords.slice(0, 25).map((record) => ({
      id: record.id,
      date: record.created_at,
      type: getHistoryType(record),
      status: record.amount < 0 || record.entry_type === "refund" ? "success" : "Paid",
      amount: record.amount < 0 ? `-\uFFE5${(Math.abs(record.amount) / 100).toFixed(2)}` : `\uFFE5${(record.amount / 100).toFixed(2)}`,
      credits: record.amount,
    })),
  }
}
