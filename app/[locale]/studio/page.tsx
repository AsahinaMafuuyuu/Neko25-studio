import { redirect } from "@/src/i18n/navigation"

export default async function StudioRedirectPage({
  params,
}: PageProps<"/[locale]/studio">) {
  const { locale } = await params
  redirect({ href: "/dashboard", locale })
}
