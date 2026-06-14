"use client"

import Link from "next/link"
import {
  Bot,
  CalendarDays,
  Check,
  CircleCheck,
  CircleDollarSign,
  Download,
  Eye,
  Film,
  Maximize2,
  Mic2,
  MousePointerClick,
  Play,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react"
import type React from "react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { aiVideoAgentBRollStyleLabels, getAiVideoAgentStatusLabel, type AiVideoAgentProject } from "@/lib/ai-video-agent"
import type { AvatarStyle } from "@/lib/avatar-types"
import { getVideoAvatarStatusLabel, type AiVideoAvatarVideo } from "@/lib/video-avatar-types"
import type { AiTtsOutput, VoiceListItem } from "@/lib/voice-types"
import { getVoiceLanguageLabel } from "@/lib/voice-types"
import { cn } from "@/lib/utils"

type VoiceCardItem = VoiceListItem & {
  created_at?: string
}

export type AvatarCardModel = {
  desktopImageUrl: string
  mobileImageUrl: string
  name: string
  source: string
  style: AvatarStyle
}

export function VoiceAssetCard({
  deleting = false,
  onDelete,
  onPlay,
  onSelect,
  previewing = false,
  selecting = false,
  tone,
  voice,
}: {
  deleting?: boolean
  onDelete?: () => void
  onPlay?: () => void
  onSelect?: () => void
  previewing?: boolean
  selecting?: boolean
  tone: number
  voice: VoiceCardItem
}) {
  const readonly = !onSelect

  return (
    <div
      className={cn(
        "flex min-h-56 flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
        voice.is_selected ? "border-primary/60 ring-2 ring-primary/20" : "border-border/70"
      )}
    >
      <div className={cn("relative min-h-28 overflow-hidden", getVoiceGradient(tone))}>
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgb(255_255_255_/_0.28),transparent)]" />
        <div className="relative flex items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <VoiceAvatar imageUrl={voice.avatar_image_url} name={voice.name} />
            <div className="min-w-0">
              <h4 className="truncate text-base font-semibold text-white">{voice.name}</h4>
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-white/78">
                {voice.source === "custom" ? voice.preview_text || "Reference audio saved." : voice.preview_text}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge className="border-white/20 bg-white/16 text-white" variant="outline">
              {voice.source === "custom" ? "Custom" : "Default"}
            </Badge>
            <Badge className="border-white/20 bg-white/16 text-white" variant="outline">
              {voice.source === "custom" ? "Multilingual" : getVoiceLanguageLabel(voice.language)}
            </Badge>
            {voice.created_at ? (
              <Badge className="border-white/20 bg-white/16 text-white" variant="outline">
                {formatDate(voice.created_at)}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-auto grid gap-3 p-4">
        <div className={cn("grid gap-2", voice.source === "custom" && onDelete ? "grid-cols-3" : readonly ? "grid-cols-1" : "grid-cols-2")}>
          {onPlay ? (
            <Button variant="outline" onClick={onPlay}>
              {previewing ? <Spinner /> : <Play />}
              {voice.source === "custom" ? "Sample" : "Preview"}
            </Button>
          ) : null}
          {onSelect ? (
            <Button disabled={selecting || voice.is_selected} variant={voice.is_selected ? "outline" : "default"} onClick={onSelect}>
              {selecting ? <Spinner /> : voice.is_selected ? <CircleCheck /> : <MousePointerClick />}
              {voice.is_selected ? "Selected" : "Use"}
            </Button>
          ) : null}
          {voice.source === "custom" && onDelete ? (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" disabled={deleting} />}>
                {deleting ? <Spinner /> : <Trash2 />}
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete custom voice?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes {voice.name} from your custom voice library. Generated TTS history will stay available.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" disabled={deleting} onClick={onDelete}>
                    {deleting ? <Spinner /> : <Trash2 />}
                    Delete voice
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
        {readonly && voice.sample_audio_url ? <audio className="w-full" controls src={voice.sample_audio_url} /> : null}
      </div>
    </div>
  )
}

export function GeneratedAudioAssetCard({
  deleting = false,
  onDelete,
  output,
  voices,
}: {
  deleting?: boolean
  onDelete?: () => void
  output: AiTtsOutput
  voices: VoiceListItem[]
}) {
  const voice = voices.find((item) => {
    if (output.voice_clone_id && item.id === output.voice_clone_id) return true
    if (output.provider_voice_id && item.provider_voice_id === output.provider_voice_id) return true
    return item.name === output.voice_name
  })

  return (
    <div className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md lg:grid-cols-[72px_minmax(0,1fr)_320px_auto] lg:items-center">
      <GeneratedVoiceAvatar imageUrl={voice?.avatar_image_url || ""} name={output.voice_name} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={output.voice_source === "custom" ? "default" : "secondary"}>
            {output.voice_source === "custom" ? "Custom" : "Default"}
          </Badge>
          <Badge variant="outline">{output.audio_format.toUpperCase()}</Badge>
          <Badge variant="outline">{getVoiceLanguageLabel(output.language)}</Badge>
          <Badge variant="outline">
            <CircleDollarSign className="size-3.5" />
            {output.credits_cost} credits
          </Badge>
          <Badge variant="outline">{formatDate(output.created_at)}</Badge>
        </div>
        <h4 className="mt-3 text-base font-semibold">{output.voice_name}</h4>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{output.text}</p>
      </div>
      <audio className="w-full self-center" controls src={output.audio_url} />
      {onDelete ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button className="justify-self-start lg:justify-self-end" size="icon" variant="destructive" disabled={deleting} />}>
            {deleting ? <Spinner /> : <Trash2 />}
            <span className="sr-only">Delete generated audio</span>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete generated audio?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the audio clip generated with {output.voice_name} from your TTS history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={deleting} onClick={onDelete}>
                {deleting ? <Spinner /> : <Trash2 />}
                Delete audio
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  )
}

export function AvatarAssetCard({
  actionLabel,
  avatar,
  deleting = false,
  desktopImageLoaded = true,
  disabled,
  imageLoadingEnabled = true,
  mobileImageLoaded = true,
  metadataOnly = false,
  onAction,
  onDelete,
  onDesktopImageLoad = () => {},
  onMobileImageLoad = () => {},
  placeholderTone = 0,
  selected,
}: {
  actionLabel?: string
  avatar: AvatarCardModel
  deleting?: boolean
  desktopImageLoaded?: boolean
  disabled?: boolean
  imageLoadingEnabled?: boolean
  mobileImageLoaded?: boolean
  metadataOnly?: boolean
  selected?: boolean
  placeholderTone?: number
  onDesktopImageLoad?: () => void
  onMobileImageLoad?: () => void
  onAction?: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        selected ? "border-primary/60 ring-2 ring-primary/20" : "border-border/70"
      )}
    >
      {metadataOnly ? (
        <div className="flex flex-wrap gap-2 px-3 pb-2 pt-3">
          <Skeleton className="h-6 w-11 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 px-3 pb-2 pt-3">
          <Badge variant={avatar.source === "default" ? "secondary" : "default"}>
            {avatar.source === "ai" ? "Generated" : avatar.source === "upload" ? "Uploaded" : "Default"}
          </Badge>
          <Badge variant="outline">{avatar.style}</Badge>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(74px,0.52fr)] items-center gap-2 px-3 pb-3">
        <AvatarRatioAssetPreview
          imageLoaded={desktopImageLoaded}
          imageUrl={avatar.desktopImageUrl}
          label="16:9"
          name={avatar.name}
          placeholderTone={placeholderTone}
          ratioClassName="aspect-video"
          shouldLoadImage={imageLoadingEnabled}
          showLabel={!metadataOnly}
          onImageLoad={onDesktopImageLoad}
        />
        <AvatarRatioAssetPreview
          imageLoaded={mobileImageLoaded}
          imageUrl={avatar.mobileImageUrl}
          label="9:16"
          name={avatar.name}
          placeholderTone={placeholderTone}
          ratioClassName="aspect-[9/16]"
          shouldLoadImage={imageLoadingEnabled}
          showLabel={!metadataOnly}
          onImageLoad={onMobileImageLoad}
        />
      </div>

      <div className="mt-auto space-y-4 border-t border-border/60 bg-muted/20 p-4">
        <div className="min-w-0 pt-1">
          {metadataOnly ? <Skeleton className="h-4 w-2/3" /> : <h4 className="truncate text-sm font-semibold">{avatar.name}</h4>}
        </div>
        {metadataOnly ? (
          <Skeleton className="h-9 w-full" />
        ) : onAction || onDelete ? (
          <div className={cn("grid gap-2", onAction && onDelete ? "grid-cols-2" : "grid-cols-1")}>
            {onAction ? (
              <Button className="w-full" disabled={disabled} variant={selected ? "outline" : "default"} onClick={onAction}>
                <Check />
                {actionLabel || "Use"}
              </Button>
            ) : null}
            {onDelete ? (
              <AlertDialog>
                <AlertDialogTrigger render={<Button className="w-full" disabled={deleting} variant="destructive" />}>
                  {deleting ? <Spinner /> : <Trash2 />}
                  Delete
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete avatar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes {avatar.name} from your saved avatar library.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={deleting} onClick={onDelete}>
                      {deleting ? <Spinner /> : <Trash2 />}
                      Delete avatar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function AiVideoAgentProjectCard({
  deleting = false,
  onDelete,
  onPreview,
  project,
}: {
  deleting?: boolean
  onDelete?: () => void
  onPreview: () => void
  project: AiVideoAgentProject
}) {
  const createdAt = formatDate(project.created_at)

  return (
    <article className="group flex min-h-[430px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
      <div className={cn("relative overflow-hidden bg-muted", project.aspect_ratio === "9:16" ? "aspect-[9/12]" : "aspect-video")}>
        {project.thumbnail_url ? (
          <img alt={project.title} className="size-full object-cover transition group-hover:scale-[1.03]" src={project.thumbnail_url} />
        ) : (
          <div className="grid size-full place-items-center bg-[linear-gradient(135deg,#0f766e,#2563eb,#7c3aed)] text-white">
            <Film className="size-10" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge variant={project.status === "completed" ? "default" : project.status === "failed" ? "destructive" : "secondary"}>
            {getAiVideoAgentStatusLabel(project.status)}
          </Badge>
          <Badge className="bg-background/90" variant="outline">{project.aspect_ratio}</Badge>
          <Badge className="bg-background/90" variant="outline">{project.duration_seconds}s</Badge>
        </div>
        <Button aria-label="Preview project" className="absolute bottom-3 right-3 shadow-md" size="icon" variant="secondary" onClick={onPreview}>
          <Play />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{project.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{project.script || project.topic}</p>
        </div>
        <div className="grid gap-2 text-sm">
          <MetadataRow label="Scenes" value={`${project.scene_count}`} />
          <MetadataRow label="Avatar" value={project.avatar_name || "Avatar"} />
          <MetadataRow label="Voice" value={project.voice_name || "Voice"} />
          <MetadataRow label="Video style" value={aiVideoAgentBRollStyleLabels[project.b_roll_style]} />
          <MetadataRow label="Created" value={createdAt} />
        </div>
        {project.error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{project.error}</p> : null}
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button className="border-cyan-300/55 bg-cyan-400/10 text-cyan-700 shadow-[0_0_16px_rgba(34,211,238,.12)] transition hover:-translate-y-0.5 hover:bg-cyan-400/18 hover:shadow-[0_0_26px_rgba(34,211,238,.26)] dark:text-cyan-200" variant="outline" onClick={onPreview}>
            <Eye />
            Preview
          </Button>
          {onDelete ? (
            <Button className="border-rose-300/60 bg-rose-500/10 text-rose-700 shadow-[0_0_16px_rgba(244,63,94,.12)] transition hover:-translate-y-0.5 hover:bg-rose-500/18 hover:shadow-[0_0_26px_rgba(244,63,94,.28)] dark:text-rose-200" disabled={deleting} variant="outline" onClick={onDelete}>
              <Trash2 />
              {deleting ? "Deleting" : "Delete"}
            </Button>
          ) : null}
          <Button className="border-violet-300/55 bg-violet-400/10 text-violet-700 shadow-[0_0_16px_rgba(167,139,250,.12)] transition hover:-translate-y-0.5 hover:bg-violet-400/18 hover:shadow-[0_0_26px_rgba(167,139,250,.26)] dark:text-violet-200" disabled={!project.final_video_url} nativeButton={false} render={project.final_video_url ? <a href={project.final_video_url} download /> : undefined} variant="outline">
            <Download />
            Download
          </Button>
          <Button className="border-emerald-300/55 bg-emerald-400/10 text-emerald-700 shadow-[0_0_16px_rgba(52,211,153,.12)] transition hover:-translate-y-0.5 hover:bg-emerald-400/18 hover:shadow-[0_0_26px_rgba(52,211,153,.26)] dark:text-emerald-200" nativeButton={false} render={<Link href={`/dashboard/ai-video-agent/${project.id}`} />} variant="outline">
            <Film />
            Open
          </Button>
        </div>
      </div>
    </article>
  )
}

export function AiVideoAvatarVideoCard({
  deleting = false,
  onPreview,
  onRequestDelete,
  video,
}: {
  deleting?: boolean
  onPreview: () => void
  onRequestDelete?: () => void
  video: AiVideoAvatarVideo
}) {
  const completed = video.status === "completed" && Boolean(video.video_url)
  const createdAt = formatDate(video.created_at)

  return (
    <article className="group flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className={cn("relative overflow-hidden bg-muted", video.aspect_ratio === "9:16" ? "aspect-[9/12]" : "aspect-video")}>
        {video.thumbnail_url ? (
          <img alt={video.title} className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" src={video.thumbnail_url} />
        ) : video.avatar_image_url ? (
          <img alt={video.avatar_name} className="size-full object-cover opacity-80 transition duration-300 group-hover:scale-[1.03]" src={video.avatar_image_url} />
        ) : (
          <div className="grid size-full place-items-center bg-[linear-gradient(135deg,#0f766e,#2563eb)] text-white">
            <Film className="size-10" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge variant={video.status === "completed" ? "default" : video.status === "failed" ? "destructive" : "secondary"}>
            {getVideoAvatarStatusLabel(video.status)}
          </Badge>
          <Badge className="bg-background/90" variant="outline">{video.aspect_ratio}</Badge>
          <Badge className="bg-background/90" variant="outline">{video.duration_seconds}s</Badge>
        </div>
        <Button
          aria-label="Preview video"
          className="absolute bottom-3 right-3 shadow-md"
          disabled={!completed}
          size="icon"
          variant="secondary"
          onClick={onPreview}
        >
          <Play />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{video.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{video.script}</p>
        </div>

        <div className="grid gap-2 text-sm">
          <IconMetadataRow icon={<UserRound className="size-4" />} label="Avatar" value={video.avatar_name || "Avatar"} />
          <IconMetadataRow icon={<WandSparkles className="size-4" />} label="Voice" value={video.voice_name || "Voice"} />
          <IconMetadataRow icon={<CalendarDays className="size-4" />} label="Created" value={createdAt} />
        </div>

        {video.error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{video.error}</p> : null}

        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button
            className="border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100 hover:text-sky-800 hover:shadow-md dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:bg-sky-400/20"
            disabled={!completed}
            variant="outline"
            onClick={onPreview}
          >
            <Eye />
            Preview
          </Button>
          <Button
            className="border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 hover:shadow-md dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/20"
            disabled={!completed}
            nativeButton={false}
            render={completed ? <a href={video.video_url} download /> : undefined}
            variant="outline"
          >
            <Download />
            Download
          </Button>
          <Button
            className="border-violet-200 bg-violet-50 text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800 hover:shadow-md dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-200 dark:hover:bg-violet-400/20"
            nativeButton={false}
            render={<Link href={`/dashboard/ai-video-avatar/${video.id}`} />}
            variant="outline"
          >
            <Maximize2 />
            Open
          </Button>
          {onRequestDelete ? (
            <Button
              className="border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800 hover:shadow-md dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/20"
              disabled={deleting}
              variant="outline"
              onClick={onRequestDelete}
            >
              <Trash2 />
              {deleting ? "Deleting" : "Delete"}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function VoiceAvatar({ imageUrl, name }: { imageUrl: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/20 bg-white/16 text-sm font-semibold text-white shadow-sm">
      {imageUrl && !failed ? (
        <img alt={name} className="size-full object-cover" src={imageUrl} onError={() => setFailed(true)} />
      ) : (
        initials || <Mic2 className="size-5" />
      )}
    </div>
  )
}

function GeneratedVoiceAvatar({ imageUrl, name }: { imageUrl: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="grid size-16 place-items-center overflow-hidden rounded-xl border border-border/70 bg-[linear-gradient(135deg,#0f766e,#2563eb)] text-sm font-semibold text-white shadow-sm">
      {imageUrl && !failed ? (
        <img alt={name} className="size-full object-cover" src={imageUrl} onError={() => setFailed(true)} />
      ) : (
        initials || <Bot className="size-6" />
      )}
    </div>
  )
}

function AvatarRatioAssetPreview({
  imageLoaded,
  imageUrl,
  label,
  name,
  onImageLoad,
  placeholderTone,
  ratioClassName,
  shouldLoadImage,
  showLabel,
}: {
  imageLoaded: boolean
  imageUrl: string
  label: string
  name: string
  onImageLoad: () => void
  placeholderTone: number
  ratioClassName: string
  shouldLoadImage: boolean
  showLabel: boolean
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg", getAvatarPlaceholderClassName(placeholderTone), ratioClassName)}>
      {!imageLoaded ? (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_24%,rgb(255_255_255_/_0.55),transparent_34%),linear-gradient(115deg,transparent_0%,rgb(255_255_255_/_0.32)_46%,transparent_68%)] opacity-80 dark:bg-[radial-gradient(circle_at_30%_24%,rgb(255_255_255_/_0.10),transparent_34%),linear-gradient(115deg,transparent_0%,rgb(255_255_255_/_0.08)_46%,transparent_68%)]"
        />
      ) : null}
      {shouldLoadImage ? (
        <img
          alt={`${name} ${label}`}
          className={cn("size-full object-cover opacity-0 transition-opacity duration-500", imageLoaded && "opacity-100")}
          src={imageUrl}
          onLoad={onImageLoad}
        />
      ) : null}
      {showLabel ? (
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-medium leading-none text-foreground shadow-sm ring-1 ring-border/70">
          {label}
        </span>
      ) : null}
    </div>
  )
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <span className="shrink-0 text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  )
}

function IconMetadataRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="shrink-0 text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getVoiceGradient(tone: number) {
  const tones = [
    "bg-[linear-gradient(135deg,#0f766e,#2563eb)]",
    "bg-[linear-gradient(135deg,#be123c,#7c3aed)]",
    "bg-[linear-gradient(135deg,#047857,#ca8a04)]",
    "bg-[linear-gradient(135deg,#1d4ed8,#db2777)]",
  ]

  return tones[tone % tones.length]
}

function getAvatarPlaceholderClassName(tone: number) {
  const tones = [
    "bg-muted/80 dark:bg-white/[0.065]",
    "bg-secondary/70 dark:bg-white/[0.075]",
    "bg-muted/65 dark:bg-white/[0.055]",
    "bg-accent/20 dark:bg-white/[0.085]",
  ]

  return tones[tone % tones.length]
}
