import { task } from "@trigger.dev/sdk/v3"

import {
  aiAvatarImageVariants,
  requestAiAvatarImageVariant,
  UserRecoverableGenerationError,
  type AvatarImageVariant,
} from "../../lib/ai-avatars-requests"
import { updateAvatarJob } from "../../lib/avatar-server"
import type { AvatarStyle, GeneratedAvatarPreview } from "../../lib/avatar-types"
import {
  getImageMakerConfig,
  stripDataUrlPrefix,
  type GeneratedImage,
  type ImageMakerConfig,
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

type GeneratedAvatarImages = Record<AvatarImageVariant, GeneratedImage>

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

  for (const variant of aiAvatarImageVariants) {
    generated[variant.variant] = await requestAiAvatarImageVariant({
      config,
      prompt,
      sourceImageUrl,
      style,
      variant,
    })
  }

  return generated
}

function buildGeneratedAvatarPreview(generated: GeneratedAvatarImages): GeneratedAvatarPreview {
  return {
    desktop: {
      dataUrl: toDataUrl(generated.desktop),
      filename: aiAvatarImageVariants[0].filename,
      mimeType: generated.desktop.mimeType,
    },
    mobile: {
      dataUrl: toDataUrl(generated.mobile),
      filename: aiAvatarImageVariants[1].filename,
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

