import Image from "next/image"

import { cn } from "@/lib/utils"

type DashboardMediaSurfaceProps = {
  alt: string
  className?: string
  mediaSrc: string
  mediaType: "image" | "video"
}

export function DashboardMediaSurface({
  alt,
  className,
  mediaSrc,
  mediaType,
}: DashboardMediaSurfaceProps) {
  return (
    <div className={cn("absolute inset-0", className)}>
      {mediaType === "image" ? (
        <Image
          src={mediaSrc}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover"
        />
      ) : (
        <video
          aria-label={alt}
          autoPlay
          className="size-full object-cover"
          loop
          muted
          playsInline
        >
          <source src={mediaSrc} />
        </video>
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(12_14_18_/_0.04)_0%,rgb(12_14_18_/_0.42)_54%,rgb(12_14_18_/_0.82)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(255_255_255_/_0.16),transparent_34%)]" />
    </div>
  )
}
