import { findReplicateOutputUrl, runReplicatePrediction } from "@/lib/replicate-audio"
import {
  buildDeepgramSpeakBody,
  buildQwenVoiceCloneInput,
  buildVoiceSampleTranscriptionInput,
} from "@/prompts/ai-voice-cloning.prompt"

const defaultWhisperxModel =
  "victor-upmeet/whisperx:655845d6190ef70573c669245f245892cd039df4b880a1e3a65852c09252f5cc"

export type VoiceSampleTranscription = {
  detectedLanguage: string
  transcript: string
}

export async function requestVoiceSampleTranscription(audioUrl: string): Promise<VoiceSampleTranscription> {
  const prediction = await runReplicatePrediction({
    model: process.env.REPLICATE_WHISPERX_MODEL?.trim() || defaultWhisperxModel,
    input: buildVoiceSampleTranscriptionInput(audioUrl),
  })
  const output = prediction.output && typeof prediction.output === "object"
    ? prediction.output as { detected_language?: unknown; segments?: unknown }
    : null
  const segments = output?.segments
  const transcript = Array.isArray(segments)
    ? segments
        .map((segment) => {
          if (!segment || typeof segment !== "object") return ""
          const text = (segment as Record<string, unknown>).text
          return typeof text === "string" ? text.trim() : ""
        })
        .filter(Boolean)
        .join(" ")
        .trim()
    : ""

  return {
    transcript,
    detectedLanguage: typeof output?.detected_language === "string" ? output.detected_language : "",
  }
}

export async function requestQwenVoiceCloneUrl(input: {
  language: string
  referenceAudioUrl?: string
  speaker?: string
  text: string
}) {
  if (!input.referenceAudioUrl) throw new Error("Custom voice reference audio is missing.")

  const prediction = await runReplicatePrediction({
    model: process.env.REPLICATE_QWEN_TTS_MODEL?.trim() || "qwen/qwen3-tts",
    input: buildQwenVoiceCloneInput({
      language: input.language,
      referenceAudioUrl: input.referenceAudioUrl,
      speaker: input.speaker || process.env.REPLICATE_QWEN_TTS_SPEAKER?.trim() || "Aiden",
      text: input.text,
    }),
  })
  const outputUrl = findReplicateOutputUrl(prediction.output)
  if (!outputUrl) {
    throw new Error("Replicate Qwen3-TTS did not return an audio URL.")
  }

  return outputUrl
}

export async function requestDeepgramTtsBlob(input: {
  providerVoiceId: string
  text: string
}) {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim()
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not configured.")
  if (!input.providerVoiceId) throw new Error("Choose a valid Deepgram voice.")

  const url = new URL("https://api.deepgram.com/v1/speak")
  url.searchParams.set("model", input.providerVoiceId)
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildDeepgramSpeakBody(input.text)),
  })

  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 240)
    throw new Error(`Deepgram TTS failed (${response.status}). ${body}`)
  }

  const contentType = response.headers.get("content-type") || "audio/wav"
  return new Blob([await response.arrayBuffer()], { type: contentType })
}
