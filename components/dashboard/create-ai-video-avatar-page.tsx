"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  Clock3,
  Film,
  LayoutTemplate,
  LoaderCircle,
  Mic2,
  Play,
  RefreshCcw,
  Sparkles,
  UserRound,
  WandSparkles,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { showAppToast } from "@/components/ui/app-toast"
import { getValidAccessToken, refreshSession } from "@/lib/insforge"
import type { AiAvatar } from "@/lib/avatar-types"
import type { VoiceListItem } from "@/lib/voice-types"
import type { AiVideoAvatarJob, AiVideoAvatarVideo, ScriptTone, VideoAvatarAspectRatio, VideoAvatarDuration } from "@/lib/video-avatar-types"
import {
  getVideoAvatarCreditCost,
  scriptToneOptions,
  videoAvatarDurations,
} from "@/lib/video-avatar-types"
import { cn } from "@/lib/utils"

const activeStatuses = new Set(["queued", "running", "generating", "uploading"])
const maxScriptCharacters = 2000

export function CreateAiVideoAvatarPage() {
  const router = useRouter()
  const [avatars, setAvatars] = useState<AiAvatar[]>([])
  const [voices, setVoices] = useState<VoiceListItem[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("New avatar video")
  const [scriptMode, setScriptMode] = useState<"manual" | "ai">("manual")
  const [script, setScript] = useState("")
  const [topic, setTopic] = useState("")
  const [tone, setTone] = useState<ScriptTone>("professional")
  const [selectedAvatarId, setSelectedAvatarId] = useState("")
  const [selectedVoiceId, setSelectedVoiceId] = useState("")
  const [aspectRatio, setAspectRatio] = useState<VideoAvatarAspectRatio>("16:9")
  const [durationSeconds, setDurationSeconds] = useState<VideoAvatarDuration>(10)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeJob, setActiveJob] = useState<AiVideoAvatarJob | null>(null)
  const [outputVideo, setOutputVideo] = useState<AiVideoAvatarVideo | null>(null)
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState("")
  const [error, setError] = useState("")
  const pollRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const defaultPreviewUrlsRef = useRef<Record<string, string>>({})
  const completedVideoIdRef = useRef("")

  const selectedAvatar = useMemo(
    () => avatars.find((avatar) => avatar.id === selectedAvatarId) || avatars.find((avatar) => avatar.is_selected) || avatars[0] || null,
    [avatars, selectedAvatarId]
  )
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) || voices.find((voice) => voice.is_selected) || voices[0] || null,
    [voices, selectedVoiceId]
  )
  const groupedAvatars = useMemo(() => ({
    custom: avatars.filter((avatar) => avatar.source !== "default"),
    default: avatars.filter((avatar) => avatar.source === "default"),
  }), [avatars])
  const groupedVoices = useMemo(() => ({
    custom: voices.filter((voice) => voice.source === "custom"),
    default: voices.filter((voice) => voice.source === "default"),
  }), [voices])
  const estimatedCredits = useMemo(
    () =>
      getVideoAvatarCreditCost({
        avatarSource: selectedAvatar?.source,
        durationSeconds,
        voiceSource: selectedVoice?.source,
      }),
    [durationSeconds, selectedAvatar?.source, selectedVoice?.source]
  )
  const scriptLength = Array.from(script.trim()).length
  const isActive = activeJob ? activeStatuses.has(activeJob.status) : false
  const canSubmit =
    Boolean(title.trim() && script.trim() && selectedAvatar?.id && selectedVoice?.id && aspectRatio && durationSeconds) &&
    scriptLength <= maxScriptCharacters &&
    !submitting &&
    !isActive

  const resetForAnother = useCallback(() => {
    setCompletionDialogOpen(false)
    setActiveJob(null)
    setOutputVideo(null)
    setScript("")
    setTitle("New avatar video")
  }, [])

  const loadAvatars = useCallback(async () => {
    const response = await apiFetch("/api/avatars")
    const body = await readJson<{ avatars: AiAvatar[] }>(response)
    setAvatars(body.avatars)
    setSelectedAvatarId((current) => current || body.avatars.find((avatar) => avatar.is_selected)?.id || body.avatars[0]?.id || "")
  }, [])

  const loadVoices = useCallback(async () => {
    const response = await apiFetch("/api/voices")
    const body = await readJson<{ voices: VoiceListItem[]; creditBalance: number }>(response)
    setVoices(body.voices)
    setCreditBalance(body.creditBalance)
    setSelectedVoiceId((current) => current || body.voices.find((voice) => voice.is_selected)?.id || body.voices[0]?.id || "")
  }, [])

  async function generateScript() {
    if (!topic.trim() || generatingScript) return

    setGeneratingScript(true)
    setError("")

    try {
      const response = await apiFetch("/api/ai-video-avatars/script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          tone,
          durationSeconds,
        }),
      })
      const body = await readJson<{ script: string }>(response)
      setScript(body.script)
      setScriptMode("manual")
      showAppToast("Script generated.", {
        description: "Review and edit it before generating the video.",
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not generate script.")
    } finally {
      setGeneratingScript(false)
    }
  }

  async function submit() {
    if (!canSubmit || !selectedAvatar || !selectedVoice) return

    setSubmitting(true)
    setError("")
    setOutputVideo(null)

    try {
      const response = await apiFetch("/api/ai-video-avatars/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          script,
          avatarId: selectedAvatar.id,
          voiceId: selectedVoice.id,
          aspectRatio,
          durationSeconds,
        }),
      })
      const body = await readJson<{
        job: AiVideoAvatarJob
        video: AiVideoAvatarVideo
        creditBalance: number
      }>(response)
      setActiveJob(body.job)
      setOutputVideo(body.video)
      setCreditBalance(body.creditBalance)
      showAppToast("Avatar video generation started.", {
        description: `${body.video.credits_cost} credits were reserved.`,
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start generation.")
    } finally {
      setSubmitting(false)
    }
  }

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const response = await apiFetch(`/api/ai-video-avatars/jobs/${jobId}`)
      const body = await readJson<{
        job: AiVideoAvatarJob
        video: AiVideoAvatarVideo | null
        creditBalance: number | null
      }>(response)
      setActiveJob(body.job)
      if (body.video) setOutputVideo(body.video)
      if (typeof body.creditBalance === "number") setCreditBalance(body.creditBalance)

    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not refresh generation status.")
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const defaultPreviewUrls = defaultPreviewUrlsRef.current
    const timeout = window.setTimeout(() => {
      Promise.all([loadAvatars(), loadVoices()]).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      if (pollRef.current) window.clearInterval(pollRef.current)
      audioRef.current?.pause()
      Object.values(defaultPreviewUrls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [loadAvatars, loadVoices])

  useEffect(() => {
    if (!activeJob || !activeStatuses.has(activeJob.status)) return

    pollRef.current = window.setInterval(() => {
      pollJob(activeJob.id)
    }, 2500)

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [activeJob, pollJob])

  useEffect(() => {
    if (outputVideo?.status !== "completed" || !outputVideo.video_url) return
    if (completedVideoIdRef.current === outputVideo.id) return

    completedVideoIdRef.current = outputVideo.id
    setCompletionDialogOpen(true)
    showAppToast("Avatar video is ready.", {
      description: outputVideo.title || "Your video has been saved to the library.",
    })
  }, [outputVideo])

  async function playVoicePreview(voice: VoiceListItem) {
    setPreviewingVoiceId(voice.id)
    setError("")

    try {
      let audioUrl = voice.preview_audio_url || ""
      if (!audioUrl && voice.source === "custom") audioUrl = voice.sample_audio_url || ""

      if (!audioUrl && voice.source === "default") {
        audioUrl = defaultPreviewUrlsRef.current[voice.id] || ""
        if (!audioUrl) {
          const response = await apiFetch("/api/voices/preview", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ voiceId: voice.id }),
          })
          if (!response.ok) {
            const body = (await response.json().catch(() => ({}))) as { message?: string }
            throw new Error(body.message || "Could not generate voice preview.")
          }
          audioUrl = URL.createObjectURL(await response.blob())
          defaultPreviewUrlsRef.current[voice.id] = audioUrl
        }
      }

      if (!audioUrl) throw new Error("This voice does not have a preview yet.")

      audioRef.current?.pause()
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      await audio.play()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not play voice preview.")
    } finally {
      setPreviewingVoiceId("")
    }
  }

  if (loading) {
    return <CreateSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button nativeButton={false} render={<Link href="/dashboard/ai-video-avatar" />} variant="outline">
          <ArrowLeft />
          Library
        </Button>
        <div className="rounded-xl border border-border/70 bg-card px-4 py-2 text-sm shadow-sm">
          <span className="text-muted-foreground">Credits </span>
          <span className="font-semibold">{creditBalance ?? "..."}</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-5">
          <Panel title="Create AI Video Avatar" icon={<Film className="size-4" />}>
            <div className="grid gap-2">
              <Label htmlFor="video-title">Title</Label>
              <Input id="video-title" disabled={submitting || isActive} value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
          </Panel>

          <Panel title="Script" icon={<WandSparkles className="size-4" />}>
            <div className="flex rounded-lg border border-border bg-muted/20 p-1">
              {(["manual", "ai"] as const).map((mode) => (
                <button
                  key={mode}
                  className={cn(
                    "h-9 flex-1 rounded-md px-3 text-sm font-medium transition",
                    scriptMode === mode ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  disabled={submitting || isActive}
                  type="button"
                  onClick={() => setScriptMode(mode)}
                >
                  {mode === "manual" ? "Manual script" : "AI generated"}
                </button>
              ))}
            </div>

            {scriptMode === "ai" ? (
              <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="grid gap-2">
                  <Label htmlFor="script-topic">Topic</Label>
                  <Input
                    id="script-topic"
                    disabled={generatingScript || submitting || isActive}
                    placeholder="e.g. Introduce our new design automation tool"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tone</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {scriptToneOptions.map((item) => (
                      <button
                        key={item}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium capitalize transition",
                          tone === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                        )}
                        disabled={generatingScript || submitting || isActive}
                        type="button"
                        onClick={() => setTone(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <Button disabled={!topic.trim() || generatingScript} onClick={generateScript}>
                  {generatingScript ? <Spinner /> : <Sparkles />}
                  Generate Script
                </Button>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Textarea
                className="min-h-48 resize-none"
                disabled={submitting || isActive}
                maxLength={maxScriptCharacters}
                placeholder="Write or generate the spoken script..."
                value={script}
                onChange={(event) => setScript(event.target.value)}
              />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className={cn(scriptLength > maxScriptCharacters && "text-destructive")}>
                  {scriptLength} / {maxScriptCharacters} characters
                </span>
                <span>Scripts are sent to Agnes as generation prompt guidance.</span>
              </div>
            </div>
          </Panel>

          <Panel title="Avatar" icon={<UserRound className="size-4" />}>
            <div className="grid gap-4">
              <ChoiceGroupCard
                contentClassName="max-h-[430px] overflow-y-scroll overscroll-contain rounded-2xl bg-slate-950/[0.045] p-3 ring-1 ring-border/70 dark:bg-black/25"
                count={groupedAvatars.custom.length}
                description="Your uploaded and AI-created characters."
                icon={<Sparkles className="size-4" />}
                title="Custom"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {groupedAvatars.custom.map((avatar) => (
                    <AvatarChoice
                      key={avatar.id}
                      avatar={avatar}
                      selected={selectedAvatar?.id === avatar.id}
                      onSelect={() => setSelectedAvatarId(avatar.id)}
                    />
                  ))}
                </div>
                {!groupedAvatars.custom.length ? (
                  <ChoiceEmptyState message="Create an avatar first, then it will appear here." />
                ) : null}
              </ChoiceGroupCard>

              <ChoiceGroupCard
                contentClassName="max-h-[430px] overflow-y-scroll overscroll-contain rounded-2xl bg-slate-950/[0.045] p-3 ring-1 ring-border/70 dark:bg-black/25"
                count={groupedAvatars.default.length}
                description="Studio-ready avatars bundled with the product."
                icon={<LayoutTemplate className="size-4" />}
                title="Default"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {groupedAvatars.default.map((avatar) => (
                    <AvatarChoice
                      key={avatar.id}
                      avatar={avatar}
                      selected={selectedAvatar?.id === avatar.id}
                      onSelect={() => setSelectedAvatarId(avatar.id)}
                    />
                  ))}
                </div>
                {!groupedAvatars.default.length ? (
                  <ChoiceEmptyState message="Default avatars are still loading or unavailable." />
                ) : null}
              </ChoiceGroupCard>
            </div>
          </Panel>

          <Panel title="Voice" icon={<Mic2 className="size-4" />}>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChoiceGroupCard
                count={groupedVoices.custom.length}
                description="Cloned voices prepared from your samples."
                icon={<WandSparkles className="size-4" />}
                title="Custom"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {groupedVoices.custom.map((voice) => (
                    <VoiceChoice
                      key={voice.id}
                      previewing={previewingVoiceId === voice.id}
                      selected={selectedVoice?.id === voice.id}
                      voice={voice}
                      onPlay={() => playVoicePreview(voice)}
                      onSelect={() => setSelectedVoiceId(voice.id)}
                    />
                  ))}
                </div>
                {!groupedVoices.custom.length ? (
                  <ChoiceEmptyState message="Clone a voice to unlock custom narration." />
                ) : null}
              </ChoiceGroupCard>

              <ChoiceGroupCard
                count={groupedVoices.default.length}
                description="Curated voices for fast avatar generation."
                icon={<Mic2 className="size-4" />}
                title="Default"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {groupedVoices.default.map((voice) => (
                    <VoiceChoice
                      key={voice.id}
                      previewing={previewingVoiceId === voice.id}
                      selected={selectedVoice?.id === voice.id}
                      voice={voice}
                      onPlay={() => playVoicePreview(voice)}
                      onSelect={() => setSelectedVoiceId(voice.id)}
                    />
                  ))}
                </div>
                {!groupedVoices.default.length ? (
                  <ChoiceEmptyState message="Default voices are still loading or unavailable." />
                ) : null}
              </ChoiceGroupCard>
            </div>
          </Panel>

          <Panel title="Format and duration" icon={<LayoutTemplate className="size-4" />}>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="grid gap-2">
                <Label>Aspect ratio</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["16:9", "9:16"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      className={cn(
                        "rounded-xl border p-4 text-left transition hover:bg-muted/40",
                        aspectRatio === ratio ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card"
                      )}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                    >
                      <span className="text-sm font-semibold">{ratio}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{ratio === "16:9" ? "Landscape" : "Portrait"}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Duration</Label>
                <div className="grid grid-cols-5 gap-2">
                  {videoAvatarDurations.map((duration) => (
                    <button
                      key={duration}
                      className={cn(
                        "rounded-xl border px-2 py-4 text-sm font-semibold transition hover:bg-muted/40",
                        durationSeconds === duration ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card"
                      )}
                      type="button"
                      onClick={() => setDurationSeconds(duration)}
                    >
                      {duration}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Button className="h-11 w-full" disabled={!canSubmit} onClick={submit}>
            {submitting ? <Spinner /> : <Sparkles />}
            Generate Avatar Video
          </Button>
        </section>

        <PreviewPanel
          key={activeJob?.id || outputVideo?.id || "draft"}
          activeJob={activeJob}
          aspectRatio={aspectRatio}
          avatar={selectedAvatar}
          credits={estimatedCredits}
          durationSeconds={durationSeconds}
          isActive={isActive}
          outputVideo={outputVideo}
          script={script}
          voice={selectedVoice}
          onCreateAnother={() => {
            resetForAnother()
          }}
          onOpenLibrary={() => router.push("/dashboard/ai-video-avatar")}
        />
      </div>

      <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
        <DialogContent className="overflow-hidden border-primary/20 bg-[linear-gradient(135deg,var(--popover),color-mix(in_oklch,var(--accent),transparent_88%))] sm:max-w-lg">
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--primary),var(--accent),oklch(0.68_0.16_55))]" />
          <DialogHeader>
            <div className="mb-1 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Check className="size-6" />
            </div>
            <DialogTitle>Avatar video is ready</DialogTitle>
            <DialogDescription>
              Your completed video has been saved to Library. You can return to manage it or keep building another variation.
            </DialogDescription>
          </DialogHeader>
          {outputVideo?.video_url ? (
            <div className="overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
              <video className="aspect-video w-full bg-black object-contain" controls src={outputVideo.video_url} />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={resetForAnother}>
              <RefreshCcw />
              Continue Creating
            </Button>
            <Button onClick={() => router.push("/dashboard/ai-video-avatar")}>
              <Film />
              Back to Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Panel({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-[linear-gradient(145deg,var(--card),color-mix(in_oklch,var(--secondary),transparent_68%))] p-4 shadow-sm transition duration-300 hover:shadow-md sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}

function ChoiceGroupCard({
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
    <section className="group/choice-card min-h-[240px] rounded-2xl border border-border/70 bg-[linear-gradient(150deg,var(--card),color-mix(in_oklch,var(--primary),transparent_93%),color-mix(in_oklch,var(--accent),transparent_92%))] p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-background/80 text-primary shadow-sm ring-1 ring-border/70 transition group-hover/choice-card:scale-105">
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

function ChoiceEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-background/55 px-4 py-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function AvatarChoice({ avatar, onSelect, selected }: { avatar: AiAvatar; onSelect: () => void; selected: boolean }) {
  const desktopImageUrl = getAvatarDesktopImageUrl(avatar)
  const mobileImageUrl = getAvatarMobileImageUrl(avatar)

  return (
    <button
      className={cn(
        "group/avatar-choice overflow-hidden rounded-2xl border bg-card/90 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/10",
        selected ? "border-primary ring-2 ring-primary/25" : "border-border/70"
      )}
      type="button"
      onClick={onSelect}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(62px,0.52fr)] items-center gap-2 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--secondary),transparent_38%),color-mix(in_oklch,var(--accent),transparent_86%))] p-2">
        <AvatarRatioPreview imageUrl={desktopImageUrl} label="16:9" name={avatar.name} ratioClassName="aspect-video" />
        <AvatarRatioPreview imageUrl={mobileImageUrl} label="9:16" name={avatar.name} ratioClassName="aspect-[9/16]" />
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-semibold">{avatar.name}</h4>
          {selected ? <Check className="size-4 text-primary" /> : null}
        </div>
        <p className="text-xs text-muted-foreground">{avatar.style} · {avatar.source}</p>
      </div>
    </button>
  )
}

function VoiceChoice({
  onPlay,
  onSelect,
  previewing,
  selected,
  voice,
}: {
  onPlay: () => void
  onSelect: () => void
  previewing: boolean
  selected: boolean
  voice: VoiceListItem
}) {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-2xl border bg-card/90 p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/10",
        selected ? "border-primary ring-2 ring-primary/25" : "border-border/70"
      )}
    >
      <button className="flex min-w-0 items-center gap-3 text-left" type="button" onClick={onSelect}>
        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,var(--accent),var(--primary))] text-white shadow-sm">
          {voice.avatar_image_url ? <img alt={voice.name} className="size-full object-cover" src={voice.avatar_image_url} /> : <Mic2 className="size-5" />}
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold">{voice.name}</h4>
          <p className="mt-1 text-xs capitalize text-muted-foreground">{voice.source} voice</p>
        </div>
        {selected ? <Check className="ml-auto size-4 shrink-0 text-primary" /> : null}
      </button>
      <Button className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary" variant="outline" onClick={onPlay}>
        {previewing ? <Spinner /> : <Play />}
        Preview
      </Button>
    </div>
  )
}

function PreviewPanel({
  activeJob,
  aspectRatio,
  avatar,
  credits,
  durationSeconds,
  isActive,
  onCreateAnother,
  onOpenLibrary,
  outputVideo,
  script,
  voice,
}: {
  activeJob: AiVideoAvatarJob | null
  aspectRatio: VideoAvatarAspectRatio
  avatar: AiAvatar | null
  credits: number
  durationSeconds: number
  isActive: boolean
  onCreateAnother: () => void
  onOpenLibrary: () => void
  outputVideo: AiVideoAvatarVideo | null
  script: string
  voice: VoiceListItem | null
}) {
  const progress = activeJob?.progress || outputVideo?.progress || 0
  const completed = outputVideo?.status === "completed" && Boolean(outputVideo.video_url)
  const failed = activeJob?.status === "failed" || outputVideo?.status === "failed"
  const avatarPreviewUrl = avatar ? getAvatarPreviewImageUrl(avatar, aspectRatio) : ""
  const [displayProgress, setDisplayProgress] = useState(progress)
  const visibleProgress = isActive ? Math.max(displayProgress, progress) : progress

  useEffect(() => {
    if (completed || failed || !isActive) return

    const interval = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (current < progress) return progress
        const ceiling = Math.min(96, progress + 14)
        if (current >= ceiling) return current

        const step = current < 40 ? 0.9 : current < 70 ? 0.55 : 0.28
        return Math.min(ceiling, Number((current + step).toFixed(2)))
      })
    }, 360)

    return () => window.clearInterval(interval)
  }, [completed, failed, isActive, progress])

  return (
    <aside className="xl:sticky xl:top-24 xl:self-start">
      <div className="space-y-4 rounded-2xl border border-border/70 bg-[linear-gradient(155deg,var(--card),color-mix(in_oklch,var(--primary),transparent_92%),color-mix(in_oklch,var(--accent),transparent_90%))] p-4 shadow-lg shadow-primary/5 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Live preview</h3>
            <p className="mt-1 text-sm text-muted-foreground">Ratio, voice, duration, and cost update as you edit.</p>
          </div>
          <Badge variant="outline">
            <CircleDollarSign className="size-3" />
            {credits} credits
          </Badge>
        </div>

        <div className={cn("mx-auto overflow-hidden rounded-xl border border-border bg-muted shadow-inner", aspectRatio === "9:16" ? "aspect-[9/16] max-h-[520px] w-[68%]" : "aspect-video w-full")}>
          {completed ? (
            <video className="size-full bg-black object-contain" controls src={outputVideo.video_url} />
          ) : avatar ? (
            <div className="relative size-full">
              <img alt={`${avatar.name} ${aspectRatio}`} className="size-full object-cover" src={avatarPreviewUrl} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                <p className="text-sm font-semibold">{avatar.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-white/78">{script || "Script preview will appear here."}</p>
              </div>
            </div>
          ) : (
            <div className="grid size-full place-items-center text-sm text-muted-foreground">Choose an avatar</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <PreviewStat icon={<UserRound className="size-4" />} label="Avatar" value={avatar?.name || "Not selected"} />
          <PreviewStat icon={<Mic2 className="size-4" />} label="Voice" value={voice?.name || "Not selected"} />
          <PreviewStat icon={<LayoutTemplate className="size-4" />} label="Ratio" value={aspectRatio} />
          <PreviewStat icon={<Clock3 className="size-4" />} label="Duration" value={`${durationSeconds}s`} />
        </div>

        <div className="rounded-2xl border border-primary/15 bg-background/60 p-4 shadow-inner">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold">Generation progress</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isActive ? "Rendering continues while each real stage completes." : completed ? "Completed and ready." : "Ready to generate."}
              </p>
            </div>
            {isActive ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <LoaderCircle className="size-3.5 animate-spin" />
                Live
              </span>
            ) : null}
          </div>
          <Progress
            className="avatar-progress [&_[data-slot=progress-track]]:h-3 [&_[data-slot=progress-track]]:bg-primary/10 [&_[data-slot=progress-indicator]]:bg-[linear-gradient(90deg,var(--primary),var(--accent),oklch(0.68_0.16_55))]"
            value={Math.round(visibleProgress)}
          >
            <ProgressLabel>{activeJob?.message || outputVideo?.message || "Ready to generate."}</ProgressLabel>
            <ProgressValue />
          </Progress>
          <StageList progress={progress} failed={failed} />
          {failed ? (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {activeJob?.error || outputVideo?.error || "Generation failed."}
            </p>
          ) : null}
        </div>

        {completed ? (
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <Button onClick={onOpenLibrary}>
              <Film />
              View in Library
            </Button>
            <Button nativeButton={false} render={<a href={outputVideo.video_url} download />} variant="outline">
              <Film />
              Download Video
            </Button>
            <Button variant="outline" onClick={onCreateAnother}>
              <RefreshCcw />
              Generate Another
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function AvatarRatioPreview({
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
      <img alt={`${name} ${label}`} className="size-full object-cover" src={imageUrl} />
      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-medium leading-none text-foreground shadow-sm ring-1 ring-border/70">
        {label}
      </span>
    </div>
  )
}

function getAvatarPreviewImageUrl(avatar: AiAvatar, aspectRatio: VideoAvatarAspectRatio) {
  return aspectRatio === "9:16" ? getAvatarMobileImageUrl(avatar) : getAvatarDesktopImageUrl(avatar)
}

function getAvatarDesktopImageUrl(avatar: AiAvatar) {
  return avatar.desktop_image_url || avatar.image_url
}

function getAvatarMobileImageUrl(avatar: AiAvatar) {
  return avatar.mobile_image_url || avatar.image_url
}

function PreviewStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs uppercase">{label}</span></div>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

function StageList({ failed, progress }: { failed: boolean; progress: number }) {
  const stages = [
    ["Preparing avatar", 18],
    ["Preparing voice", 30],
    ["Generating video", 55],
    ["Processing output", 72],
    ["Uploading to storage", 88],
    ["Complete", 100],
  ] as const

  return (
    <div className="mt-4 grid gap-2">
      {stages.map(([label, threshold]) => (
        <div key={label} className="flex items-center gap-2 text-sm">
          <span className={cn("grid size-5 place-items-center rounded-full border", progress >= threshold && !failed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>
            {progress >= threshold && !failed ? <Check className="size-3" /> : null}
          </span>
          <span className={cn(progress >= threshold && !failed ? "text-foreground" : "text-muted-foreground")}>{label}</span>
        </div>
      ))}
    </div>
  )
}

function CreateSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-xl border border-border/70 bg-card p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-4 h-28 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-[620px] rounded-xl" />
    </div>
  )
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
