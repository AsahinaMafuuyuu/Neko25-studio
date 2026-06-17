"use client"

import { Check, LayoutTemplate, LoaderCircle, Mic2, Pause, Play, Sparkles, WandSparkles } from "lucide-react"
import type React from "react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { AiAvatar } from "@/lib/avatar-types"
import type { VoiceListItem } from "@/lib/voice-types"
import { cn } from "@/lib/utils"

export function ChoiceGroupCard({
  children,
  contentClassName,
  count,
  description,
  icon,
  title,
}: {
  children: React.ReactNode
  contentClassName?: string
  count: number
  description: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <section className="group/choice-card min-h-[220px] rounded-xl border border-border/70 bg-card p-4 shadow-sm ring-1 ring-foreground/[0.03] transition-colors hover:border-primary/20">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15 transition-transform duration-200 group-hover/choice-card:scale-105 motion-reduce:transition-none">
              {icon}
            </span>
            <h4 className="text-sm font-semibold uppercase text-foreground">{title}</h4>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className={cn("grid gap-3", contentClassName)}>{children}</div>
    </section>
  )
}

export function ChoiceEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-background/70 px-4 py-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export function ChoiceGrid({
  children,
  description,
  label,
}: {
  children: React.ReactNode
  description?: string
  label: string
}) {
  return (
    <div className="grid gap-2">
      <div>
        <Label>{label}</Label>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  )
}

export function AvatarChoice({
  avatar,
  disabled = false,
  onSelect,
  selected,
}: {
  avatar: AiAvatar
  disabled?: boolean
  onSelect: () => void
  selected: boolean
}) {
  const desktopImageUrl = getAvatarDesktopImageUrl(avatar)
  const mobileImageUrl = getAvatarMobileImageUrl(avatar)

  return (
    <button
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        selected ? "border-primary/55 bg-[color-mix(in_oklch,var(--primary),var(--background)_92%)] ring-2 ring-primary/20" : "border-border/70 hover:border-primary/25"
      )}
      disabled={disabled}
      type="button"
      onClick={onSelect}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(62px,0.52fr)] items-center gap-2 bg-secondary/70 p-2">
        <AvatarRatioPreview imageUrl={desktopImageUrl} label="16:9" name={avatar.name} ratioClassName="aspect-video" />
        <AvatarRatioPreview imageUrl={mobileImageUrl} label="9:16" name={avatar.name} ratioClassName="aspect-[9/16]" />
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-semibold">{avatar.name}</h4>
          {selected ? <Check className="size-4 text-primary" /> : null}
        </div>
        <p className="text-xs text-muted-foreground">{avatar.style} / {avatar.source}</p>
      </div>
    </button>
  )
}

export function VoiceChoice({
  disabled = false,
  loading = false,
  onPlay,
  onSelect,
  playing = false,
  selected,
  voice,
}: {
  disabled?: boolean
  loading?: boolean
  onPlay: () => void
  onSelect: () => void
  playing?: boolean
  selected: boolean
  voice: VoiceListItem
}) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border bg-card p-3 shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        selected ? "border-primary/55 bg-[color-mix(in_oklch,var(--primary),var(--background)_92%)] ring-2 ring-primary/20" : "border-border/70 hover:border-primary/25",
        disabled && "opacity-60"
      )}
    >
      <button className="flex min-w-0 items-center gap-3 text-left disabled:cursor-not-allowed" disabled={disabled} type="button" onClick={onSelect}>
        <VoiceImage voice={voice} className="size-12 rounded-xl" />
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold">{voice.name}</h4>
          <p className="mt-1 text-xs capitalize text-muted-foreground">{voice.source} voice</p>
        </div>
        {selected ? <Check className="ml-auto size-4 shrink-0 text-primary" /> : null}
      </button>
      <Button className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary" disabled={disabled || loading} variant="outline" onClick={onPlay}>
        {loading ? <LoaderCircle className="animate-spin" /> : playing ? <Pause /> : <Play />}
        {playing ? "Pause" : "Preview"}
      </Button>
    </div>
  )
}

export function VoiceGroupIcon({ voices }: { voices: VoiceListItem[] }) {
  const voice = voices.find((item) => item.avatar_image_url) || voices[0]
  if (!voice) return <WandSparkles className="size-4" />

  return <VoiceImage voice={voice} className="size-8 rounded-xl" />
}

export function DefaultAvatarChoiceGroup({
  children,
  count,
}: {
  children: React.ReactNode
  count: number
}) {
  return (
    <ChoiceGroupCard
      contentClassName="max-h-[430px] overflow-y-auto overscroll-contain rounded-xl bg-muted/25 p-3 ring-1 ring-border/70"
      count={count}
      description="Studio-ready avatars bundled with the product."
      icon={<LayoutTemplate className="size-4" />}
      title="Default"
    >
      {children}
    </ChoiceGroupCard>
  )
}

export function CustomAvatarChoiceGroup({
  children,
  count,
}: {
  children: React.ReactNode
  count: number
}) {
  return (
    <ChoiceGroupCard
      contentClassName="max-h-[430px] overflow-y-auto overscroll-contain rounded-xl bg-muted/25 p-3 ring-1 ring-border/70"
      count={count}
      description="Your uploaded and AI-created characters."
      icon={<Sparkles className="size-4" />}
      title="Custom"
    >
      {children}
    </ChoiceGroupCard>
  )
}

export function AvatarRatioPreview({
  imageUrl,
  label,
  name,
  ratioClassName,
}: {
  imageUrl: string
  label: string
  name: string
  ratioClassName: string
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", ratioClassName)}>
      {imageUrl ? (
        <img alt={`${name} ${label}`} className="size-full object-cover" src={imageUrl} />
      ) : (
        <div className="grid size-full place-items-center text-muted-foreground">
          <Mic2 className="size-4" />
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-medium leading-none text-foreground shadow-sm ring-1 ring-border/70">
        {label}
      </span>
    </div>
  )
}

export function VoiceImage({ className, voice }: { className?: string; voice: Pick<VoiceListItem, "avatar_image_url" | "name"> }) {
  const [failed, setFailed] = useState(false)
  const initials = getVoiceInitials(voice.name)

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden bg-foreground text-xs font-semibold text-background shadow-sm",
        className
      )}
    >
      {voice.avatar_image_url && !failed ? (
        <img alt={voice.name} className="size-full object-cover" src={voice.avatar_image_url} onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </span>
  )
}

export function getAvatarPreviewImageUrl(avatar: AiAvatar, aspectRatio: "16:9" | "9:16") {
  return aspectRatio === "9:16" ? getAvatarMobileImageUrl(avatar) : getAvatarDesktopImageUrl(avatar)
}

export function getAvatarDesktopImageUrl(avatar: AiAvatar) {
  return avatar.desktop_image_url || avatar.image_url
}

export function getAvatarMobileImageUrl(avatar: AiAvatar) {
  return avatar.mobile_image_url || avatar.image_url
}

function getVoiceInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "V"
}
