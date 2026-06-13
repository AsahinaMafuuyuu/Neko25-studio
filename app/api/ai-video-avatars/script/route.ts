import {
  avatarErrorStatus,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/video-avatar-server"
import { generateScriptGeneratorText } from "@/lib/script-generator"
import { isScriptTone, type ScriptTone } from "@/lib/video-avatar-types"
import { buildTalkingAvatarScriptMessages } from "@/prompts/ai-video-agent-script.prompt"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    await requireCurrentUserId(accessToken)

    const body = (await request.json().catch(() => ({}))) as {
      topic?: string
      tone?: string
      durationSeconds?: number
    }
    const topic = typeof body.topic === "string" ? body.topic.trim() : ""
    const tone = isScriptTone(body.tone) ? body.tone : "professional"
    const durationSeconds = typeof body.durationSeconds === "number" ? body.durationSeconds : 30

    if (!topic) {
      return Response.json({ message: "Topic is required." }, { status: 400 })
    }

    const script = await generateScript({
      durationSeconds,
      tone,
      topic,
    })

    return Response.json({ script })
  } catch (error) {
    return jsonError(error, "Could not generate script.", avatarErrorStatus(error))
  }
}

async function generateScript(input: {
  durationSeconds: number
  tone: ScriptTone
  topic: string
}) {
  const script = await generateScriptGeneratorText({
    errorLabel: "Script generator API",
    maxCompletionTokens: 520,
    messages: buildTalkingAvatarScriptMessages({
      durationGuidance: getDurationGuidance(input.durationSeconds),
      durationSeconds: input.durationSeconds,
      tone: input.tone,
      topic: input.topic,
    }),
    temperature: 0.7,
  })

  return script.slice(0, 2000)
}

function getDurationGuidance(durationSeconds: number) {
  if (durationSeconds <= 5) return "1 short sentence with one clear punchline."
  if (durationSeconds <= 10) return "2 to 3 compact sentences: quick hook, one concrete point, ending line."
  if (durationSeconds <= 20) return "4 to 5 sentences: hook, context, emotional or practical turn, ending line."
  if (durationSeconds <= 30) return "one concise paragraph: hook, setup, development, payoff, ending line."
  return "two short paragraphs with a clear opening, development, and closing call or takeaway."
}
