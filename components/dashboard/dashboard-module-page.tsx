import { DashboardMediaSurface } from "@/components/dashboard/dashboard-media-surface"
import type { DashboardNavItem } from "@/lib/dashboard"

const defaultChecklist = [
  "模块入口与空状态文案已就位",
  "媒体背景与主题样式已接入",
  "后续可在此页继续挂接真实工作流",
]

export function DashboardModulePage({
  item,
  checklist = defaultChecklist,
}: {
  item: DashboardNavItem
  checklist?: string[]
}) {
  const Icon = item.icon

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <DashboardMediaSurface alt={item.title} mediaSrc={item.mediaSrc} mediaType={item.mediaType} />
          <div className="relative flex h-full flex-col justify-end p-6 text-white sm:p-8">
            <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur">
              <Icon className="size-6" />
            </div>
            <p className="text-sm font-medium text-white/72">Workspace Module</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">{item.description}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">当前状态</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">Ready for implementation</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              这个页面骨架已经准备好，接下来可以直接接入真实的生成流程、表单和任务结果视图。
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">本页包含</p>
            <ul className="mt-4 space-y-3">
              {checklist.map((entry) => (
                <li key={entry} className="flex items-start gap-3 text-sm leading-6 text-foreground">
                  <span className="mt-1 size-2 rounded-full bg-primary" />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
