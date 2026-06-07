import {
  avatarErrorStatus,
  createAvatar,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  uploadAvatarFile,
} from "@/lib/avatar-server"
import { isAvatarStyle } from "@/lib/avatar-types"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const form = await request.formData()
    const file = form.get("file")
    const desktopFile = form.get("desktopFile")
    const mobileFile = form.get("mobileFile")
    const styleValue = form.get("style")
    const nameValue = form.get("name")
    const sourceValue = form.get("source")
    const avatarName = typeof nameValue === "string" ? nameValue.trim() : ""
    const isGeneratedUpload = sourceValue === "ai" || desktopFile instanceof File || mobileFile instanceof File

    if (!isGeneratedUpload && !(file instanceof File)) {
      return Response.json({ message: "Choose an avatar image before uploading." }, { status: 400 })
    }

    if (isGeneratedUpload && (!(desktopFile instanceof File) || !(mobileFile instanceof File))) {
      return Response.json({ message: "Generated avatar previews are incomplete. Please regenerate before uploading." }, { status: 400 })
    }

    if (!avatarName) {
      return Response.json({ message: "Avatar name is required." }, { status: 400 })
    }

    const style = isAvatarStyle(styleValue) ? styleValue : "Casual"
    if (isGeneratedUpload && desktopFile instanceof File && mobileFile instanceof File) {
      const [desktopUpload, mobileUpload] = await Promise.all([
        uploadAvatarFile(desktopFile, `users/${userId}/generated`, desktopFile.name || "generated-avatar-16x9.png", accessToken),
        uploadAvatarFile(mobileFile, `users/${userId}/generated`, mobileFile.name || "generated-avatar-9x16.png", accessToken),
      ])
      const avatar = await createAvatar(
        {
          userId,
          name: avatarName,
          style,
          imageUrl: desktopUpload.url,
          imageKey: desktopUpload.key,
          desktopImageUrl: desktopUpload.url,
          desktopImageKey: desktopUpload.key,
          mobileImageUrl: mobileUpload.url,
          mobileImageKey: mobileUpload.key,
          source: "ai",
          isSelected: true,
        },
        accessToken
      )

      return Response.json({ avatar })
    }

    if (!(file instanceof File)) {
      return Response.json({ message: "Choose an avatar image before uploading." }, { status: 400 })
    }

    const upload = await uploadAvatarFile(file, `users/${userId}/uploads`, file.name || "avatar.png", accessToken)
    const avatar = await createAvatar(
      {
        userId,
        name: avatarName,
        style,
        imageUrl: upload.url,
        imageKey: upload.key,
        source: "upload",
        isSelected: true,
      },
      accessToken
    )

    return Response.json({ avatar })
  } catch (error) {
    return jsonError(error, "Could not upload avatar.", avatarErrorStatus(error))
  }
}
