import { useTranslations } from "next-intl"

import { DashboardModulePage } from "@/components/dashboard/dashboard-module-page"
import { getDashboardNavItems } from "@/lib/dashboard"

export default function LibraryPage() {
  const t = useTranslations("Dashboard")
  const dashboardNavItems = getDashboardNavItems(t)

  return (
    <DashboardModulePage
      item={dashboardNavItems[5]}
      checklist={[
        t("libraryChecklist.entry"),
        t("libraryChecklist.search"),
        t("libraryChecklist.assets"),
      ]}
    />
  )
}
