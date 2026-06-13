import type { AiVideoAvatarVideo } from "@/lib/video-avatar-types"

export function buildAiVideoAvatarAgnesPrompt(video: AiVideoAvatarVideo) {
  const voiceGuidance = video.voice_name
    ? `The selected voice style is ${video.voice_name}; use natural presenter gestures, subtle head movement, expressive eyes, and calm mouth movement that could match this voice later.`
    : "Use natural presenter gestures, subtle head movement, expressive eyes, and calm mouth movement for a future voiced avatar workflow."

  return [
    "Animate the person in the provided avatar image as a polished talking-head presenter video.",
    "Preserve the person's identity, outfit, face shape, and overall image composition.",
    "Keep the camera stable, the body centered, and the motion realistic rather than dramatic.",
    "Do not add subtitles, captions, logos, watermarks, UI panels, extra people, distorted faces, or text overlays.",
    `Spoken-script context for expression and pacing: ${video.script}`,
    voiceGuidance,
  ].join("\n").slice(0, 2000)
}
