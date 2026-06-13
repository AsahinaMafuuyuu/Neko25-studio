export type AiVideoAgentTimelinePromptParams = {
  aspectRatio: string
  durationSeconds: number
  sceneCount: number
  script: string
  sourceScript?: string
  structure: string
  targetChineseCharacters: string
  targetWords: string
  topic: string
  visualStyle?: string
  presentationFormat?: string
}

export function buildAiVideoAgentTimelineMessages(input: AiVideoAgentTimelinePromptParams) {
  return [
    {
      role: "system" as const,
      content: [
        "You create editable JSON timelines for avatar-led AI videos.",
        "The user's Topic is mandatory source material, not an optional inspiration.",
        "Return only a strict JSON object. Do not include markdown, comments, explanations, or prose outside JSON.",
        "The JSON object must include version, durationSeconds, aspectRatio, and scenes.",
        "version must be the number 2.",
        "Each scene must include id, index, startSeconds, endSeconds, title, visual, and dialogues.",
        "Each visual must include source and a non-empty prompt that describes the exact scene imagery.",
        "Each dialogue must include id, startSeconds, endSeconds, non-empty text, and optional emotion.",
        "The user's Topic or Source script is the semantic source of truth: preserve its subject, conflict, scenario, named objects, emotion, and intent.",
        "Never replace the topic with a generic productivity, business, motivation, health, or tutorial theme unless that is explicitly the topic.",
        "If the topic contains concrete words, objects, or quoted claims, reuse those concrete elements in the dialogue text.",
        "Use the same language as the topic or source script, including Chinese when the input is Chinese.",
        "Make the avatar's dialogue natural for voiceover and short enough for its timestamp.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: [
        "Create a structured timeline for an avatar-led AI video.",
        `Topic: ${input.topic || "Use the provided script."}`,
        input.sourceScript ? `Source script:\n${input.sourceScript}` : "",
        `Single-scene duration: ${input.durationSeconds} seconds.`,
        `Total duration: ${input.durationSeconds * input.sceneCount} seconds.`,
        `Aspect ratio: ${input.aspectRatio}.`,
        `Scene count: ${input.sceneCount}.`,
        input.visualStyle ? `Visual style: ${input.visualStyle}.` : "",
        input.presentationFormat ? `Presentation format: ${input.presentationFormat}.` : "",
        `Target length for Chinese topics: ${input.targetChineseCharacters}.`,
        `Target length for English or space-separated topics: ${input.targetWords}.`,
        `Structure: ${input.structure}.`,
        "Required output contract:",
        "- Return one JSON object, not an array and not plain text.",
        "- Set version to 2.",
        "- scenes.length must equal the requested Scene count.",
        "- Scene indexes must start at 0 and increase by 1.",
        "- Scene times must cover the full target duration in order without large gaps.",
        "- Every dialogue.text must directly narrate the provided Topic or Source script; do not invent an unrelated topic.",
        "- If Topic is Chinese, every dialogue.text must be Chinese unless the Topic itself asks for another language.",
        "- Include the topic's concrete objects, claims, or conflict in the dialogue text.",
        "- Every visual.prompt must be non-empty and specific to its scene.",
        "visual.source must be auto unless the user explicitly requested upload, pixabay, or ai.",
        "Use seconds as numbers, not timestamp strings.",
        "Do not include markdown fences.",
      ].filter(Boolean).join("\n"),
    },
  ]
}
