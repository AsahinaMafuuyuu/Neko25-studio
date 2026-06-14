"use client"

import { toast } from "sonner"

import { Toaster } from "@/components/ui/sonner"

type AppToastOptions = {
  description?: string
  variant?: "success" | "error" | "info" | "warning"
}

function AppToastProvider() {
  return <Toaster richColors position="top-right" />
}

function showAppToast(message: string, options: AppToastOptions = {}) {
  const variant = options.variant || "success"
  const toastOptions = {
    description: options.description,
  }

  if (variant === "error") {
    toast.error(message, toastOptions)
    return
  }

  if (variant === "info") {
    toast.info(message, toastOptions)
    return
  }

  if (variant === "warning") {
    toast.warning(message, toastOptions)
    return
  }

  toast.success(message, toastOptions)
}

export { AppToastProvider, showAppToast }
