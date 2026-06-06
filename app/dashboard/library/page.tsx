import { DashboardModulePage } from "@/components/dashboard/dashboard-module-page"
import { dashboardNavItems } from "@/lib/dashboard"

export default function LibraryPage() {
  return (
    <DashboardModulePage
      item={dashboardNavItems[5]}
      checklist={[
        "作为素材库与历史资产的统一入口",
        "为搜索、筛选和集合管理准备版面",
        "后续可接入视频、音频与形象资产列表",
      ]}
    />
  )
}
