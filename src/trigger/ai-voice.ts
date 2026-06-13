import { task } from "@trigger.dev/sdk/v3"
import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { extname, join } from "node:path"
import ffmpegPath from "ffmpeg-static"

import {
  requestDeepgramTtsBlob,
  requestQwenVoiceCloneUrl,
} from "../../lib/ai-voice-cloning-requests"
import {
  createTtsOutput,
  refundCredits,
  updateTtsJob,
  uploadVoiceBlob,
} from "../../lib/voice-server"
import type { VoiceSource } from "../../lib/voice-types"

type GenerateVoiceCloningTtsPayload = {
  jobId: string
  userId: string
  voiceCloneId?: string | null
  voiceName: string
  voiceSource: VoiceSource
  providerVoiceId?: string
  language: string
  sampleAudioUrl?: string
  text: string
  characterCount: number
  creditsCost: number
}

type AudioAsset = {
  blob: Blob
  filename: string
  format: "mp3" | "wav" | "audio"
}

export const generateVoiceCloningTts = task({
  id: "generate-voice-cloning-tts",
  maxDuration: 900,
  catchError: ({ error }) => {
    if (isConfigurationError(error)) return { skipRetrying: true }
  },
  run: async (payload: GenerateVoiceCloningTtsPayload) => {
    try {
      await updateTtsJob(payload.jobId, {
        status: "running",
        progress: 18,
        message: "Preparing text to speech generation.",
        error: "",
      })

      await updateTtsJob(payload.jobId, {
        status: "generating",
        progress: 48,
        message:
          payload.voiceSource === "custom"
            ? "Qwen3-TTS is generating audio from your saved voice sample."
            : "Deepgram is generating audio with the selected default voice.",
      })

      const sourceBlob =
        payload.voiceSource === "custom"
          ? await downloadAudio(
              await requestQwenVoiceCloneUrl({
                text: payload.text,
                language: payload.language,
                referenceAudioUrl: payload.sampleAudioUrl,
              })
            )
          : await requestDeepgramTtsBlob({
              text: payload.text,
              providerVoiceId: payload.providerVoiceId || "",
            })

      await updateTtsJob(payload.jobId, {
        status: "uploading",
        progress: 78,
        message: "Converting generated audio to MP3 and saving it.",
      })

      const audio = await toPreferredAudioAsset(sourceBlob, `${payload.voiceName}-tts-${payload.jobId}`)
      const uploaded = await uploadVoiceBlob(audio.blob, `tts/${payload.userId}/${payload.jobId}`, audio.filename)
      const output = await createTtsOutput({
        userId: payload.userId,
        voiceCloneId: payload.voiceCloneId || null,
        voiceName: payload.voiceName,
        voiceSource: payload.voiceSource,
        providerVoiceId: payload.providerVoiceId || "",
        language: payload.language,
        text: payload.text,
        characterCount: payload.characterCount,
        creditsCost: payload.creditsCost,
        audioUrl: uploaded.url,
        audioKey: uploaded.key,
        audioFormat: audio.format,
      })

      await updateTtsJob(payload.jobId, {
        tts_output_id: output.id,
        status: "completed",
        progress: 100,
        message: "Text to speech audio is ready.",
        error: "",
      })

      return { outputId: output.id, audioUrl: output.audio_url, format: output.audio_format }
    } catch (error) {
      const message = getErrorMessage(error)
      await refundCredits({
        userId: payload.userId,
        amount: payload.creditsCost,
        description: "Refund for failed Voice Cloning TTS generation.",
        referenceType: "ai_tts_jobs",
        referenceId: payload.jobId,
      })
        .then(() =>
          updateTtsJob(payload.jobId, {
            credits_refunded: true,
          })
        )
        .catch(() => undefined)

      await updateTtsJob(payload.jobId, {
        status: "failed",
        progress: 100,
        message: "Text to speech generation failed.",
        error: message,
      }).catch(() => undefined)
      throw error
    }
  },
})

async function downloadAudio(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not download generated audio (${response.status}).`)
  }

  const contentType = response.headers.get("content-type") || "audio/wav"
  return new Blob([await response.arrayBuffer()], { type: contentType })
}

async function toPreferredAudioAsset(blob: Blob, baseName: string): Promise<AudioAsset> {
  const safeBaseName = baseName.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "generated-audio"
  const mp3 = await tryConvertToMp3(blob, safeBaseName).catch(() => null)
  if (mp3) return mp3

  const fallbackFormat = blob.type.includes("wav") || blob.type.includes("wave") ? "wav" : "audio"
  return {
    blob,
    filename: `${safeBaseName}.${fallbackFormat === "wav" ? "wav" : getBlobExtension(blob)}`,
    format: fallbackFormat,
  }
}

async function tryConvertToMp3(blob: Blob, baseName: string): Promise<AudioAsset | null> {
  if (!ffmpegPath) return null

  const workdir = await mkdtemp(join(tmpdir(), "kravix-voice-"))
  const inputPath = join(workdir, `input.${getBlobExtension(blob)}`)
  const outputPath = join(workdir, "output.mp3")

  try {
    await writeFile(inputPath, Buffer.from(await blob.arrayBuffer()))
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      outputPath,
    ])

    const output = await readFile(outputPath)
    return {
      blob: new Blob([output], { type: "audio/mpeg" }),
      filename: `${baseName}.mp3`,
      format: "mp3",
    }
  } finally {
    await rm(workdir, { force: true, recursive: true }).catch(() => undefined)
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg-static did not return a binary path."))
      return
    }

    const child = spawn(ffmpegPath, args, { stdio: "ignore" })
    child.once("error", reject)
    child.once("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}.`))
    })
  })
}

function getBlobExtension(blob: Blob) {
  if (blob.type.includes("mpeg") || blob.type.includes("mp3")) return "mp3"
  if (blob.type.includes("wav") || blob.type.includes("wave")) return "wav"
  if (blob.type.includes("ogg")) return "ogg"
  if (blob.type.includes("webm")) return "webm"
  const extension = extname(blob.type).replace(".", "")
  return extension || "wav"
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    return String(record.message || record.error || "Unknown audio generation error.")
  }

  return "Unknown audio generation error."
}

function isConfigurationError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return message.includes("is not configured") || message.includes("must be formatted")
}
