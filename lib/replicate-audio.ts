type ReplicatePrediction = {
  id?: string
  status?: string
  output?: unknown
  error?: unknown
  urls?: {
    get?: string
  }
}

export async function runReplicatePrediction({
  input,
  model,
  timeoutMs = Number(process.env.REPLICATE_POLL_TIMEOUT_MS || 600000),
}: {
  input: Record<string, unknown>
  model: string
  timeoutMs?: number
}) {
  const token = process.env.REPLICATE_API_TOKEN?.trim()
  if (!token) throw new Error("REPLICATE_API_TOKEN is not configured.")

  const { owner, name, version } = parseReplicateModel(model)
  const url = version
    ? "https://api.replicate.com/v1/predictions"
    : `https://api.replicate.com/v1/models/${owner}/${name}/predictions`
  const body = version ? { version, input } : { input }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify(body),
  })

  const prediction = (await response.json().catch(() => ({}))) as ReplicatePrediction & { detail?: string }
  if (!response.ok) {
    throw new Error(prediction.detail || `Replicate request failed (${response.status}).`)
  }

  return waitForReplicatePrediction(prediction, token, timeoutMs)
}

export function findReplicateOutputUrl(value: unknown): string {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value
  if (value && typeof value === "object" && "url" in value && typeof value.url === "function") {
    const url = value.url()
    return typeof url === "string" ? url : ""
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findReplicateOutputUrl(entry)
      if (found) return found
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of ["url", "audio", "output", "file"]) {
      const found = findReplicateOutputUrl(record[key])
      if (found) return found
    }
  }

  return ""
}

function parseReplicateModel(model: string) {
  const [modelName, version] = model.trim().split(":")
  const [owner, name] = modelName.split("/")
  if (!owner || !name) throw new Error("Replicate model must be formatted as owner/model or owner/model:version.")

  return { owner, name, version }
}

async function waitForReplicatePrediction(prediction: ReplicatePrediction, token: string, timeoutMs: number) {
  const started = Date.now()
  let current = prediction

  while (current.status !== "succeeded") {
    if (current.status === "failed" || current.status === "canceled") {
      throw new Error(getErrorMessage(current.error) || "Replicate prediction failed.")
    }

    if (!current.urls?.get) {
      throw new Error("Replicate did not return a prediction status URL.")
    }

    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for Replicate prediction.")
    }

    await sleep(2000)
    const response = await fetch(current.urls.get, {
      headers: {
        Authorization: `Token ${token}`,
      },
    })
    current = (await response.json().catch(() => ({}))) as ReplicatePrediction
  }

  return current
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    return String(record.message || record.error || "Unknown Replicate error.")
  }

  return "Unknown Replicate error."
}
