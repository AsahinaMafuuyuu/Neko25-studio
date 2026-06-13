import { redirect } from "next/navigation"

export default async function AiVideoAgentDetailRedirect({
  params,
}: PageProps<"/dashboard/ai-video-agent/[id]">) {
  const { id } = await params
  redirect(`/zh/dashboard/ai-video-agent/${id}`)
}
