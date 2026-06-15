"use client"

import { Moon, Sun } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

const subscribe = () => () => {}
const getMountedSnapshot = () => true
const getServerMountedSnapshot = () => false

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribe,
    getMountedSnapshot,
    getServerMountedSnapshot
  )
  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-md bg-card/80 backdrop-blur-xl"
    >
      {mounted ? (
        isDark ? (
          <Sun />
        ) : (
          <Moon />
        )
      ) : (
        <span className="size-4" aria-hidden="true" />
      )}
    </Button>
  )
}
