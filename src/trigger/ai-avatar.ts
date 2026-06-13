import { task } from "@trigger.dev/sdk/v3"

import { updateAvatarJob } from "../../lib/avatar-server"
import type { AvatarStyle, GeneratedAvatarPreview } from "../../lib/avatar-types"
import {
  findGeneratedImage,
  getImageMakerApiErrorMessage,
  getImageMakerConfig,
  getImageMakerRateLimitErrorMessage,
  isImageMakerQuotaError,
  isImageMakerRateLimitError,
  requestImageEdit,
  requestImageGeneration,
  stripDataUrlPrefix,
  type GeneratedImage,
  type ImageMakerConfig,
  type ImageMakerSourceImage,
} from "../../lib/image-maker"

type GenerateAiAvatarPayload = {
  jobId: string
  userId: string
  avatarName?: string
  style: AvatarStyle
  prompt?: string
  sourceImageUrl?: string
  sourceImageKey?: string
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

      const sourceImageUrl = payload.sourceImageUrl?.trim() || ""
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
        sourceImageUrl,
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

async function generateWithImageMaker({
  config,
  prompt,
  sourceImageUrl,
  style,
}: {
  config: ImageMakerConfig
  prompt: string
  sourceImageUrl: string
  style: AvatarStyle
}): Promise<GeneratedAvatarImages> {
  const generated = {} as GeneratedAvatarImages

  for (const variant of imageVariants) {
    generated[variant.variant] = await generateImageVariant({
      config,
      prompt,
      sourceImageUrl,
      style,
      variant,
    })
  }

  return generated
}

async function generateImageVariant({
  config,
  prompt,
  sourceImageUrl,
  style,
  variant,
}: {
  config: ImageMakerConfig
  prompt: string
  sourceImageUrl: string
  style: AvatarStyle
  variant: AvatarImageVariantConfig
}) {
  const requestPrompt = buildImagePrompt(style, prompt, Boolean(sourceImageUrl), variant)
  const response = sourceImageUrl
    ? await postImageMakerEdit(config, requestPrompt, { url: sourceImageUrl }, variant.size)
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
    hasSourceImage ? "Use the uploaded image as the primary source image. Preserve the subject identity, pose, framing, and overall composition unless the personalization prompt explicitly asks for a change." : "",
    prompt ? `Personalization prompt: ${prompt}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

async function postImageMakerGeneration(config: ImageMakerConfig, prompt: string, size: string) {
  console.info(`Requesting image maker model: ${config.model}`)
  return await requestImageGeneration({ config, prompt, size })
}

async function postImageMakerEdit(
  config: ImageMakerConfig,
  prompt: string,
  sourceImage: ImageMakerSourceImage,
  size: string
) {
  console.info(`Requesting image maker edit model: ${config.model}`)
  return await requestImageEdit({ config, prompt, size, sourceImage })
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
