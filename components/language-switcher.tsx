"use client"

import { Globe2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { usePathname, useRouter } from "@/src/i18n/navigation"
import { routing, type AppLocale } from "@/src/i18n/routing"

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("LanguageSwitcher")

  function onLocaleChange(nextLocale: AppLocale) {
    if (nextLocale === locale) return

    const query = Object.fromEntries(searchParams.entries())
    if (query.next) {
      query.next = localizePathname(query.next, nextLocale)
    }

    router.replace({ pathname, query }, { locale: nextLocale })
  }

  return (
    <div className="relative flex items-center gap-1">
      <Globe2 className="pointer-events-none absolute left-2.5 z-10 size-4 text-muted-foreground" />
      <NativeSelect
        aria-label={t("label")}
        className="min-w-28 [&_[data-slot=native-select]]:pl-8"
        size="sm"
        value={locale}
        onChange={(event) => onLocaleChange(event.target.value as AppLocale)}
      >
        {routing.locales.map((item) => (
          <NativeSelectOption key={item} value={item}>
            {t(`locales.${item}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

function localizePathname(pathname: string, nextLocale: AppLocale) {
  const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`)
  return pathname.startsWith("/")
    ? pathname.replace(localePattern, `/${nextLocale}`)
    : pathname
}
