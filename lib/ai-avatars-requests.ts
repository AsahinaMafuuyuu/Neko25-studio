import type { AvatarStyle } from "@/lib/avatar-types"
import {
  findGeneratedImage,
  getImageMakerApiErrorMessage,
  getImageMakerRateLimitErrorMessage,
  isImageMakerQuotaError,
  isImageMakerRateLimitError,
  requestImageEdit,
  requestImageGeneration,
  type GeneratedImage,
  type ImageMakerConfig,
  type ImageMakerSourceImage,
} from "@/lib/image-maker"
import { buildAiAvatarImagePrompt } from "@/prompts/ai-avatars.prompt"

export type AvatarImageVariant = "desktop" | "mobile"

export type AvatarImageVariantConfig = {
  aspectRatio: "16:9" | "9:16"
  filename: string
  label: string
  size: string
  variant: AvatarImageVariant
}

export const aiAvatarImageVariants: AvatarImageVariantConfig[] = [
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

export async function requestAiAvatarImageVariant(input: {
  config: ImageMakerConfig
  prompt: string
  sourceImageUrl: string
  style: AvatarStyle
  variant: AvatarImageVariantConfig
}): Promise<GeneratedImage> {
  const requestPrompt = buildAiAvatarImagePrompt({
    hasSourceImage: Boolean(input.sourceImageUrl),
    prompt: input.prompt,
    style: input.style,
    variant: input.variant,
  })
  const response = input.sourceImageUrl
    ? await postImageMakerEdit(input.config, requestPrompt, { url: input.sourceImageUrl }, input.variant.size)
    : await postImageMakerGeneration(input.config, requestPrompt, input.variant.size)

  if (!response.ok) {
    const message = getImageMakerApiErrorMessage(response)
    if (isImageMakerRateLimitError(response) || isImageMakerQuotaError(response)) {
      throw new UserRecoverableGenerationError(getImageMakerRateLimitErrorMessage(input.config.model, message), false)
    }

    throw new Error(`Image maker generation failed for ${input.config.model} (${input.variant.aspectRatio}). ${message}`)
  }

  const image = await findGeneratedImage(response.body)
  if (!image?.base64) {
    throw new Error(`Image maker model ${input.config.model} did not return a ${input.variant.aspectRatio} image.`)
  }

  return {
    base64: image.base64,
    mimeType: image.mimeType || "image/png",
  }
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

export class UserRecoverableGenerationError extends Error {
  retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = "UserRecoverableGenerationError"
    this.retryable = retryable
  }
}
