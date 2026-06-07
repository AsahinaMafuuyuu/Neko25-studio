"use client"

import { ThemeProvider } from "next-themes"
import { AppToastProvider } from "@/components/ui/app-toast"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <AppToastProvider />
    </ThemeProvider>
  )
}
