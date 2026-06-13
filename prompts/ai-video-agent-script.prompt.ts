import type { ScriptTone } from "@/lib/video-avatar-types"

export type AiVideoAgentScriptPromptParams = {
  durationSeconds: number
  maxCharacters: number
  presentationFormat?: string
  structure: string
  targetChineseCharacters: string
  targetWords: string
  topic: string
}

export function buildAiVideoAgentTopicScriptMessages(params: AiVideoAgentScriptPromptParams) {
  return [
    {
      role: "system" as const,
      content: [
        "Write only a voiceover script for a video.",
        "The user's Topic is the semantic source of truth: preserve its subject, conflict, scenario, named objects, emotion, and intent.",
        "Never replace the topic with a generic productivity, business, motivation, health, or tutorial theme unless that is explicitly the topic.",
        "Use natural spoken language and match the topic language, including Chinese when the topic is Chinese.",
        "The script length must fit the selected video duration.",
        "Return only the final spoken script text. Do not include a title, markdown, labels, analysis, or stage directions.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: [
        `Topic: ${params.topic}`,
        `Total duration: ${params.durationSeconds} seconds.`,
        params.presentationFormat ? `Presentation format: ${params.presentationFormat}.` : "",
        `Target length for Chinese topics: ${params.targetChineseCharacters}.`,
        `Target length for English or space-separated topics: ${params.targetWords}.`,
        `Structure: ${params.structure}.`,
        `Hard maximum: ${params.maxCharacters} characters.`,
        "Rules:",
        "- Treat Topic as the semantic source of truth; do not introduce a different theme.",
        "- If the Topic contains a mood, conflict, joke, claim, or specific situation, preserve it and make the script revolve around it.",
        "- Keep the same language as the Topic.",
        "Do not make the script longer than the selected duration can comfortably fit.",
      ].filter(Boolean).join("\n"),
    },
  ]
}

const toneLabels: Record<ScriptTone, string> = {
  professional: "calm, precise, credible, and businesslike",
  friendly: "warm, conversational, approachable, and easygoing",
  energetic: "high-energy, punchy, expressive, and fast-moving",
  educational: "clear, structured, explanatory, and teaching-oriented",
  promotional: "persuasive, polished, memorable, and action-oriented without inventing unrelated products or claims",
}

export function buildTalkingAvatarScriptMessages(input: {
  durationSeconds: number
  durationGuidance: string
  tone: ScriptTone
  topic: string
}) {
  return [
    {
      role: "system" as const,
      content: [
        "You write spoken scripts for talking AI avatar videos.",
        "The user's Topic is the content brief: keep its subject, intent, emotion, and scenario as the center of the script.",
        "The Tone is only the delivery style. Never replace, dilute, or redirect the Topic because of the Tone.",
        "Build a coherent spoken idea with a hook, a focused development, and a clear ending.",
        "Match the output language to the Topic language.",
        "Return only the final spoken script text. Do not include a title, markdown, labels, analysis, or stage directions.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: [
        "Create a talking-avatar spoken script from this brief.",
        "",
        `Topic / content brief: ${input.topic}`,
        `Delivery tone: ${toneLabels[input.tone]}`,
        `Target duration: ${input.durationSeconds} seconds`,
        `Length and structure guidance: ${input.durationGuidance}`,
        "",
        "Rules:",
        "- Treat Topic as the semantic source of truth; do not introduce a different theme.",
        "- If the Topic contains a mood, conflict, or specific situation, preserve it and make the script revolve around it.",
        "- Tone should affect wording, rhythm, and attitude only.",
        "- Promotional tone means more compelling and memorable, not random advertising.",
        "- Keep it natural for spoken delivery and under 2000 characters.",
      ].join("\n"),
    },
  ]
}
