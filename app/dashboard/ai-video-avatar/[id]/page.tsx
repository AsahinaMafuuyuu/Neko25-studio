import { redirect } from "next/navigation"

export default async function AiVideoAvatarDetailRedirect({
  params,
}: PageProps<"/dashboard/ai-video-avatar/[id]">) {
  const { id } = await params
  redirect(`/zh/dashboard/ai-video-avatar/${id}`)
}
