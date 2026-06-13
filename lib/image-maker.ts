import https from "node:https"
import { HttpsProxyAgent } from "https-proxy-agent"

export type ImageMakerOperation = "generations" | "edits"

export type ImageMakerConfig = {
  apiKey: string
  apiUrl: string
  model: string
  provider: "agnes" | "openai-compatible"
  timeoutMs: number
}

export type ImageMakerSourceImage = {
  url?: string
  data?: string
  mimeType?: string
}

export type GeneratedImage = {
  base64: string
  mimeType: string
}

export type ImageMakerResponse = {
  body: Record<string, unknown>
  ok: boolean
  status: number
  statusText: string
}

const defaultImageMakerTimeoutMs = 120000

export function getImageMakerConfig(): ImageMakerConfig {
  const apiUrl = process.env.IMAGE_MAKER_API_URL?.trim()
  const apiKey = process.env.IMAGE_MAKER_API_KEY?.trim()
  const model = process.env.IMAGE_MAKER_MODEL?.trim()
  const timeoutMs = Number(process.env.IMAGE_MAKER_TIMEOUT_MS || defaultImageMakerTimeoutMs)

  if (!apiUrl) {
    throw new Error("IMAGE_MAKER_API_URL is not configured. Set it in .env before generating images.")
  }

  if (!apiKey) {
    throw new Error("IMAGE_MAKER_API_KEY is not configured. Set it in .env before generating images.")
  }

  if (!model) {
    throw new Error("IMAGE_MAKER_MODEL is not configured. Set it in .env before generating images.")
  }

  return {
    apiKey,
    apiUrl,
    model,
    provider: getImageMakerProvider(apiUrl, model),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : defaultImageMakerTimeoutMs,
  }
}

export async function requestImageGeneration(input: {
  config: ImageMakerConfig
  prompt: string
  size: string
}) {
  const { config } = input
  const url = getImageMakerEndpoint(config, "generations")

  return await postJson(url, buildGenerationPayload(config, input.prompt, input.size), config.timeoutMs, config.apiKey)
}

export async function requestImageEdit(input: {
  config: ImageMakerConfig
  prompt: string
  size: string
  sourceImage: ImageMakerSourceImage
}) {
  const { config } = input

  if (config.provider === "agnes") {
    const url = getImageMakerEndpoint(config, "generations")
    const sourceImageReference = getAgnesSourceImageReference(input.sourceImage)
    if (!sourceImageReference) {
      throw new Error("Source image is required for Agnes image editing.")
    }

    return await postJson(url, {
      ...buildGenerationPayload(config, input.prompt, input.size),
      image: [sourceImageReference],
      extra_body: {
        image: [sourceImageReference],
        response_format: "b64_json",
      },
    }, config.timeoutMs, config.apiKey)
  }

  const url = getImageMakerEndpoint(config, "edits")
  const sourceBlob = await loadSourceImageBlob(input.sourceImage)
  const form = new FormData()
  form.append("model", config.model)
  form.append("prompt", input.prompt)
  form.append("n", "1")
  form.append("size", input.size)
  form.append("image", sourceBlob, `source.${getImageExtension(sourceBlob.type)}`)

  return await postFormData(url, form, config.timeoutMs, config.apiKey)
}

function getAgnesSourceImageReference(sourceImage: ImageMakerSourceImage) {
  const data = sourceImage.data?.trim()
  if (data) {
    if (/^data:/i.test(data)) return data

    const mimeType = sourceImage.mimeType?.trim() || "image/png"
    return `data:${mimeType};base64,${stripDataUrlPrefix(data)}`
  }

  return sourceImage.url?.trim() || ""
}

export async function findGeneratedImage(body: Record<string, unknown>): Promise<GeneratedImage | null> {
  const direct = await findGeneratedImageInRecord(body)
  if (direct) return direct

  const data = Array.isArray(body.data) ? body.data : []
  for (const item of data) {
    if (!item || typeof item !== "object") continue
    const found = await findGeneratedImageInRecord(item as Record<string, unknown>)
    if (found) return found
  }

  const output = Array.isArray(body.output) ? body.output : []
  for (const item of output) {
    if (typeof item === "string" && item.trim()) return await imageFromString(item)
    if (item && typeof item === "object") {
      const found = await findGeneratedImageInRecord(item as Record<string, unknown>)
      if (found) return found
    }
  }

  return null
}

export function getImageMakerApiErrorMessage(response: ImageMakerResponse) {
  if (typeof response.body.error === "object" && response.body.error) {
    const error = response.body.error as Record<string, unknown>
    return String(error.message || error.detail || `Image maker generation failed (${response.status} ${response.statusText}).`)
  }

  for (const key of ["message", "detail", "error"]) {
    const value = response.body[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return `Image maker generation failed (${response.status} ${response.statusText}).`
}

export function isImageMakerQuotaError(response: ImageMakerResponse) {
  const message = getImageMakerApiErrorMessage(response).toLowerCase()
  return message.includes("quota") || message.includes("resource_exhausted")
}

export function isImageMakerRateLimitError(response: ImageMakerResponse) {
  return response.status === 429
}

export function getImageMakerRateLimitErrorMessage(model: string, message: string) {
  const sanitizedMessage = sanitizeProviderQuotaMessage(message)

  return [
    `Image maker is rate-limiting the configured model ${model} (429 TooManyRequests).`,
    "Wait for the provider quota window to reset before generating again, or switch IMAGE_MAKER_API_KEY / IMAGE_MAKER_MODEL to a provider route with image-generation quota.",
    sanitizedMessage ? `Provider detail: ${sanitizedMessage}` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

export function stripDataUrlPrefix(value: string) {
  return value.replace(/^data:[^;]+;base64,/i, "")
}

function getImageMakerProvider(apiUrl: string, model: string): ImageMakerConfig["provider"] {
  const configured = process.env.IMAGE_MAKER_PROVIDER?.trim().toLowerCase()
  if (configured === "agnes" || configured === "openai-compatible") return configured
  if (/agnes/i.test(apiUrl) || /^agnes-image-/i.test(model)) return "agnes"
  return "openai-compatible"
}

function buildGenerationPayload(config: ImageMakerConfig, prompt: string, size: string) {
  if (config.provider === "agnes") {
    return {
      model: config.model,
      prompt,
      size,
    }
  }

  return {
    model: config.model,
    prompt,
    n: 1,
    size,
  }
}

function getImageMakerEndpoint(config: ImageMakerConfig, operation: ImageMakerOperation) {
  const baseUrl = config.apiUrl.replace(/\/+$/, "")

  if (config.provider === "agnes") {
    if (/\/v1\/images\/(generations|edits)$/i.test(baseUrl)) {
      return baseUrl.replace(/\/v1\/images\/(generations|edits)$/i, `/v1/images/${operation}`)
    }
    if (/\/v1\/images$/i.test(baseUrl)) return `${baseUrl}/${operation}`
    if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/images/${operation}`
    if (new URL(baseUrl).pathname !== "/") return baseUrl
    return `${baseUrl}/v1/images/${operation}`
  }

  if (/\/images\/(generations|edits)$/i.test(baseUrl)) {
    return baseUrl.replace(/\/images\/(generations|edits)$/i, `/images/${operation}`)
  }

  if (/\/images$/i.test(baseUrl)) {
    return `${baseUrl}/${operation}`
  }

  if (/\/v1$/i.test(baseUrl)) {
    return `${baseUrl}/images/${operation}`
  }

  return `${baseUrl}/v1/images/${operation}`
}

async function postJson(url: string, payload: Record<string, unknown>, timeoutMs: number, apiKey?: string) {
  const proxyUrl = getProxyUrl(url)

  try {
    if (proxyUrl) {
      return await postJsonViaHttps(url, payload, timeoutMs, proxyUrl, apiKey)
    }

    return await postJsonViaFetch(url, payload, timeoutMs, apiKey)
  } catch (error) {
    throw new Error(getImageMakerNetworkErrorMessage(error, proxyUrl), { cause: error })
  }
}

async function postFormData(url: string, form: FormData, timeoutMs: number, apiKey: string) {
  const proxyUrl = getProxyUrl(url)
  if (proxyUrl) {
    throw new Error("Image maker edit requests with file uploads do not support HTTPS_PROXY in this app yet.")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getImageMakerHeaders(apiKey),
      body: form,
      signal: controller.signal,
    })

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return {
      body,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function postJsonViaFetch(url: string, payload: Record<string, unknown>, timeoutMs: number, apiKey?: string): Promise<ImageMakerResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const headers = getImageMakerHeaders(apiKey)
  headers.set("Content-Type", "application/json")

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return {
      body,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function postJsonViaHttps(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  proxyUrl?: string,
  apiKey?: string
): Promise<ImageMakerResponse> {
  const target = new URL(url)
  const requestBody = JSON.stringify(payload)
  const headers: Record<string, string | number> = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(requestBody),
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return new Promise<ImageMakerResponse>((resolve, reject) => {
    const request = https.request(
      {
        agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
        headers,
        hostname: target.hostname,
        method: "POST",
        path: `${target.pathname}${target.search}`,
        port: target.port || 443,
        protocol: target.protocol,
        timeout: timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = []

        response.on("data", (chunk) => chunks.push(chunk))
        response.once("end", () => {
          try {
            const text = Buffer.concat(chunks).toString("utf8")
            const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>
            resolve({
              body,
              ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
              status: response.statusCode || 0,
              statusText: response.statusMessage || "",
            })
          } catch (error) {
            reject(error)
          }
        })
      }
    )

    request.once("timeout", () => {
      request.destroy(new Error("Timed out waiting for image maker response."))
    })
    request.once("error", reject)
    request.write(requestBody)
    request.end()
  })
}

function getImageMakerHeaders(apiKey?: string) {
  const headers = new Headers()

  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`)
  }

  return headers
}

function getProxyUrl(url: string) {
  const target = new URL(url)
  if (isNoProxyHost(target.hostname)) return ""

  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    ""
  )
}

function isNoProxyHost(hostname: string) {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy
  if (!noProxy) return false

  return noProxy.split(",").some((entry) => {
    const pattern = entry.trim().toLowerCase()
    if (!pattern) return false
    if (pattern === "*") return true
    if (pattern.startsWith(".")) return hostname.toLowerCase().endsWith(pattern)
    return hostname.toLowerCase() === pattern
  })
}

function getImageMakerNetworkErrorMessage(error: unknown, proxyUrl: string) {
  const detail = getErrorDetail(error)
  const proxyHint = proxyUrl ? ` The configured proxy was ${maskProxyUrl(proxyUrl)}.` : ""
  return `Could not reach the image maker API.${proxyHint} Set IMAGE_MAKER_API_URL to the third-party image endpoint and check network connectivity. ${detail}`
}

function sanitizeProviderQuotaMessage(message: string) {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("* Quota exceeded for metric:"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

async function findGeneratedImageInRecord(record: Record<string, unknown>): Promise<GeneratedImage | null> {
  for (const key of ["b64_json", "b64Json", "base64", "image", "image_base64", "imageBase64"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return imageFromBase64(value)
  }

  for (const key of ["url", "image_url", "imageUrl", "output_url", "outputUrl"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return await imageFromString(value)
  }

  for (const key of ["result", "data"]) {
    const value = record[key]
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const found = await findGeneratedImageInRecord(value as Record<string, unknown>)
      if (found) return found
    }
  }

  return null
}

async function imageFromString(value: string): Promise<GeneratedImage> {
  if (/^https?:\/\//i.test(value)) return await fetchGeneratedImage(value)
  return imageFromBase64(value)
}

function imageFromBase64(value: string): GeneratedImage {
  return {
    base64: stripDataUrlPrefix(value),
    mimeType: getMimeTypeFromDataUrl(value) || "image/png",
  }
}

async function fetchGeneratedImage(url: string): Promise<GeneratedImage> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not download generated image (${response.status}).`)
  }

  const mimeType = response.headers.get("content-type") || "image/png"
  const buffer = Buffer.from(await response.arrayBuffer())
  return {
    base64: buffer.toString("base64"),
    mimeType,
  }
}

function base64ToBlob(base64: string, mimeType: string) {
  const bytes = Uint8Array.from(Buffer.from(stripDataUrlPrefix(base64), "base64"))
  return new Blob([bytes], { type: mimeType })
}

async function loadSourceImageBlob(sourceImage: ImageMakerSourceImage) {
  if (sourceImage.data) {
    return base64ToBlob(sourceImage.data, sourceImage.mimeType || "image/png")
  }

  if (sourceImage.url) {
    const response = await fetch(sourceImage.url)
    if (!response.ok) {
      throw new Error(`Could not download source image (${response.status}).`)
    }

    const mimeType = response.headers.get("content-type") || sourceImage.mimeType || "image/png"
    return new Blob([await response.arrayBuffer()], { type: mimeType })
  }

  throw new Error("Source image is required for image editing.")
}

function getMimeTypeFromDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,/i)
  return match?.[1] || ""
}

function getImageExtension(mimeType: string) {
  if (mimeType.includes("jpeg")) return "jpg"
  if (mimeType.includes("webp")) return "webp"
  return "png"
}

function getErrorDetail(error: unknown) {
  if (!error || typeof error !== "object") return ""

  const record = error as Record<string, unknown>
  const cause = record.cause && typeof record.cause === "object" ? (record.cause as Record<string, unknown>) : null
  const code = String(cause?.code || record.code || "")
  const message = error instanceof Error ? error.message : String(record.message || "")

  return [code, message].filter(Boolean).join(": ")
}

function maskProxyUrl(proxyUrl: string) {
  try {
    const url = new URL(proxyUrl)
    if (url.username) url.username = "***"
    if (url.password) url.password = "***"
    return url.toString()
  } catch {
    return "configured but invalid"
  }
}
