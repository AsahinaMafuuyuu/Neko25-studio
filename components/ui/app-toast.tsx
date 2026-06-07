"use client"

import { toast } from "sonner"

import { Toaster } from "@/components/ui/sonner"

type AppToastOptions = {
  description?: string
}

function AppToastProvider() {
  return <Toaster richColors position="top-right" />
}

function showAppToast(message: string, options: AppToastOptions = {}) {
  toast.success(message, {
    description: options.description,
  })
}

export { AppToastProvider, showAppToast }
