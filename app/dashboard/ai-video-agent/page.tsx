import { DashboardModulePage } from "@/components/dashboard/dashboard-module-page"
import { dashboardNavItems } from "@/lib/dashboard"

export default function AiVideoAgentPage() {
  return (
    <DashboardModulePage
      item={dashboardNavItems[1]}
      checklist={[
        "展示 AI 视频任务的入口与工作台氛围",
        "为脚本、镜头和自动化步骤预留内容区",
        "后续可接入真实任务队列与生成结果",
      ]}
    />
  )
}
