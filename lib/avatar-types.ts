export const avatarStyles = ["Podcast", "Casual", "3D Cartoon", "Stylized"] as const

export type AvatarStyle = (typeof avatarStyles)[number]

export type AvatarSource = "default" | "upload" | "ai"

export type AvatarJobStatus =
  | "queued"
  | "running"
  | "generating"
  | "uploading"
  | "completed"
  | "failed"

export type AiAvatar = {
  id: string
  user_id: string
  name: string
  style: AvatarStyle
  image_url: string
  image_key: string
  desktop_image_url: string
  desktop_image_key: string
  mobile_image_url: string
  mobile_image_key: string
  source: AvatarSource
  is_selected: boolean
  created_at: string
  updated_at: string
}

export type AiAvatarJob = {
  id: string
  user_id: string
  avatar_id: string | null
  trigger_run_id: string | null
  style: AvatarStyle
  prompt: string
  source_image_url: string
  source_image_key: string
  status: AvatarJobStatus
  progress: number
  message: string
  error: string
  created_at: string
  updated_at: string
}

export type GeneratedAvatarPreviewImage = {
  dataUrl: string
  filename: string
  mimeType: string
}

export type GeneratedAvatarPreview = {
  desktop: GeneratedAvatarPreviewImage
  mobile: GeneratedAvatarPreviewImage
}

export type AvatarJobResponse = {
  job: AiAvatarJob
  avatar: AiAvatar | null
  generatedPreview?: GeneratedAvatarPreview | null
}

export function isAvatarStyle(value: unknown): value is AvatarStyle {
  return typeof value === "string" && avatarStyles.includes(value as AvatarStyle)
}
