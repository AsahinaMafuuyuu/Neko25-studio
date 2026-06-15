"use client"

import {
  Bot,
  Database,
  Film,
  FolderKanban,
  ImageIcon,
  Mic2,
  RefreshCcw,
  RotateCcw,
  Search,
  Video,
} from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  AiVideoAgentProjectCard,
  AiVideoAvatarVideoCard,
  AvatarAssetCard,
  GeneratedAudioAssetCard,
  VoiceAssetCard,
} from "@/components/dashboard/library-asset-cards"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getAvatarDesktopImageUrl, getAvatarMobileImageUrl } from "@/components/dashboard/media-choice-components"
import type { AiVideoAgentProject } from "@/lib/ai-video-agent"
import type { AiAvatar } from "@/lib/avatar-types"
import { getValidAccessToken, refreshSession } from "@/lib/insforge"
import type { AiVideoAvatarVideo } from "@/lib/video-avatar-types"
import type { AiTtsOutput, AiVoiceClone, VoiceListItem } from "@/lib/voice-types"
import { cn } from "@/lib/utils"

type LibraryTab = "all" | "voice" | "avatar" | "video_agent" | "video_avatar"

type LibraryFilters = {
  query: string
  fromDate: string
  toDate: string
  tab: LibraryTab
}

type LibraryPayload = {
  voices: AiVoiceClone[]
  ttsOutputs: AiTtsOutput[]
  avatars: AiAvatar[]
  aiVideoAgentProjects: AiVideoAgentProject[]
  aiVideoAvatarVideos: AiVideoAvatarVideo[]
  stats: {
    totalAssets: number
    videos: number
    voices: number
    storageBytes: number
    storageLabel: string
  }
}

const tabs: Array<{ icon: React.ReactNode; label: string; value: LibraryTab }> = [
  { icon: <FolderKanban className="size-4" />, label: "All Project", value: "all" },
  { icon: <Mic2 className="size-4" />, label: "AI Voice", value: "voice" },
  { icon: <ImageIcon className="size-4" />, label: "AI Avatar", value: "avatar" },
  { icon: <Bot className="size-4" />, label: "AI Video Agent", value: "video_agent" },
  { icon: <Video className="size-4" />, label: "AI Video Avatar", value: "video_avatar" },
]

export function MyLibraryPage() {
  const [data, setData] = useState<LibraryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filters, setFilters] = useState<LibraryFilters>({
    query: "",
    fromDate: "",
    toDate: "",
    tab: "all",
  })
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [previewVideo, setPreviewVideo] = useState<AiVideoAvatarVideo | null>(null)
  const [previewProject, setPreviewProject] = useState<AiVideoAgentProject | null>(null)
  const [previewingVoiceId, setPreviewingVoiceId] = useState("")
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const loadLibrary = useCallback(async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading) setLoading(true)
    try {
      const response = await apiFetch("/api/library")
      const body = await readJson<LibraryPayload>(response)
      setError("")
      setData(body)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load library assets.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadLibrary()
    }, 0)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [loadLibrary])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(filters.query), 250)
    return () => window.clearTimeout(timeout)
  }, [filters.query])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  const libraryVoices = useMemo(() => (data?.voices || []).map(toLibraryVoiceItem), [data?.voices])
  const filtered = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase()
    const fromTime = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`).getTime() : null
    const toTime = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`).getTime() : null
    const inDateRange = (createdAt: string) => {
      const time = new Date(createdAt).getTime()
      if (!Number.isFinite(time)) return true
      if (fromTime !== null && time < fromTime) return false
      if (toTime !== null && time > toTime) return false
      return true
    }
    const matches = (parts: Array<string | null | undefined>) => !query || parts.some((part) => part?.toLowerCase().includes(query))

    return {
      voices: libraryVoices.filter((voice) => inDateRange(voice.created_at) && matches([voice.name, voice.preview_text, voice.sample_transcript])),
      ttsOutputs: (data?.ttsOutputs || []).filter((output) => inDateRange(output.created_at) && matches([output.voice_name, output.text, output.language])),
      avatars: (data?.avatars || []).filter((avatar) => inDateRange(avatar.created_at) && matches([avatar.name, avatar.style, avatar.source])),
      aiVideoAgentProjects: (data?.aiVideoAgentProjects || []).filter((project) =>
        inDateRange(project.created_at) && matches([project.title, project.topic, project.script, project.avatar_name, project.voice_name])
      ),
      aiVideoAvatarVideos: (data?.aiVideoAvatarVideos || []).filter((video) =>
        inDateRange(video.created_at) && matches([video.title, video.script, video.avatar_name, video.voice_name])
      ),
    }
  }, [data, debouncedQuery, filters.fromDate, filters.toDate, libraryVoices])

  const visibleStats = useMemo(() => {
    const videos = filtered.aiVideoAgentProjects.length + filtered.aiVideoAvatarVideos.length
    const voices = filtered.voices.length + filtered.ttsOutputs.length
    return {
      totalAssets: videos + voices + filtered.avatars.length,
      videos,
      voices,
      storageLabel: data?.stats.storageLabel || "0 MB",
    }
  }, [data?.stats.storageLabel, filtered])

  async function playVoiceSample(voice: VoiceListItem & { created_at: string }) {
    const source = voice.preview_audio_url || voice.sample_audio_url
    if (!source) return

    if (previewingVoiceId === voice.id) {
      audioRef.current?.pause()
      setPreviewingVoiceId("")
      return
    }

    audioRef.current?.pause()
    const audio = new Audio(source)
    audioRef.current = audio
    setPreviewingVoiceId(voice.id)
    audio.onended = () => setPreviewingVoiceId("")
    audio.onerror = () => setPreviewingVoiceId("")
    await audio.play().catch(() => setPreviewingVoiceId(""))
  }

  function resetFilters() {
    setFilters({
      query: "",
      fromDate: "",
      toDate: "",
      tab: "all",
    })
    setDebouncedQuery("")
  }

  const showVoice = filters.tab === "all" || filters.tab === "voice"
  const showAvatar = filters.tab === "all" || filters.tab === "avatar"
  const showVideoAgent = filters.tab === "all" || filters.tab === "video_agent"
  const showVideoAvatar = filters.tab === "all" || filters.tab === "video_avatar"

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card/95 p-5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_12px_30px_rgb(0_0_0_/_0.05)] backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <FolderKanban className="size-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-background/70" variant="outline">Unified assets</Badge>
                <Badge className="bg-background/70" variant="outline">{visibleStats.totalAssets} visible</Badge>
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">My Library</h2>
            </div>
          </div>
          <Button variant="outline" onClick={() => loadLibrary({ showLoading: true })}>
            <RefreshCcw />
            Refresh
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-card/95 p-4 shadow-sm backdrop-blur-xl sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_170px_auto] lg:items-end">
          <div className="grid gap-2">
            <label className="text-xs font-medium uppercase text-muted-foreground" htmlFor="library-search">Search by name</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="library-search"
                className="pl-9"
                placeholder="Search assets by name..."
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium uppercase text-muted-foreground" htmlFor="library-from">From</label>
            <Input
              id="library-from"
              type="date"
              value={filters.fromDate}
              onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium uppercase text-muted-foreground" htmlFor="library-to">To</label>
            <Input
              id="library-to"
              type="date"
              value={filters.toDate}
              onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
            />
          </div>
          <Button className="lg:mb-0" variant="outline" onClick={resetFilters}>
            <RotateCcw />
            Reset filters
          </Button>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition hover:shadow-sm",
                filters.tab === tab.value
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
              )}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, tab: tab.value }))}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<FolderKanban className="size-5" />} label="Total Assets" value={loading ? "..." : String(visibleStats.totalAssets)} tone="primary" />
        <StatCard icon={<Film className="size-5" />} label="Videos" value={loading ? "..." : String(visibleStats.videos)} tone="sky" />
        <StatCard icon={<Mic2 className="size-5" />} label="Voices" value={loading ? "..." : String(visibleStats.voices)} tone="emerald" />
        <StatCard icon={<Database className="size-5" />} label="Storage Upload" value={loading ? "..." : visibleStats.storageLabel} tone="violet" />
      </section>

      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {loading ? <LibrarySkeleton /> : null}

      {!loading && showVoice ? (
        <LibrarySection count={filtered.voices.length + filtered.ttsOutputs.length} icon={<Mic2 className="size-5" />} title="AI Voice">
          {filtered.voices.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.voices.map((voice, index) => (
                <VoiceAssetCard
                  key={voice.id}
                  previewing={previewingVoiceId === voice.id}
                  tone={index}
                  voice={voice}
                  onPlay={() => playVoiceSample(voice)}
                />
              ))}
            </div>
          ) : null}
          {filtered.ttsOutputs.length ? (
            <div className="grid gap-4">
              {filtered.ttsOutputs.map((output) => (
                <GeneratedAudioAssetCard key={output.id} output={output} voices={libraryVoices} />
              ))}
            </div>
          ) : null}
          {!filtered.voices.length && !filtered.ttsOutputs.length ? <EmptyLibraryState label="No voice assets match the current filters." /> : null}
        </LibrarySection>
      ) : null}

      {!loading && showAvatar ? (
        <LibrarySection count={filtered.avatars.length} icon={<ImageIcon className="size-5" />} title="AI Avatar">
          {filtered.avatars.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.avatars.map((avatar, index) => (
                <AvatarAssetCard
                  key={avatar.id}
                  avatar={{
                    desktopImageUrl: getAvatarDesktopImageUrl(avatar),
                    mobileImageUrl: getAvatarMobileImageUrl(avatar),
                    name: avatar.name,
                    source: avatar.source,
                    style: avatar.style,
                  }}
                  placeholderTone={index % 4}
                />
              ))}
            </div>
          ) : (
            <EmptyLibraryState label="No avatars match the current filters." />
          )}
        </LibrarySection>
      ) : null}

      {!loading && showVideoAgent ? (
        <LibrarySection count={filtered.aiVideoAgentProjects.length} icon={<Bot className="size-5" />} title="AI Video Agent">
          {filtered.aiVideoAgentProjects.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.aiVideoAgentProjects.map((project) => (
                <AiVideoAgentProjectCard key={project.id} project={project} onPreview={() => setPreviewProject(project)} />
              ))}
            </div>
          ) : (
            <EmptyLibraryState label="No AI Video Agent projects match the current filters." />
          )}
        </LibrarySection>
      ) : null}

      {!loading && showVideoAvatar ? (
        <LibrarySection count={filtered.aiVideoAvatarVideos.length} icon={<Video className="size-5" />} title="AI Video Avatar">
          {filtered.aiVideoAvatarVideos.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.aiVideoAvatarVideos.map((video) => (
                <AiVideoAvatarVideoCard key={video.id} video={video} onPreview={() => setPreviewVideo(video)} />
              ))}
            </div>
          ) : (
            <EmptyLibraryState label="No AI Video Avatar videos match the current filters." />
          )}
        </LibrarySection>
      ) : null}

      <Dialog open={Boolean(previewVideo)} onOpenChange={(open) => !open && setPreviewVideo(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewVideo?.title || "Video preview"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-xl border border-border bg-muted">
            {previewVideo?.video_url ? (
              <video className="aspect-video w-full bg-black" controls src={previewVideo.video_url} />
            ) : (
              <div className="grid aspect-video place-items-center text-sm text-muted-foreground">
                Video output is not ready yet.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewProject)} onOpenChange={(open) => !open && setPreviewProject(null)}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewProject?.title || "Project preview"}</DialogTitle>
          </DialogHeader>
          <div className={cn("mx-auto overflow-hidden rounded-xl border border-border bg-black", previewProject?.aspect_ratio === "9:16" ? "aspect-[9/16] max-h-[76vh] w-full max-w-sm" : "aspect-video w-full")}>
            {previewProject?.final_video_url ? (
              <video className="size-full object-contain" controls src={previewProject.final_video_url} />
            ) : previewProject?.thumbnail_url ? (
              <img alt={previewProject.title} className="size-full object-contain" src={previewProject.thumbnail_url} />
            ) : (
              <div className="grid size-full place-items-center text-sm text-white/70">Preview is not ready yet.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LibrarySection({
  children,
  count,
  icon,
  title,
}: {
  children: React.ReactNode
  count: number
  icon: React.ReactNode
  title: string
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-xl sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            {icon}
          </span>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        </div>
        <Badge variant="outline">{count}</Badge>
      </div>
      {children}
    </section>
  )
}

function StatCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ReactNode
  label: string
  tone: "primary" | "sky" | "emerald" | "violet"
  value: string
}) {
  const tones = {
    primary: "bg-primary/10 text-primary ring-primary/15",
    sky: "bg-primary/10 text-primary ring-primary/15",
    emerald: "bg-primary/10 text-primary ring-primary/15",
    violet: "bg-primary/10 text-primary ring-primary/15",
  }

  return (
    <div className="group rounded-lg border border-border/70 bg-card/95 p-4 shadow-sm transition duration-200 hover:border-border hover:shadow-[0_10px_28px_rgb(0_0_0_/_0.07)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className={cn("grid size-11 place-items-center rounded-lg ring-1", tones[tone])}>{icon}</span>
      </div>
    </div>
  )
}

function EmptyLibraryState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/60 p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function LibrarySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-border/70 bg-card/95 p-4 shadow-sm">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="mt-4 h-5 w-2/3" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}

function toLibraryVoiceItem(voice: AiVoiceClone): VoiceListItem & { created_at: string } {
  return {
    id: voice.id,
    name: voice.name,
    source: "custom",
    provider: "qwen3-tts",
    language: voice.language,
    sample_audio_url: voice.sample_audio_url,
    sample_transcript: voice.sample_transcript,
    sample_detected_language: voice.sample_detected_language,
    preview_text: voice.sample_transcript,
    preview_audio_url: voice.preview_audio_url,
    avatar_image_url: voice.avatar_image_url,
    is_selected: voice.is_selected,
    created_at: voice.created_at,
  }
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await getValidAccessToken()
  if (!token) throw new Error("Your session has expired. Please sign in again.")

  const makeRequest = (accessToken: string) => {
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${accessToken}`)

    return fetch(path, {
      ...init,
      headers,
    })
  }

  const response = await makeRequest(token)
  if (response.status !== 401) return response

  const refreshed = await refreshSession().catch(() => null)
  if (!refreshed?.accessToken) return response

  return makeRequest(refreshed.accessToken)
}

async function readJson<T>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (!response.ok) throw new Error(body.message || "Request failed.")
  return body
}
