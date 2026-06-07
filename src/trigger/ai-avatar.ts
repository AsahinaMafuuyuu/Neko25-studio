import { task } from "@trigger.dev/sdk/v3"
import https from "node:https"
import { HttpsProxyAgent } from "https-proxy-agent"

import { updateAvatarJob } from "../../lib/avatar-server"
import type { AvatarStyle, GeneratedAvatarPreview } from "../../lib/avatar-types"

type GenerateAiAvatarPayload = {
  jobId: string
  userId: string
  avatarName?: string
  style: AvatarStyle
  prompt?: string
  sourceImage?: ImageInlineData
  sourceImageUrl?: string
  sourceImageKey?: string
}

type ImageInlineData = {
  mimeType?: string
  data?: string
}

type ImageMakerConfig = {
  apiUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

type GeneratedImage = {
  base64: string
  mimeType: string
}

type AvatarImageVariant = "desktop" | "mobile"

type AvatarImageVariantConfig = {
  aspectRatio: "16:9" | "9:16"
  filename: string
  label: string
  size: string
  variant: AvatarImageVariant
}

type GeneratedAvatarImages = Record<AvatarImageVariant, GeneratedImage>

type HttpJsonResponse = {
  body: Record<string, unknown>
  ok: boolean
  status: number
  statusText: string
}

const defaultImageMakerTimeoutMs = 120000

const imageVariants: AvatarImageVariantConfig[] = [
  {
    aspectRatio: "16:9",
    filename: "generated-avatar-16x9.png",
    label: "landscape desktop",
    size: process.env.IMAGE_MAKER_DESKTOP_SIZE?.trim() || "1024x576",
    variant: "desktop",
  },
  {
    aspectRatio: "9:16",
    filename: "generated-avatar-9x16.png",
    label: "portrait mobile",
    size: process.env.IMAGE_MAKER_MOBILE_SIZE?.trim() || "576x1024",
    variant: "mobile",
  },
]

const stylePrompts: Record<AvatarStyle, string> = {
  Podcast:
    "Create a polished podcast host avatar with studio lighting, confident expression, clean microphone-ready styling, and a professional media personality feel.",
  Casual:
    "Create a friendly casual avatar with natural lighting, relaxed everyday styling, approachable expression, and a clean modern profile-photo look.",
  "3D Cartoon":
    "Create a high-quality 3D cartoon avatar with soft lighting, expressive features, rounded forms, and a premium animated character style.",
  Stylized:
    "Create a stylized editorial avatar with artistic lighting, distinctive color treatment, and a memorable modern portrait identity.",
}

export const generateAiAvatar = task({
  id: "generate-ai-avatar",
  maxDuration: 900,
  catchError: ({ error }) => {
    if (error instanceof UserRecoverableGenerationError || isNonRetryableInfrastructureError(error)) {
      return { skipRetrying: true }
    }
  },
  run: async (payload: GenerateAiAvatarPayload) => {
    try {
      await updateAvatarJob(payload.jobId, {
        status: "running",
        progress: 20,
        message: "Preparing your avatar brief.",
        error: "",
      })

      const sourceImage = payload.sourceImage?.data
        ? payload.sourceImage
        : payload.sourceImageUrl
          ? await fetchSourceImage(payload.sourceImageUrl)
          : null
      const imageMakerConfig = getImageMakerConfig()

      await updateAvatarJob(payload.jobId, {
        status: "generating",
        progress: 45,
        message: `Image maker (${imageMakerConfig.model}) is creating the avatar.`,
      })

      const generated = await generateWithImageMaker({
        config: imageMakerConfig,
        style: payload.style,
        prompt: payload.prompt || "",
        sourceImage,
      })

      const preview = buildGeneratedAvatarPreview(generated)

      await updateAvatarJob(payload.jobId, {
        avatar_id: null,
        status: "completed",
        progress: 100,
        message: "Avatar preview ready. Upload it when you are happy with the result.",
        error: "",
      })

      return {
        preview,
      }
    } catch (error) {
      const errorMessage = getGenerationErrorMessage(error)
      await updateAvatarJob(payload.jobId, {
        status: "failed",
        progress: 100,
        message: "Avatar generation failed.",
        error: errorMessage,
      }).catch(() => undefined)

      throw error
    }
  },
})

async function fetchSourceImage(url: string): Promise<ImageInlineData> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not read source image (${response.status}).`)
  }

  const contentType = response.headers.get("content-type") || "image/png"
  const buffer = Buffer.from(await response.arrayBuffer())

  return {
    mimeType: contentType,
    data: buffer.toString("base64"),
  }
}

async function generateWithImageMaker({
  config,
  prompt,
  sourceImage,
  style,
}: {
  config: ImageMakerConfig
  prompt: string
  sourceImage: ImageInlineData | null
  style: AvatarStyle
}): Promise<GeneratedAvatarImages> {
  const generated = {} as GeneratedAvatarImages

  for (const variant of imageVariants) {
    generated[variant.variant] = await generateImageVariant({
      config,
      prompt,
      sourceImage,
      style,
      variant,
    })
  }

  return generated
}

async function generateImageVariant({
  config,
  prompt,
  sourceImage,
  style,
  variant,
}: {
  config: ImageMakerConfig
  prompt: string
  sourceImage: ImageInlineData | null
  style: AvatarStyle
  variant: AvatarImageVariantConfig
}) {
  const requestPrompt = buildImagePrompt(style, prompt, Boolean(sourceImage?.data), variant)
  const response = sourceImage?.data
    ? await postImageMakerEdit(config, requestPrompt, sourceImage, variant.size)
    : await postImageMakerGeneration(config, requestPrompt, variant.size)

  if (!response.ok) {
    const message = getImageMakerApiErrorMessage(response)
    if (isImageMakerRateLimitError(response) || isImageMakerQuotaError(response)) {
      throw new UserRecoverableGenerationError(getImageMakerRateLimitErrorMessage(config.model, message), false)
    }

    throw new Error(`Image maker generation failed for ${config.model} (${variant.aspectRatio}). ${message}`)
  }

  const image = await findGeneratedImage(response.body)
  if (!image?.base64) {
    throw new Error(`Image maker model ${config.model} did not return a ${variant.aspectRatio} image.`)
  }

  return {
    base64: image.base64,
    mimeType: image.mimeType || "image/png",
  }
}

function buildImagePrompt(
  style: AvatarStyle,
  prompt: string,
  hasSourceImage: boolean,
  variant: AvatarImageVariantConfig
) {
  return [
    stylePrompts[style],
    `Return exactly one ${variant.label} avatar image with a ${variant.aspectRatio} aspect ratio.`,
    `Compose the full frame for ${variant.aspectRatio}; do not crop or letterbox a square image.`,
    "Keep the face clearly visible with enough headroom and shoulder detail for avatar previews.",
    hasSourceImage ? "Use the provided reference image as identity and composition guidance." : "",
    prompt ? `Personalization prompt: ${prompt}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

async function postImageMakerGeneration(config: ImageMakerConfig, prompt: string, size: string) {
  const url = getImageMakerEndpoint(config.apiUrl, "generations")
  console.info(`Requesting image maker model: ${config.model}`)

  return await postJson(url, {
    model: config.model,
    prompt,
    n: 1,
    size,
  }, config.timeoutMs, config.apiKey)
}

async function postImageMakerEdit(
  config: ImageMakerConfig,
  prompt: string,
  sourceImage: ImageInlineData,
  size: string
) {
  const url = getImageMakerEndpoint(config.apiUrl, "edits")
  const blob = base64ToBlob(sourceImage.data || "", sourceImage.mimeType || "image/png")
  const form = new FormData()
  form.append("model", config.model)
  form.append("prompt", prompt)
  form.append("n", "1")
  form.append("size", size)
  form.append("image", blob, `source.${getImageExtension(blob.type)}`)

  console.info(`Requesting image maker edit model: ${config.model}`)
  return await postFormData(url, form, config.timeoutMs, config.apiKey)
}

function buildGeneratedAvatarPreview(generated: GeneratedAvatarImages): GeneratedAvatarPreview {
  return {
    desktop: {
      dataUrl: toDataUrl(generated.desktop),
      filename: imageVariants[0].filename,
      mimeType: generated.desktop.mimeType,
    },
    mobile: {
      dataUrl: toDataUrl(generated.mobile),
      filename: imageVariants[1].filename,
      mimeType: generated.mobile.mimeType,
    },
  }
}

function toDataUrl(image: GeneratedImage) {
  return `data:${image.mimeType};base64,${stripDataUrlPrefix(image.base64)}`
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

async function postJsonViaFetch(url: string, payload: Record<string, unknown>, timeoutMs: number, apiKey?: string): Promise<HttpJsonResponse> {
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
): Promise<HttpJsonResponse> {
  const target = new URL(url)
  const requestBody = JSON.stringify(payload)
  const headers: Record<string, string | number> = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(requestBody),
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return new Promise<HttpJsonResponse>((resolve, reject) => {
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

function getImageMakerConfig(): ImageMakerConfig {
  const apiUrl = process.env.IMAGE_MAKER_API_URL?.trim()
  const apiKey = process.env.IMAGE_MAKER_API_KEY?.trim()
  const model = process.env.IMAGE_MAKER_MODEL?.trim()
  const timeoutMs = Number(process.env.IMAGE_MAKER_TIMEOUT_MS || defaultImageMakerTimeoutMs)

  if (!apiUrl) {
    throw new Error("IMAGE_MAKER_API_URL is not configured. Set it in .env before generating avatars.")
  }

  if (!apiKey) {
    throw new Error("IMAGE_MAKER_API_KEY is not configured. Set it in .env before generating avatars.")
  }

  if (!model) {
    throw new Error("IMAGE_MAKER_MODEL is not configured. Set it in .env before generating avatars.")
  }

  return {
    apiUrl,
    apiKey,
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : defaultImageMakerTimeoutMs,
  }
}

function getImageMakerEndpoint(apiUrl: string, operation: "generations" | "edits") {
  const baseUrl = apiUrl.replace(/\/+$/, "")

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

function getImageMakerHeaders(apiKey?: string) {
  const headers = new Headers()

  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`)
  }

  return headers
}

function getImageMakerNetworkErrorMessage(error: unknown, proxyUrl: string) {
  const detail = getErrorDetail(error)
  const proxyHint = proxyUrl ? ` The configured proxy was ${maskProxyUrl(proxyUrl)}.` : ""
  return `Could not reach the image maker API.${proxyHint} Set IMAGE_MAKER_API_URL to the third-party image endpoint and check network connectivity. ${detail}`
}

function getImageMakerApiErrorMessage(response: HttpJsonResponse) {
  if (typeof response.body.error === "object" && response.body.error) {
    const error = response.body.error as Record<string, unknown>
    return String(error.message || `Image maker generation failed (${response.status} ${response.statusText}).`)
  }

  if (typeof response.body.message === "string") {
    return response.body.message
  }

  return `Image maker generation failed (${response.status} ${response.statusText}).`
}

function isImageMakerQuotaError(response: HttpJsonResponse) {
  const message = getImageMakerApiErrorMessage(response).toLowerCase()
  return message.includes("quota") || message.includes("resource_exhausted")
}

function isImageMakerRateLimitError(response: HttpJsonResponse) {
  return response.status === 429
}

function getImageMakerRateLimitErrorMessage(model: string, message: string) {
  const sanitizedMessage = sanitizeProviderQuotaMessage(message)

  return [
    `Image maker is rate-limiting the configured model ${model} (429 TooManyRequests).`,
    "Wait for the provider quota window to reset before generating again, or switch IMAGE_MAKER_API_KEY / IMAGE_MAKER_MODEL to a provider route with image-generation quota.",
    sanitizedMessage ? `Provider detail: ${sanitizedMessage}` : "",
  ]
    .filter(Boolean)
    .join(" ")
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

async function findGeneratedImage(body: Record<string, unknown>): Promise<GeneratedImage | null> {
  const data = Array.isArray(body.data) ? body.data : []

  for (const item of data) {
    if (!item || typeof item !== "object") continue

    const record = item as Record<string, unknown>
    const base64 = record.b64_json || record.b64Json || record.base64 || record.image
    if (typeof base64 === "string" && base64.trim()) {
      return {
        base64: stripDataUrlPrefix(base64),
        mimeType: getMimeTypeFromDataUrl(base64) || "image/png",
      }
    }

    if (typeof record.url === "string" && record.url.trim()) {
      return await fetchGeneratedImage(record.url)
    }
  }

  const topLevelBase64 = body.b64_json || body.b64Json || body.base64 || body.image
  if (typeof topLevelBase64 === "string" && topLevelBase64.trim()) {
    return {
      base64: stripDataUrlPrefix(topLevelBase64),
      mimeType: getMimeTypeFromDataUrl(topLevelBase64) || "image/png",
    }
  }

  if (typeof body.url === "string" && body.url.trim()) {
    return await fetchGeneratedImage(body.url)
  }

  return null
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

function stripDataUrlPrefix(value: string) {
  return value.replace(/^data:[^;]+;base64,/i, "")
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

function getGenerationErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "Unknown generation error."
}

function isNonRetryableInfrastructureError(error: unknown) {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return message.includes("schema cache") || message.includes("could not find the") && message.includes("column")
}

class UserRecoverableGenerationError extends Error {
  retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = "UserRecoverableGenerationError"
    this.retryable = retryable
  }
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
