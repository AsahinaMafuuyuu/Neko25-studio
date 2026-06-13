export type ScriptGeneratorMessage = {
  content: string
  role: "system" | "user" | "assistant"
}

type ScriptGeneratorConfig = {
  apiKey: string
  apiUrl: string
  model: string
}

const defaultScriptGeneratorApiUrl = "https://api.aisz.mom/v1/chat/completions"

export async function generateScriptGeneratorText(input: {
  errorLabel?: string
  maxCompletionTokens: number
  messages: ScriptGeneratorMessage[]
  temperature?: number
}) {
  const config = getScriptGeneratorConfig()
  const response = await fetch(getScriptGeneratorEndpoint(config.apiUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: input.messages,
      max_completion_tokens: input.maxCompletionTokens,
      temperature: input.temperature ?? 0.7,
    }),
  })

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 240)
    throw new Error(`${input.errorLabel || "Script generator API"} failed (${response.status}). ${detail}`)
  }

  const body = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = body.choices?.[0]?.message?.content?.trim() || ""
  if (!text) throw new Error(`${input.errorLabel || "Script generator API"} did not return text.`)

  return text
}

function getScriptGeneratorConfig(): ScriptGeneratorConfig {
  const apiKey = process.env.SCRIPT_GENERATOR_API_KEY?.trim()
  const apiUrl = process.env.SCRIPT_GENERATOR_API_URL?.trim() || defaultScriptGeneratorApiUrl
  const model = process.env.SCRIPT_GENERATOR_MODEL?.trim()

  if (!apiKey) {
    throw new Error("SCRIPT_GENERATOR_API_KEY is not configured.")
  }

  if (!model) {
    throw new Error("SCRIPT_GENERATOR_MODEL is not configured.")
  }

  return { apiKey, apiUrl, model }
}

function getScriptGeneratorEndpoint(apiUrl: string) {
  const baseUrl = apiUrl.replace(/\/+$/, "")

  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`
  if (new URL(baseUrl).pathname !== "/") return baseUrl
  return `${baseUrl}/v1/chat/completions`
}
