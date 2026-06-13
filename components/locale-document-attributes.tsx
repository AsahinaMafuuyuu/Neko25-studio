"use client"

import { useLocale } from "next-intl"
import { useEffect } from "react"

export function LocaleDocumentAttributes() {
  const locale = useLocale()

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}
