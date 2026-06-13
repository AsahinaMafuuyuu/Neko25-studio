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

type DashboardTranslator = (key: string) => string

const dashboardNavConfig = [
  {
    key: "home",
    href: "/dashboard",
    icon: Home,
    mediaType: "video",
    mediaSrc: "/ai-video-agent.mp4",
  },
  {
    key: "aiVideoAgent",
    href: "/dashboard/ai-video-agent",
    icon: Bot,
    mediaType: "video",
    mediaSrc: "/ai-video-agent.mp4",
  },
  {
    key: "aiVideoAvatar",
    href: "/dashboard/ai-video-avatar",
    icon: Video,
    mediaType: "video",
    mediaSrc: "/ai-avatar.mp4",
  },
  {
    key: "aiAvatars",
    href: "/dashboard/avatar",
    icon: UserRound,
    mediaType: "video",
    mediaSrc: "/avatar.mp4",
  },
  {
    key: "aiVoiceCloning",
    href: "/dashboard/ai-voice-cloning",
    icon: Mic2,
    mediaType: "image",
    mediaSrc: "/voice-cloning.png",
  },
  {
    key: "library",
    href: "/dashboard/library",
    icon: FolderKanban,
    mediaType: "image",
    mediaSrc: "/my-library.webp",
  },
] as const

export function getDashboardNavItems(t: DashboardTranslator): DashboardNavItem[] {
  return dashboardNavConfig.map((item) => ({
    title: t(`nav.${item.key}.title`),
    href: item.href,
    description: t(`nav.${item.key}.description`),
    icon: item.icon,
    mediaType: item.mediaType,
    mediaSrc: item.mediaSrc,
  }))
}

export function getDashboardHomeCards(t: DashboardTranslator) {
  const dashboardNavItems = getDashboardNavItems(t)

  return [
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
    },
  ] as const
}

export const dashboardFooterMeta = {
  creditsValue: "1,280",
  billingIcon: CreditCard,
  brandIcon: Sparkles,
  heroIcon: Clapperboard,
}
