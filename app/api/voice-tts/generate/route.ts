import { tasks } from "@trigger.dev/sdk/v3"

import {
  defaultCustomTtsLanguage,
  getDefaultVoiceById,
  getTtsCreditCost,
  isSupportedCustomTtsLanguage,
} from "@/lib/voice-types"
import {
  avatarErrorStatus,
  createTtsJob,
  deductCredits,
  getVoiceCloneById,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  updateTtsJob,
} from "@/lib/voice-server"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as {
      text?: string
      voiceId?: string
      voiceSource?: string
      language?: string
    }
    const text = typeof body.text === "string" ? body.text.trim() : ""
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : ""
    const requestedLanguage = typeof body.language === "string" ? body.language.trim() : defaultCustomTtsLanguage

    if (!voiceId) {
      return Response.json({ message: "Choose a voice before generating audio." }, { status: 400 })
    }

    if (!text) {
      return Response.json({ message: "Text is required." }, { status: 400 })
    }

    const { characterCount, creditsCost } = getTtsCreditCost(text)
    if (characterCount > 2000) {
      return Response.json({ message: "Text must be 2,000 characters or fewer." }, { status: 400 })
    }

    const defaultVoice = getDefaultVoiceById(voiceId)
    const customVoice = defaultVoice ? null : await getVoiceCloneById(voiceId, userId)
    if (!defaultVoice && !customVoice) {
      return Response.json({ message: "Voice not found." }, { status: 404 })
    }
    if (customVoice && !isSupportedCustomTtsLanguage(requestedLanguage)) {
      return Response.json({ message: "Choose a supported Qwen3-TTS output language." }, { status: 400 })
    }

    const language = customVoice ? requestedLanguage : defaultVoice?.language || defaultCustomTtsLanguage

    const job = await createTtsJob({
      userId,
      voiceCloneId: customVoice?.id || null,
      voiceName: customVoice?.name || defaultVoice?.name || "Voice",
      voiceSource: customVoice ? "custom" : "default",
      providerVoiceId: defaultVoice?.provider_voice_id || "",
      language,
      text,
      characterCount,
      creditsCost,
    })
    const creditBalance = await deductCredits({
      userId,
      amount: creditsCost,
      description: "Voice Cloning TTS generation.",
      referenceType: "ai_tts_jobs",
      referenceId: job.id,
    })

    const handle = await tasks.trigger(
      "generate-voice-cloning-tts",
      {
        jobId: job.id,
        userId,
        voiceCloneId: customVoice?.id || null,
        voiceName: customVoice?.name || defaultVoice?.name || "Voice",
        voiceSource: customVoice ? "custom" : "default",
        providerVoiceId: defaultVoice?.provider_voice_id || "",
        language,
        sampleAudioUrl: customVoice?.sample_audio_url || "",
        text,
        characterCount,
        creditsCost,
      },
      {
        tags: [`user:${userId}`, `tts-job:${job.id}`],
      }
    )

    const updatedJob = await updateTtsJob(job.id, {
      trigger_run_id: handle.id,
      progress: 12,
      message: "Text to speech generation has started.",
    })

    return Response.json({ job: updatedJob || job, runId: handle.id, creditBalance })
  } catch (error) {
    return jsonError(error, "Could not start text to speech generation.", avatarErrorStatus(error))
  }
}
