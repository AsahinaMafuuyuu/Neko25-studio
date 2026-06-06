import { DashboardModulePage } from "@/components/dashboard/dashboard-module-page"
import { dashboardNavItems } from "@/lib/dashboard"

export default function AiVideoAvatarPage() {
  return (
    <DashboardModulePage
      item={dashboardNavItems[2]}
      checklist={[
        "突出 AI 虚拟人的展示与讲解能力",
        "为人设、台词和演出参数预留配置区域",
        "后续可扩展模板选择与输出管理",
      ]}
    />
  )
}
