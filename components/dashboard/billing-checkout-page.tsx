"use client"

import { AlertCircle, Check, CreditCard, ShieldCheck, WalletCards, type LucideIcon } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Link } from "@/src/i18n/navigation"

type PaymentMethod = "alipay" | "wechat"

export function BillingCheckoutPage({
  credits,
  price,
  method,
}: {
  credits: number
  price: string
  method: PaymentMethod
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(method)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="rounded-lg border border-border/70 bg-card/95 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <Badge variant="outline" className="h-7 gap-2 rounded-md px-3 text-primary">
          <CreditCard className="size-3.5" />
          Checkout Preview
        </Badge>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Buy Credits</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          This page confirms the selected package and payment preference. Real Alipay and WeChat payment integration is pending.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
          <CardDescription>No payment will be collected and no credits will be added yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile icon={WalletCards} label="Credits" value={credits.toLocaleString("en")} />
            <SummaryTile icon={ShieldCheck} label="Package price" value={price} />
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Payment integration pending</p>
                <p className="mt-1 leading-6">
                  The selected method is saved only for this checkout preview. Backend payment setup and automatic recharge will be connected later.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Payment method</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <PaymentButton
                active={paymentMethod === "alipay"}
                label="Alipay"
                description="Default payment preference."
                onClick={() => setPaymentMethod("alipay")}
              />
              <PaymentButton
                active={paymentMethod === "wechat"}
                label="WeChat Pay"
                description="Prepared for future setup."
                onClick={() => setPaymentMethod("wechat")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button disabled className="sm:min-w-40">
              <CreditCard />
              Pay Now
            </Button>
            <Button nativeButton={false} variant="outline" render={<Link href="/dashboard/billing" />}>
              Back to Billing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-md bg-background text-primary shadow-sm">
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  )
}

function PaymentButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start justify-between rounded-lg border p-4 text-left transition-colors",
        active ? "border-primary bg-primary/10" : "border-border/70 bg-muted/20 hover:bg-muted/40"
      )}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <span className={cn("grid size-5 place-items-center rounded-full border", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
        {active ? <Check className="size-3" /> : null}
      </span>
    </button>
  )
}
