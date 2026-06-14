import { BillingCheckoutPage } from "@/components/dashboard/billing-checkout-page"

type CheckoutSearchParams = Promise<Record<string, string | string[] | undefined>>

function getString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getPaymentMethod(value: string | string[] | undefined) {
  return getString(value) === "wechat" ? "wechat" : "alipay"
}

export default async function BillingCheckoutRoutePage({
  searchParams,
}: {
  searchParams: CheckoutSearchParams
}) {
  const params = await searchParams
  const credits = Number(getString(params.credits) || 1000)
  const price = getString(params.price) || "\uFFE51"

  return (
    <BillingCheckoutPage
      credits={Number.isFinite(credits) && credits > 0 ? credits : 1000}
      price={price}
      method={getPaymentMethod(params.method)}
    />
  )
}
