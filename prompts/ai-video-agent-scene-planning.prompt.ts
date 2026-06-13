export type AiVideoAgentScenePlanningPromptParams = {
  sceneCount: number
  script: string
  visualStyle: string
  presentationFormat: string
}

export function buildAiVideoAgentScenePlanningMessages(params: AiVideoAgentScenePlanningPromptParams) {
  return [
    {
      role: "system" as const,
      content: [
        "Split video scripts into JSON scenes.",
        "Return only a JSON array. Do not include markdown, comments, explanations, or prose outside JSON.",
        "Each item must include title, summary, narration, bRollRequest, prompt, keyword.",
        "All string fields must be non-empty.",
        "Keep narration coverage in the same order as the script.",
        "Do not replace, summarize away, or redirect the script's topic. Preserve its concrete scenario, named objects, conflict, emotion, and language.",
        "The prompt and bRollRequest fields must describe specific visual imagery for that exact scene.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: [
        `Scene count: ${params.sceneCount}`,
        `Visual style: ${params.visualStyle}`,
        `Presentation format: ${params.presentationFormat}`,
        "Rules:",
        "- Return exactly the requested number of scene objects.",
        "- narration fields together must cover the full script in order.",
        "- prompt must be a concrete visual prompt, not a generic label.",
        "- keyword must be short and derived from the script topic.",
        "",
        params.script,
      ].join("\n"),
    },
  ]
}
