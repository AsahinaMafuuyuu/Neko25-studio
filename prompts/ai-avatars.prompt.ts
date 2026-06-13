import type { AvatarStyle } from "@/lib/avatar-types"

export type AiAvatarImagePromptVariant = {
  aspectRatio: "16:9" | "9:16"
  label: string
}

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

export function buildAiAvatarImagePrompt(input: {
  hasSourceImage: boolean
  prompt: string
  style: AvatarStyle
  variant: AiAvatarImagePromptVariant
}) {
  return [
    stylePrompts[input.style],
    `Return exactly one ${input.variant.label} avatar image with a ${input.variant.aspectRatio} aspect ratio.`,
    `Compose the full frame for ${input.variant.aspectRatio}; do not crop or letterbox a square image.`,
    "Keep the face clearly visible with enough headroom and shoulder detail for avatar previews.",
    input.hasSourceImage
      ? "Use the uploaded image as the primary source image. Preserve the subject identity, pose, framing, and overall composition unless the personalization prompt explicitly asks for a change."
      : "",
    input.prompt ? `Personalization prompt: ${input.prompt}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}
