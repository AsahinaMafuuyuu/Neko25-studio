import { AiVideoAgentDetailClient } from "@/components/dashboard/ai-video-agent-detail-client"

export default async function AiVideoAgentDetailRoute({
  params,
}: PageProps<"/[locale]/dashboard/ai-video-agent/[id]">) {
  const { id } = await params
  return <AiVideoAgentDetailClient projectId={id} />
}
