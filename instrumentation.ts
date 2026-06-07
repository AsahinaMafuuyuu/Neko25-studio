import { installDep0040WarningFilter } from "./warning-filter"

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  installDep0040WarningFilter()
}
