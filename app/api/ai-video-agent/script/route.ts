import {
  avatarErrorStatus,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/ai-video-agent-server"
import {
  getAiVideoAgentScriptLengthGuidance,
  isAiVideoAgentDuration,
  isAiVideoAgentSceneCount,
  normalizeAiVideoAgentTimeline,
  type AiVideoAgentDuration,
  type AiVideoAgentAspectRatio,
  type AiVideoAgentSceneCount,
} from "@/lib/ai-video-agent"
import { generateScriptGeneratorText } from "@/lib/script-generator"
import { buildAiVideoAgentTimelineMessages } from "@/prompts/ai-video-agent-timeline.prompt"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    await requireCurrentUserId(accessToken)

    const body = (await request.json().catch(() => ({}))) as {
      aspectRatio?: string
      script?: string
      topic?: string
      durationSeconds?: number
      sceneCount?: number
    }
    const topic = typeof body.topic === "string" ? body.topic.trim() : ""
    const script = typeof body.script === "string" ? body.script.trim() : ""
    const durationSeconds = Number(body.durationSeconds)
    const sceneCount = Number(body.sceneCount)
    const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9"

    if (!topic && !script) return Response.json({ message: "Topic or script is required." }, { status: 400 })
    if (!isAiVideoAgentDuration(durationSeconds)) {
      return Response.json({ message: "Choose a supported duration." }, { status: 400 })
    }
    if (!isAiVideoAgentSceneCount(sceneCount)) {
      return Response.json({ message: "Choose a supported scene count." }, { status: 400 })
    }

    const timeline = await generateTopicTimeline({ aspectRatio, durationSeconds, sceneCount, script, topic })
    return Response.json({
      script: timeline.scenes.flatMap((scene) => scene.dialogues).map((dialogue) => dialogue.text).join("\n"),
      timeline,
    })
  } catch (error) {
    return jsonError(error, "Could not generate AI video script.", avatarErrorStatus(error))
  }
}

async function generateTopicTimeline(input: {
  aspectRatio: AiVideoAgentAspectRatio
  durationSeconds: AiVideoAgentDuration
  sceneCount: AiVideoAgentSceneCount
  script: string
  topic: string
}) {
  const lengthGuidance = getAiVideoAgentScriptLengthGuidance(input.durationSeconds, input.sceneCount)
  const text = await generateScriptGeneratorText({
    errorLabel: "AI video agent script generation",
    maxCompletionTokens: Math.max(1400, lengthGuidance.maxCompletionTokens + 800),
    messages: buildAiVideoAgentTimelineMessages({
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      presentationFormat: "",
      sceneCount: input.sceneCount,
      script: input.script || input.topic,
      sourceScript: input.script,
      structure: lengthGuidance.structure,
      targetChineseCharacters: lengthGuidance.targetChineseCharacters,
      targetWords: lengthGuidance.targetWords,
      topic: input.topic,
      visualStyle: "",
    }),
    temperature: 0.45,
  })
  const sourceText = input.script || input.topic
  const parsed = parseScriptGeneratorTimelineResponse(text)
  const generatedScript = parsed.script && isTextRelevantToSource(parsed.script, sourceText) ? parsed.script : ""
  const timeline = parsed.timeline && isTimelineRelevantToSource(parsed.timeline, sourceText) ? parsed.timeline : null

  return normalizeAiVideoAgentTimeline({
    aspectRatio: input.aspectRatio,
    durationSeconds: input.durationSeconds,
    sceneCount: input.sceneCount,
    script: generatedScript || sourceText,
    timeline,
  })
}

function parseScriptGeneratorTimelineResponse(text: string) {
  const cleaned = stripResponseFences(text)
  const parsed = parseTimelineJson(cleaned)
  const timeline = standardizeTimelineCandidate(parsed)
  const script = timeline ? "" : extractPlainScriptText(cleaned)

  return { script, timeline }
}

function parseTimelineJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    for (const pattern of [/\{[\s\S]*\}/, /\[[\s\S]*\]/]) {
      const match = text.match(pattern)
      if (!match) continue
      try {
        return JSON.parse(match[0])
      } catch {
        continue
      }
    }

    return null
  }
}

function standardizeTimelineCandidate(value: unknown) {
  const candidate = unwrapTimelineCandidate(value)
  if (!candidate) return null

  const scenes = Array.isArray(candidate.scenes) ? candidate.scenes : []
  if (!scenes.length) return null

  return {
    ...candidate,
    version: 2,
    scenes: scenes.map((scene, index) => standardizeScene(scene, index)),
  }
}

function unwrapTimelineCandidate(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return { version: 2, scenes: value }
  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  if (Array.isArray(record.scenes)) return record

  for (const key of ["timeline", "data", "result", "output"]) {
    const nested = unwrapTimelineCandidate(record[key])
    if (nested) return nested
  }

  return null
}

function standardizeScene(value: unknown, index: number) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const visual = record.visual && typeof record.visual === "object" ? record.visual as Record<string, unknown> : {}
  const sourceDialogues = Array.isArray(record.dialogues) ? record.dialogues : []
  const fallbackText = firstString(record.narration, record.caption_text, record.captionText, record.text, record.summary)
  const dialogues = sourceDialogues.length
    ? sourceDialogues.map((dialogue, dialogueIndex) => standardizeDialogue(dialogue, index, dialogueIndex))
    : [{
        id: `dialogue-${index + 1}-1`,
        text: fallbackText || firstString(record.title) || `Scene ${index + 1}`,
      }]
  const dialogueText = dialogues.map((dialogue) => dialogue.text).filter(Boolean).join(" ")
  const visualPrompt = firstString(
    visual.prompt,
    record.prompt,
    record.bRollRequest,
    record.b_roll_request,
    record.visualPrompt,
    record.summary,
    dialogueText
  )

  return {
    ...record,
    id: firstString(record.id) || `scene-${index + 1}`,
    index: typeof record.index === "number" ? record.index : index,
    title: firstString(record.title) || `Scene ${index + 1}`,
    visual: {
      ...visual,
      source: firstString(visual.source) || "auto",
      prompt: visualPrompt,
    },
    dialogues,
  }
}

function standardizeDialogue(value: unknown, sceneIndex: number, dialogueIndex: number) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {}
  return {
    ...record,
    id: firstString(record.id) || `dialogue-${sceneIndex + 1}-${dialogueIndex + 1}`,
    text: firstString(record.text, record.narration, record.caption, record.line),
  }
}

function extractPlainScriptText(text: string) {
  if (!text || /^[\[{]/.test(text.trim())) return ""
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,6}\s/.test(line))
    .join("\n")
    .trim()
}

function stripResponseFences(text: string) {
  return text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function isTimelineRelevantToSource(timeline: unknown, sourceText: string) {
  const sourceKeywords = extractRelevanceKeywords(sourceText)
  if (!sourceKeywords.length) return true
  if (!timeline || typeof timeline !== "object") return false

  const scenes = (timeline as { scenes?: unknown }).scenes
  if (!Array.isArray(scenes)) return false

  const generatedText = scenes
    .flatMap((scene) => {
      if (!scene || typeof scene !== "object") return []
      const record = scene as Record<string, unknown>
      const visual = record.visual && typeof record.visual === "object" ? record.visual as Record<string, unknown> : {}
      const dialogues = Array.isArray(record.dialogues) ? record.dialogues : []
      return [
        record.title,
        visual.prompt,
        ...dialogues.map((dialogue) => dialogue && typeof dialogue === "object" ? (dialogue as Record<string, unknown>).text : ""),
      ]
    })
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()

  const matches = sourceKeywords.filter((keyword) => generatedText.includes(keyword)).length
  return matches >= Math.min(2, sourceKeywords.length)
}

function isTextRelevantToSource(text: string, sourceText: string) {
  const sourceKeywords = extractRelevanceKeywords(sourceText)
  if (!sourceKeywords.length) return true
  const lower = text.toLowerCase()
  const matches = sourceKeywords.filter((keyword) => lower.includes(keyword)).length
  return matches >= Math.min(2, sourceKeywords.length)
}

function extractRelevanceKeywords(text: string) {
  const lower = text.toLowerCase()
  const latinWords = lower.match(/[a-z0-9][a-z0-9'-]{2,}/g) || []
  const cjkText = lower.replace(/[^\u3400-\u9fff]/g, "")
  const cjkBigrams = Array.from({ length: Math.max(0, cjkText.length - 1) }, (_, index) => cjkText.slice(index, index + 2))
  const stopWords = new Set(["这个", "那个", "有人", "突然", "一下", "什么", "怎么", "不是", "就是", "还是"])

  return Array.from(new Set([...latinWords, ...cjkBigrams]))
    .filter((keyword) => keyword.length >= 2 && !stopWords.has(keyword))
    .slice(0, 40)
}
