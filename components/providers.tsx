"use client"

import { AppToastProvider } from "@/components/ui/app-toast"
import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <AppToastProvider />
    </ThemeProvider>
  )
}
