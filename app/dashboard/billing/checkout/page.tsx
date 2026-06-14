import { redirect } from "next/navigation"

type CheckoutSearchParams = Promise<Record<string, string | string[] | undefined>>

function getString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function BillingCheckoutRedirect({
  searchParams,
}: {
  searchParams: CheckoutSearchParams
}) {
  const params = await searchParams
  const query = new URLSearchParams()

  for (const key of ["credits", "price", "method"]) {
    const value = getString(params[key])
    if (value) query.set(key, value)
  }

  redirect(`/zh/dashboard/billing/checkout${query.size ? `?${query.toString()}` : ""}`)
}
