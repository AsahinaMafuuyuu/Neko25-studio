import { createAgnesVideoTask } from "@/lib/agnes-video-provider"
import type { AiVideoAvatarVideo } from "@/lib/video-avatar-types"
import { buildAiVideoAvatarAgnesPrompt } from "@/prompts/ai-video-avatar.prompt"

export function buildAiVideoAvatarProviderTaskInput(input: {
  imageUrl: string
  video: AiVideoAvatarVideo
}) {
  return {
    imageUrl: input.imageUrl,
    prompt: buildAiVideoAvatarAgnesPrompt(input.video),
    aspectRatio: input.video.aspect_ratio,
    durationSeconds: input.video.duration_seconds,
  }
}

export async function requestAiVideoAvatarProviderTask(input: {
  imageUrl: string
  video: AiVideoAvatarVideo
}) {
  return await createAgnesVideoTask(buildAiVideoAvatarProviderTaskInput(input))
}
