import { DashboardModulePage } from "@/components/dashboard/dashboard-module-page"
import { dashboardNavItems } from "@/lib/dashboard"

export default function AvatarPage() {
  return (
    <DashboardModulePage
      item={dashboardNavItems[3]}
      checklist={[
        "聚焦角色形象与资产版本的集中管理",
        "为外观组合、预览和标签系统预留空间",
        "后续可接入真实素材上传与筛选能力",
      ]}
    />
  )
}
