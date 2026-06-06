import {
  Bot,
  Clapperboard,
  CreditCard,
  FolderKanban,
  Home,
  Mic2,
  type LucideIcon,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react"

export type DashboardMediaType = "image" | "video"

export type DashboardNavItem = {
  title: string
  href: string
  description: string
  icon: LucideIcon
  mediaType: DashboardMediaType
  mediaSrc: string
}

export const dashboardNavItems: DashboardNavItem[] = [
  {
    title: "主页",
    href: "/dashboard",
    description: "总览你的 AI 创作工作台与全部功能入口。",
    icon: Home,
    mediaType: "video",
    mediaSrc: "/ai-video-agent.mp4",
  },
  {
    title: "AI Video Agent",
    href: "/dashboard/ai-video-agent",
    description: "自动化视频生成、脚本编排与多步骤执行。",
    icon: Bot,
    mediaType: "video",
    mediaSrc: "/ai-video-agent.mp4",
  },
  {
    title: "AI Video Avatar",
    href: "/dashboard/ai-video-avatar",
    description: "用 AI 虚拟人完成镜头表达、讲解与演绎。",
    icon: Video,
    mediaType: "video",
    mediaSrc: "/ai-avatar.mp4",
  },
  {
    title: "Avatar",
    href: "/dashboard/avatar",
    description: "管理角色形象、外观版本与素材组合。",
    icon: UserRound,
    mediaType: "video",
    mediaSrc: "/avatar.mp4",
  },
  {
    title: "AI Voice Cloning",
    href: "/dashboard/ai-voice-cloning",
    description: "训练专属音色，快速复用到生成内容里。",
    icon: Mic2,
    mediaType: "image",
    mediaSrc: "/voice-cloning.png",
  },
  {
    title: "My Library",
    href: "/dashboard/library",
    description: "集中整理视频、音频、形象与项目资产。",
    icon: FolderKanban,
    mediaType: "image",
    mediaSrc: "/my-library.webp",
  },
]

export const dashboardHomeCards = [
  {
    ...dashboardNavItems[1],
    className: "md:col-span-3 xl:col-span-4 xl:row-span-2",
  },
  {
    ...dashboardNavItems[2],
    className: "md:col-span-3 xl:col-span-2",
  },
  {
    ...dashboardNavItems[3],
    className: "md:col-span-2 xl:col-span-2",
  },
  {
    ...dashboardNavItems[4],
    className: "md:col-span-4 xl:col-span-3",
  },
  {
    ...dashboardNavItems[5],
    className: "md:col-span-2 xl:col-span-3",
  }
] as const

export const dashboardQuickStats = [
  ["6", "可用工作区模块"],
  ["24/7", "媒体生成准备状态"],
  ["1,280", "静态积分占位"],
] as const

export const dashboardFooterMeta = {
  billingTitle: "用户账单设置",
  billingDescription: "管理计划、发票与续费信息",
  creditsTitle: "可用积分",
  creditsValue: "1,280",
  creditsDescription: "本月可用于视频、语音与形象生成",
  billingIcon: CreditCard,
  brandIcon: Sparkles,
  heroIcon: Clapperboard,
}
