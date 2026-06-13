import type { AiVideoAgentDialogue, AiVideoAgentScene, AiVideoAgentTimeline } from "@/lib/ai-video-agent"

export type AiVideoAgentAvatarScenePromptParams = {
  dialogues: AiVideoAgentDialogue[]
  presentationFormat: string
  scene: AiVideoAgentScene
  timelineScene?: AiVideoAgentTimeline["scenes"][number]
  visualStyle: string
}

export function buildAiVideoAgentAvatarScenePrompt(params: AiVideoAgentAvatarScenePromptParams) {
  return [
    "Create an avatar-led video scene using the provided avatar image as the consistent main character.",
    "The avatar must remain the central subject. Keep motion natural, expressive, and professional.",
    "Do not add subtitles, captions, watermarks, logos, or UI panels.",
    `Visual style: ${params.visualStyle}`,
    `Presentation format: ${params.presentationFormat}`,
    `Scene: ${params.scene.title}`,
    `Visual environment: ${params.timelineScene?.visual.prompt || params.scene.prompt || params.scene.summary}`,
    `Dialogue: ${params.dialogues.map((dialogue) => dialogue.text).join(" ") || params.scene.narration}`,
  ].join("\n").slice(0, 2000)
}
