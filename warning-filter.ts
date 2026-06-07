type WarningEmitter = (...args: unknown[]) => void

type ProcessWithWarningFilter = NodeJS.Process & {
  __kravixDep0040WarningFilter?: true
  emitWarning: WarningEmitter
}

export function installDep0040WarningFilter() {
  const target = process as ProcessWithWarningFilter
  if (target.__kravixDep0040WarningFilter) return

  const originalEmitWarning = target.emitWarning.bind(process)
  target.emitWarning = (...args: unknown[]) => {
    if (getWarningCode(args) === "DEP0040") return
    originalEmitWarning(...args)
  }

  target.__kravixDep0040WarningFilter = true
}

function getWarningCode(args: unknown[]) {
  const [warning, typeOrOptions, code] = args

  if (typeof code === "string") return code

  if (typeOrOptions && typeof typeOrOptions === "object" && "code" in typeOrOptions) {
    const optionCode = typeOrOptions.code
    if (typeof optionCode === "string") return optionCode
  }

  if (warning instanceof Error && "code" in warning) {
    const warningCode = warning.code
    if (typeof warningCode === "string") return warningCode
  }

  return ""
}
