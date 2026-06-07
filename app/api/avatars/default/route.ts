import { avatarErrorStatus, createAvatar, jsonError, requireBearerToken, requireCurrentUserId } from "@/lib/avatar-server"
import { isAvatarStyle } from "@/lib/avatar-types"

export async function POST(request: Request) {
  try {
    const accessToken = requireBearerToken(request)
    const userId = await requireCurrentUserId(accessToken)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    if (typeof body.imageUrl !== "string" || !body.imageUrl.trim()) {
      return Response.json({ message: "Default avatar image is required." }, { status: 400 })
    }

    const avatar = await createAvatar(
      {
        userId,
        name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Default Avatar",
        style: isAvatarStyle(body.style) ? body.style : "Casual",
        imageUrl: body.imageUrl.trim(),
        imageKey: typeof body.imageKey === "string" ? body.imageKey : "",
        source: "default",
        isSelected: true,
      },
      accessToken
    )

    return Response.json({ avatar })
  } catch (error) {
    return jsonError(error, "Could not save default avatar.", avatarErrorStatus(error))
  }
}
