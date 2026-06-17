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
          className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.015] motion-reduce:transition-none"
        />
      ) : (
        <video
          aria-label={alt}
          autoPlay
          className="size-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.015] motion-reduce:transition-none"
          loop
          muted
          playsInline
        >
          <source src={mediaSrc} />
        </video>
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,12,18,0.04)_0%,rgba(10,12,18,0.52)_48%,rgba(10,12,18,0.94)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.14),transparent_34%)]" />
    </div>
  )
}
