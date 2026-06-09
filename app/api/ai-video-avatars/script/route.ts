import {
  avatarErrorStatus,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
} from "@/lib/video-avatar-server"
import { isScriptTone, type ScriptTone } from "@/lib/video-avatar-types"

const toneLabels: Record<ScriptTone, string> = {
  professional: "calm, precise, credible, and businesslike",
  friendly: "warm, conversational, approachable, and easygoing",
  energetic: "high-energy, punchy, expressive, and fast-moving",
  educational: "clear, structured, explanatory, and teaching-oriented",
  promotional: "persuasive, polished, memorable, and action-oriented without inventing unrelated products or claims",
}

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
  const apiKey = process.env.SCRIPT_GENERATOR_API_KEY?.trim()
  const model = process.env.SCRIPT_GENERATOR_MODEL?.trim()

  if (!apiKey) {
    throw new Error("SCRIPT_GENERATOR_API_KEY is not configured.")
  }

  if (!model) {
    throw new Error("SCRIPT_GENERATOR_MODEL is not configured.")
  }

  const response = await fetch("https://api.aisz.mom/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
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
          role: "user",
          content: [
            "Create a talking-avatar spoken script from this brief.",
            "",
            `Topic / content brief: ${input.topic}`,
            `Delivery tone: ${toneLabels[input.tone]}`,
            `Target duration: ${input.durationSeconds} seconds`,
            `Length and structure guidance: ${getDurationGuidance(input.durationSeconds)}`,
            "",
            "Rules:",
            "- Treat Topic as the semantic source of truth; do not introduce a different theme.",
            "- If the Topic contains a mood, conflict, or specific situation, preserve it and make the script revolve around it.",
            "- Tone should affect wording, rhythm, and attitude only.",
            "- Promotional tone means more compelling and memorable, not random advertising.",
            "- Keep it natural for spoken delivery and under 2000 characters.",
          ].join("\n"),
        },
      ],
      max_completion_tokens: 520,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 240)
    throw new Error(`Script generator API failed (${response.status}). ${detail}`)
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const script = body.choices?.[0]?.message?.content?.trim() || ""
  if (!script) throw new Error("Script generator API did not return a script.")

  return script.slice(0, 2000)
}

function getDurationGuidance(durationSeconds: number) {
  if (durationSeconds <= 5) return "1 short sentence with one clear punchline."
  if (durationSeconds <= 10) return "2 to 3 compact sentences: quick hook, one concrete point, ending line."
  if (durationSeconds <= 20) return "4 to 5 sentences: hook, context, emotional or practical turn, ending line."
  if (durationSeconds <= 30) return "one concise paragraph: hook, setup, development, payoff, ending line."
  return "two short paragraphs with a clear opening, development, and closing call or takeaway."
}
