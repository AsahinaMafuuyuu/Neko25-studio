import { DashboardModulePage } from "@/components/dashboard/dashboard-module-page"
import { dashboardNavItems } from "@/lib/dashboard"

export default function AiVoiceCloningPage() {
  return (
    <DashboardModulePage
      item={dashboardNavItems[4]}
      checklist={[
        "展示语音克隆能力与当前模块定位",
        "为音色样本、训练参数和试听结果留出区域",
        "后续可扩展语音库管理与版本切换",
      ]}
    />
  )
}
