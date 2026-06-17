import { createPresignedR2Upload } from "@/lib/storage/r2"
import {
  avatarErrorStatus,
  createVoiceUploadKey,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  voiceBucket,
} from "@/lib/voice-server"

const maxVoiceSampleBytes = 24 * 1024 * 1024
const maxVoiceImageBytes = 8 * 1024 * 1024

type UploadKind = "sample" | "image"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => null)) as {
      kind?: UploadKind
      filename?: string
      contentType?: string
      size?: number
    } | null

    const kind = body?.kind
    const filename = typeof body?.filename === "string" ? body.filename.trim() : ""
    const contentType = typeof body?.contentType === "string" ? body.contentType.trim() : ""
    const size = typeof body?.size === "number" ? body.size : 0

    if (kind !== "sample" && kind !== "image") {
      return Response.json({ message: "Upload kind must be sample or image." }, { status: 400 })
    }

    if (!filename) {
      return Response.json({ message: "Upload filename is required." }, { status: 400 })
    }

    if (kind === "sample" && !contentType.startsWith("audio/")) {
      return Response.json({ message: "Voice sample must be an audio file." }, { status: 400 })
    }

    if (kind === "image" && !contentType.startsWith("image/")) {
      return Response.json({ message: "Voice image must be an image file." }, { status: 400 })
    }

    const maxBytes = kind === "sample" ? maxVoiceSampleBytes : maxVoiceImageBytes
    if (size <= 0 || size > maxBytes) {
      const maxLabel = kind === "sample" ? "24 MB" : "8 MB"
      return Response.json({ message: `Upload must be smaller than ${maxLabel}.` }, { status: 400 })
    }

    const key = createVoiceUploadKey({
      userId,
      kind,
      filename,
      contentType,
    })
    const upload = await createPresignedR2Upload(voiceBucket, key, {
      contentType,
      expiresInSeconds: 600,
    })

    return Response.json({ upload })
  } catch (error) {
    return jsonError(error, "Could not prepare voice upload.", avatarErrorStatus(error))
  }
}
