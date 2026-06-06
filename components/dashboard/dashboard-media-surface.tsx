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
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,12,18,0.1)_0%,rgba(10,12,18,0.55)_48%,rgba(10,12,18,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_36%)]" />
    </div>
  )
}
