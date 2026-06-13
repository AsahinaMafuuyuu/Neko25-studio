import {
  avatarErrorStatus,
  createAiVideoAgentAsset,
  getAiVideoAgentProject,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  uploadAiVideoAgentBlob,
} from "@/lib/ai-video-agent-server"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const formData = await request.formData()
    const file = formData.get("file")
    const projectId = String(formData.get("projectId") || "").trim()
    const sceneId = String(formData.get("sceneId") || "").trim()

    if (!projectId) return Response.json({ message: "Project id is required." }, { status: 400 })
    if (!(file instanceof File)) return Response.json({ message: "Choose an image file." }, { status: 400 })
    if (!file.type.startsWith("image/")) return Response.json({ message: "Only image uploads are supported." }, { status: 400 })

    const project = await getAiVideoAgentProject(projectId, userId)
    if (!project) return Response.json({ message: "AI video project not found." }, { status: 404 })

    const upload = await uploadAiVideoAgentBlob({
      blob: file,
      filename: file.name || "scene-image.png",
      folder: "scene-uploads",
      projectId,
      userId,
    })
    const asset = await createAiVideoAgentAsset({
      projectId,
      sceneId: sceneId || null,
      userId,
      assetType: "scene_image",
      provider: "upload",
      url: upload.url,
      key: upload.key,
      contentType: upload.contentType,
      metadata: { originalName: file.name },
    })

    return Response.json({ asset })
  } catch (error) {
    return jsonError(error, "Could not upload scene image.", avatarErrorStatus(error))
  }
}
