import { AiVideoAvatarDetailPage } from "@/components/dashboard/ai-video-avatar-detail-page"

export default async function AiVideoAvatarDetailRoute({
  params,
}: PageProps<"/[locale]/dashboard/ai-video-avatar/[id]">) {
  const { id } = await params
  return <AiVideoAvatarDetailPage videoId={id} />
}
