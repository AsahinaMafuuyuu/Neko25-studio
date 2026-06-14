import {
  avatarErrorStatus,
  jsonError,
  requireBearerToken,
  requireCurrentUserId,
  uploadAvatarFile,
} from "@/lib/avatar-server"
import { getAccountSettingsPayload, upsertUserProfileRecord } from "@/lib/account-settings-server"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const formData = await request.formData()
    const file = formData.get("avatar")

    if (!(file instanceof Blob) || file.size <= 0) {
      return Response.json({ message: "Choose an avatar image before uploading." }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return Response.json({ message: "Avatar must be an image file." }, { status: 400 })
    }

    const upload = await uploadAvatarFile(
      file,
      `users/${userId}/profile-avatar`,
      "profile-avatar.png",
      accessToken
    )
    await upsertUserProfileRecord(userId, {
      avatar_url: upload.url,
      avatar_key: upload.key,
    })

    return Response.json(await getAccountSettingsPayload(userId))
  } catch (error) {
    return jsonError(error, "Could not upload avatar image.", avatarErrorStatus(error))
  }
}
