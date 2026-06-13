import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["zh", "en", "ja"],
  defaultLocale: "zh",
  localePrefix: "always",
})

export type AppLocale = (typeof routing.locales)[number]

export function isAppLocale(value: string): value is AppLocale {
  return routing.locales.includes(value as AppLocale)
}
