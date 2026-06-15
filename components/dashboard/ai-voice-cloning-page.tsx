"use client"

import {
  AudioLines,
  CircleAlert,
  CircleCheck,
  Clock3,
  CloudUpload,
  ImagePlus,
  LoaderCircle,
  ListChecks,
  Mic2,
  Plus,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { GeneratedAudioAssetCard, VoiceAssetCard } from "@/components/dashboard/library-asset-cards"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { showAppToast } from "@/components/ui/app-toast"
import { getValidAccessToken, refreshSession } from "@/lib/insforge"
import type {
  AiTtsJob,
  AiTtsOutput,
  DefaultVoice,
  TtsJobResponse,
  VoiceJobStatus,
  VoiceListItem,
} from "@/lib/voice-types"
import {
  customTtsLanguages,
  defaultCustomTtsLanguage,
  getTtsCreditCost,
  getVoiceLanguageLabel,
} from "@/lib/voice-types"
import { cn } from "@/lib/utils"

const activeStatuses = new Set(["queued", "running", "generating", "uploading"])
const maxTextCharacters = 2000

type AudioTaskQueueItem = {
  id: string
  type: "voice" | "tts"
  title: string
  detail: string
  status: VoiceJobStatus
  progress: number
  createdAt: number
}

export function AiVoiceCloningPage() {
  const [voices, setVoices] = useState<VoiceListItem[]>([])
  const [defaultVoices, setDefaultVoices] = useState<DefaultVoice[]>([])
  const [outputs, setOutputs] = useState<AiTtsOutput[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [loadingVoices, setLoadingVoices] = useState(true)
  const [loadingOutputs, setLoadingOutputs] = useState(true)
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [ttsDialogOpen, setTtsDialogOpen] = useState(false)
  const [voiceName, setVoiceName] = useState("")
  const [voiceSample, setVoiceSample] = useState<File | null>(null)
  const [voiceSampleUrl, setVoiceSampleUrl] = useState("")
  const [voiceImage, setVoiceImage] = useState<File | null>(null)
  const [voiceImageUrl, setVoiceImageUrl] = useState("")
  const [selectedVoiceId, setSelectedVoiceId] = useState("")
  const [ttsLanguage, setTtsLanguage] = useState(defaultCustomTtsLanguage)
  const [ttsText, setTtsText] = useState("")
  const [activeTtsJob, setActiveTtsJob] = useState<AiTtsJob | null>(null)
  const [taskQueue, setTaskQueue] = useState<AudioTaskQueueItem[]>([])
  const [submittingClone, setSubmittingClone] = useState(false)
  const [submittingTts, setSubmittingTts] = useState(false)
  const [selectingVoiceId, setSelectingVoiceId] = useState("")
  const [previewingVoiceId, setPreviewingVoiceId] = useState("")
  const [deletingVoiceId, setDeletingVoiceId] = useState("")
  const [deletingOutputId, setDeletingOutputId] = useState("")
  const [error, setError] = useState("")
  const ttsPollRef = useRef<number | null>(null)
  const voiceSamplePreviewRef = useRef("")
  const voiceImagePreviewRef = useRef("")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const defaultPreviewUrlsRef = useRef<Record<string, string>>({})

  const customVoices = useMemo(() => voices.filter((voice) => voice.source === "custom"), [voices])
  const defaultVoiceItems = useMemo(() => voices.filter((voice) => voice.source === "default"), [voices])
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) || voices[0] || null,
    [selectedVoiceId, voices]
  )
  const ttsPricing = useMemo(() => getTtsCreditCost(ttsText), [ttsText])
  const canSubmitClone = Boolean(voiceName.trim() && voiceSample) && !submittingClone
  const canSubmitTts =
    Boolean(selectedVoice?.id && ttsText.trim()) &&
    ttsPricing.characterCount <= maxTextCharacters &&
    ttsPricing.creditsCost > 0 &&
    (creditBalance === null || creditBalance >= ttsPricing.creditsCost) &&
    !submittingTts

  useEffect(() => {
    loadVoices().finally(() => setLoadingVoices(false))
    loadOutputs().finally(() => setLoadingOutputs(false))

    return () => {
      if (ttsPollRef.current) window.clearInterval(ttsPollRef.current)
      if (voiceSamplePreviewRef.current) URL.revokeObjectURL(voiceSamplePreviewRef.current)
      if (voiceImagePreviewRef.current) URL.revokeObjectURL(voiceImagePreviewRef.current)
      Object.values(defaultPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
      audioRef.current?.pause()
    }
  }, [])

  useEffect(() => {
    if (!activeTtsJob || !activeStatuses.has(activeTtsJob.status)) return

    ttsPollRef.current = window.setInterval(() => {
      pollTtsJob(activeTtsJob.id)
    }, 2500)

    return () => {
      if (ttsPollRef.current) window.clearInterval(ttsPollRef.current)
    }
  }, [activeTtsJob])

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
    if (!response.ok) {
      throw new Error(body.message || "Request failed.")
    }

    return body
  }

  function upsertTaskQueueItem(nextTask: AudioTaskQueueItem) {
    setTaskQueue((current) => {
      const withoutCurrent = current.filter((task) => task.id !== nextTask.id)
      return [nextTask, ...withoutCurrent]
    })
  }

  function updateTaskQueueItem(id: string, values: Partial<Omit<AudioTaskQueueItem, "id" | "type" | "createdAt">>) {
    setTaskQueue((current) =>
      current.map((task) => (task.id === id ? { ...task, ...values } : task))
    )
  }

  function addTtsTask(job: AiTtsJob) {
    upsertTaskQueueItem({
      id: job.id,
      type: "tts",
      title: `TTS: ${job.voice_name}`,
      detail: job.message || job.status,
      status: job.status,
      progress: job.progress || 0,
      createdAt: Date.now(),
    })
  }

  async function loadVoices() {
    try {
      const response = await apiFetch("/api/voices")
      const body = await readJson<{
        voices: VoiceListItem[]
        defaultVoices: DefaultVoice[]
        creditBalance: number
      }>(response)
      setVoices(body.voices)
      setDefaultVoices(body.defaultVoices)
      setCreditBalance(body.creditBalance)
      setSelectedVoiceId((current) => current || body.voices.find((voice) => voice.is_selected)?.id || body.voices[0]?.id || "")
      setError("")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load voices.")
    }
  }

  async function loadOutputs() {
    try {
      const response = await apiFetch("/api/voice-tts")
      const body = await readJson<{ outputs: AiTtsOutput[]; creditBalance: number }>(response)
      setOutputs(body.outputs)
      setCreditBalance(body.creditBalance)
      setError("")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load generated audio.")
    }
  }

  async function pollTtsJob(jobId: string) {
    try {
      const response = await apiFetch(`/api/voice-tts/jobs/${jobId}`)
      const body = await readJson<TtsJobResponse>(response)
      setActiveTtsJob(body.job)
      updateTaskQueueItem(body.job.id, {
        detail: body.job.message || body.job.status,
        progress: body.job.progress || 0,
        status: body.job.status,
      })
      if (typeof body.creditBalance === "number") setCreditBalance(body.creditBalance)

      if (body.job.status === "completed" && body.output) {
        await loadOutputs()
        showAppToast("Audio generated.", {
          description: `${body.output.voice_name} finished a new TTS clip.`,
        })
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not refresh TTS status.")
    }
  }

  function onChooseSample(file: File | null) {
    if (voiceSamplePreviewRef.current) {
      URL.revokeObjectURL(voiceSamplePreviewRef.current)
      voiceSamplePreviewRef.current = ""
    }

    setVoiceSample(file)
    if (!file) {
      setVoiceSampleUrl("")
      return
    }

    const url = URL.createObjectURL(file)
    voiceSamplePreviewRef.current = url
    setVoiceSampleUrl(url)
  }

  function onChooseImage(file: File | null) {
    if (voiceImagePreviewRef.current) {
      URL.revokeObjectURL(voiceImagePreviewRef.current)
      voiceImagePreviewRef.current = ""
    }

    setVoiceImage(file)
    if (!file) {
      setVoiceImageUrl("")
      return
    }

    const url = URL.createObjectURL(file)
    voiceImagePreviewRef.current = url
    setVoiceImageUrl(url)
  }

  async function submitClone() {
    if (!canSubmitClone || !voiceSample) return

    const taskId = `voice-${Date.now()}`
    const trimmedName = voiceName.trim()
    setSubmittingClone(true)
    setError("")
    upsertTaskQueueItem({
      id: taskId,
      type: "voice",
      title: `Add voice: ${trimmedName}`,
      detail: "Uploading reference sample.",
      status: "running",
      progress: 18,
      createdAt: Date.now(),
    })

    try {
      const form = new FormData()
      form.append("name", trimmedName)
      form.append("file", voiceSample)
      if (voiceImage) form.append("image", voiceImage)
      updateTaskQueueItem(taskId, {
        detail: "Analyzing voice sample and preparing clone.",
        progress: 48,
      })
      const response = await apiFetch("/api/voices/clone", {
        method: "POST",
        body: form,
      })
      const body = await readJson<{ voice: VoiceListItem }>(response)
      await loadVoices()
      setSelectedVoiceId(body.voice.id)
      setCloneDialogOpen(false)
      setVoiceName("")
      onChooseSample(null)
      onChooseImage(null)
      updateTaskQueueItem(taskId, {
        detail: `${body.voice.name} is ready for generation.`,
        progress: 100,
        status: "completed",
      })
      showAppToast("Custom voice saved.", {
        description: `${body.voice.name} is ready for Qwen3-TTS voice cloning.`,
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start voice cloning.")
      updateTaskQueueItem(taskId, {
        detail: nextError instanceof Error ? nextError.message : "Could not save custom voice.",
        progress: 100,
        status: "failed",
      })
    } finally {
      setSubmittingClone(false)
    }
  }

  async function submitTts() {
    if (!canSubmitTts || !selectedVoice) return

    setSubmittingTts(true)
    setError("")

    try {
      const response = await apiFetch("/api/voice-tts/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceId: selectedVoice.id,
          language: selectedVoice.source === "custom" ? ttsLanguage : undefined,
          text: ttsText,
        }),
      })
      const body = await readJson<{ job: AiTtsJob; creditBalance: number }>(response)
      setActiveTtsJob(body.job)
      addTtsTask(body.job)
      setCreditBalance(body.creditBalance)
      setTtsDialogOpen(false)
      setTtsText("")
      showAppToast("TTS generation started.", {
        description: `${body.job.credits_cost} credits were reserved for this audio.`,
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start TTS generation.")
    } finally {
      setSubmittingTts(false)
    }
  }

  async function deleteVoice(voice: VoiceListItem) {
    if (voice.source !== "custom") return

    setDeletingVoiceId(voice.id)
    setError("")

    try {
      const response = await apiFetch(`/api/voices/${voice.id}`, { method: "DELETE" })
      await readJson(response)
      const nextVoices = voices.filter((item) => item.id !== voice.id)
      setVoices(nextVoices)
      if (selectedVoiceId === voice.id) {
        setSelectedVoiceId(nextVoices.find((item) => item.source === "custom")?.id || nextVoices[0]?.id || "")
      }
      showAppToast("Custom voice deleted.", {
        description: `${voice.name} was removed from your voice list.`,
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete custom voice.")
    } finally {
      setDeletingVoiceId("")
    }
  }

  async function deleteTtsOutput(output: AiTtsOutput) {
    setDeletingOutputId(output.id)
    setError("")

    try {
      const response = await apiFetch(`/api/voice-tts/${output.id}`, { method: "DELETE" })
      await readJson(response)
      setOutputs((current) => current.filter((item) => item.id !== output.id))
      showAppToast("Generated audio deleted.", {
        description: `${output.voice_name} was removed from your TTS history.`,
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete generated audio.")
    } finally {
      setDeletingOutputId("")
    }
  }

  async function selectVoice(voice: VoiceListItem) {
    setSelectedVoiceId(voice.id)
    setVoices((current) =>
      current.map((item) => ({
        ...item,
        is_selected: item.id === voice.id,
      }))
    )

    setSelectingVoiceId(voice.id)
    setError("")

    try {
      const response = await apiFetch(`/api/voices/${voice.id}/select`, { method: "POST" })
      await readJson(response)
      await loadVoices()
      showAppToast(voice.source === "custom" ? "Custom voice selected." : "Default voice selected.", {
        description: `${voice.name} is ready for the next TTS generation.`,
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not select voice.")
      await loadVoices()
    } finally {
      setSelectingVoiceId("")
    }
  }

  async function playVoicePreview(voice: VoiceListItem) {
    setPreviewingVoiceId(voice.id)
    setError("")

    try {
      let audioUrl = voice.preview_audio_url || ""

      if (!audioUrl && voice.source === "custom") {
        audioUrl = voice.sample_audio_url || ""
      }

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
            throw new Error(body.message || "Could not generate preview.")
          }

          audioUrl = URL.createObjectURL(await response.blob())
          defaultPreviewUrlsRef.current[voice.id] = audioUrl
        }
      }

      if (!audioUrl) throw new Error("This voice does not have a sample or preview yet.")

      audioRef.current?.pause()
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      await audio.play()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not play preview.")
    } finally {
      setPreviewingVoiceId("")
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-card/95 p-5 shadow-sm backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex w-fit items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                <Mic2 className="size-4" />
                AI Voice Cloning
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">Voice Studio</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Save reusable reference audio and generate TTS with custom Qwen3-TTS or Deepgram default voices.
              </p>
            </div>
            <div className="w-fit rounded-lg border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Credits</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{creditBalance ?? "..."}</p>
            </div>
          </div>
        </div>

        <StatusPanel tasks={taskQueue} />
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Tabs defaultValue="voices" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="voices">AI Voice Cloning</TabsTrigger>
            <TabsTrigger value="tts">Voice Cloning TTS</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 sm:flex-row">
            <CloneVoiceDialog
              file={voiceSample}
              fileUrl={voiceSampleUrl}
              imageFile={voiceImage}
              imageUrl={voiceImageUrl}
              name={voiceName}
              open={cloneDialogOpen}
              submitting={submittingClone}
              canSubmit={canSubmitClone}
              onChooseFile={onChooseSample}
              onChooseImage={onChooseImage}
              onNameChange={setVoiceName}
              onOpenChange={setCloneDialogOpen}
              onSubmit={submitClone}
            />
            <TtsDialog
              canSubmit={canSubmitTts}
              creditBalance={creditBalance}
              open={ttsDialogOpen}
              pricing={ttsPricing}
              selectedVoiceId={selectedVoiceId}
              selectedVoice={selectedVoice}
              submitting={submittingTts}
              ttsLanguage={ttsLanguage}
              text={ttsText}
              voices={voices}
              onTtsLanguageChange={setTtsLanguage}
              onOpenChange={setTtsDialogOpen}
              onSelectedVoiceChange={setSelectedVoiceId}
              onSubmit={submitTts}
              onTextChange={setTtsText}
            />
          </div>
        </div>

        <TabsContent value="voices" className="space-y-6">
          <VoiceSection
            emptyDescription="Upload a 10 second voice sample to create your first Qwen voice reference."
            loading={loadingVoices}
            previewingVoiceId={previewingVoiceId}
            selectingVoiceId={selectingVoiceId}
            title="Custom voices"
            voices={customVoices}
            onPlay={playVoicePreview}
            onSelect={selectVoice}
            onDelete={deleteVoice}
            deletingVoiceId={deletingVoiceId}
          />

          <VoiceSection
            emptyDescription={`${defaultVoices.length || 6} ready-made Deepgram voices for fast TTS generation.`}
            loading={loadingVoices}
            previewingVoiceId={previewingVoiceId}
            selectingVoiceId={selectingVoiceId}
            title="Deepgram default voices"
            voices={defaultVoiceItems}
            onPlay={playVoicePreview}
            onSelect={selectVoice}
          />
        </TabsContent>

        <TabsContent value="tts" className="space-y-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold tracking-tight">Generated audio</h3>
            <p className="text-sm text-muted-foreground">Completed TTS audio generated from custom or default voices.</p>
          </div>

          <div className="grid gap-4">
            {loadingOutputs ? <GeneratedAudioSkeleton /> : null}
            {!loadingOutputs && outputs.map((output) => (
              <GeneratedAudioAssetCard
                key={output.id}
                deleting={deletingOutputId === output.id}
                output={output}
                voices={voices}
                onDelete={() => deleteTtsOutput(output)}
              />
            ))}
            {!loadingOutputs && !outputs.length ? (
              <EmptyState
                icon={<AudioLines className="size-5" />}
                title="No generated audio yet"
                description="Choose a voice, add text, and generate your first TTS clip."
              />
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatusPanel({ tasks }: { tasks: AudioTaskQueueItem[] }) {
  const [visibleCount, setVisibleCount] = useState(10)
  const activeCount = tasks.filter((task) => activeStatuses.has(task.status)).length
  const visibleTasks = tasks.slice(0, visibleCount)
  const hasMoreTasks = visibleCount < tasks.length

  return (
    <div className="rounded-lg border border-border/70 bg-card/90 p-5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_12px_30px_rgb(0_0_0_/_0.06)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg border border-primary/20 bg-primary/12 text-primary shadow-sm">
            {activeCount ? <Spinner /> : <ListChecks className="size-5" />}
          </div>
          <div>
            <p className="text-sm font-semibold">Task queue</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Voice uploads and long-running TTS jobs stay visible while they finish.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="size-4" />
          <span>{activeCount ? `${activeCount} active` : "All clear"}</span>
        </div>
      </div>

      <div className="mt-5 max-h-[22rem] overflow-y-auto pr-1">
        {visibleTasks.length ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
            {visibleTasks.map((task) => (
              <TaskQueueCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border/70 bg-background/55 px-4 py-5 text-sm text-muted-foreground">
            No active audio tasks yet. New voice uploads and generated speech jobs will appear here.
          </p>
        )}
      </div>

      {hasMoreTasks ? (
        <Button className="mt-4 w-full" variant="outline" onClick={() => setVisibleCount((count) => count + 10)}>
          <Plus />
          Load More
        </Button>
      ) : null}
    </div>
  )
}

function TaskQueueCard({ task }: { task: AudioTaskQueueItem }) {
  const meta = getTaskStatusMeta(task.status)

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-background/55 shadow-sm backdrop-blur-md">
      <div className={cn("h-1", meta.accentClass)} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-lg border shadow-sm",
                task.type === "voice"
                  ? "border-primary/20 bg-primary/12 text-primary"
                  : "border-sky-400/20 bg-sky-400/12 text-sky-500"
              )}
            >
              {task.type === "voice" ? <Mic2 className="size-4" /> : <AudioLines className="size-4" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{task.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.detail}</p>
            </div>
          </div>
          <div className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium", meta.badgeClass)}>
            {meta.icon}
            {meta.label}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{task.type === "voice" ? "Voice" : "TTS"}</span>
            <span className="tabular-nums">{Math.round(task.progress || 0)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
            <div
              className={cn("h-full rounded-full transition-all", meta.accentClass)}
              style={{ width: `${Math.min(Math.max(task.progress || 0, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function getTaskStatusMeta(status: VoiceJobStatus) {
  if (status === "queued") {
    return {
      label: "Waiting",
      icon: <Clock3 className="size-3.5" />,
      badgeClass: "border-amber-400/30 bg-amber-400/12 text-amber-600 dark:text-amber-300",
      accentClass: "bg-amber-400",
    }
  }

  if (status === "running") {
    return {
      label: "Running",
      icon: <LoaderCircle className="size-3.5 animate-spin" />,
      badgeClass: "border-blue-400/30 bg-blue-400/12 text-blue-600 dark:text-blue-300",
      accentClass: "bg-blue-500",
    }
  }

  if (status === "generating") {
    return {
      label: "Generating",
      icon: <WandSparkles className="size-3.5" />,
      badgeClass: "border-violet-400/30 bg-violet-400/12 text-violet-600 dark:text-violet-300",
      accentClass: "bg-violet-500",
    }
  }

  if (status === "uploading") {
    return {
      label: "Uploading",
      icon: <Upload className="size-3.5" />,
      badgeClass: "border-cyan-400/30 bg-cyan-400/12 text-cyan-600 dark:text-cyan-300",
      accentClass: "bg-cyan-500",
    }
  }

  if (status === "completed") {
    return {
      label: "Completed",
      icon: <CircleCheck className="size-3.5" />,
      badgeClass: "border-emerald-400/30 bg-emerald-400/12 text-emerald-600 dark:text-emerald-300",
      accentClass: "bg-emerald-500",
    }
  }

  return {
    label: "Failed",
    icon: <CircleAlert className="size-3.5" />,
    badgeClass: "border-red-400/30 bg-red-400/12 text-red-600 dark:text-red-300",
    accentClass: "bg-red-500",
  }
}

function CloneVoiceDialog({
  canSubmit,
  file,
  fileUrl,
  imageFile,
  imageUrl,
  name,
  onChooseFile,
  onChooseImage,
  onNameChange,
  onOpenChange,
  onSubmit,
  open,
  submitting,
}: {
  canSubmit: boolean
  file: File | null
  fileUrl: string
  imageFile: File | null
  imageUrl: string
  name: string
  onChooseFile: (file: File | null) => void
  onChooseImage: (file: File | null) => void
  onNameChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
  open: boolean
  submitting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus />
        Add New Voice Clone
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Voice Clone</DialogTitle>
          <DialogDescription>
            Upload a clear 10 second voice sample. It will be saved as reusable reference audio for future TTS.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-5 overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label htmlFor="voice-name">Voice name</Label>
            <Input
              id="voice-name"
              disabled={submitting}
              placeholder="e.g. Product Narrator"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="voice-sample">10 second voice sample</Label>
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
              <Input
                id="voice-sample"
                accept="audio/*"
                className="sr-only"
                disabled={submitting}
                type="file"
                onChange={(event) => onChooseFile(event.target.files?.[0] || null)}
              />
              <Label
                htmlFor="voice-sample"
                className={cn(
                  "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-border/70 bg-card px-4 py-5 text-center transition hover:bg-muted/40",
                  submitting && "pointer-events-none opacity-60"
                )}
              >
                <CloudUpload className="size-7 text-primary" />
                <span className="text-sm font-semibold">{file ? "Replace voice sample" : "Upload voice sample"}</span>
                <span className="max-w-sm text-xs leading-5 text-muted-foreground">
                  Choose an audio file with about 10 seconds of clean speech.
                </span>
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">
                Use a clean recording with one speaker and minimal background noise.
              </p>
              {file && fileUrl ? (
                <div className="mt-4 min-w-0 max-w-full overflow-hidden rounded-lg border border-border/70 bg-card p-3">
                  <p className="block max-w-full truncate text-sm font-medium" title={file.name}>{file.name}</p>
                  <audio className="mt-3 w-full" controls src={fileUrl} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="voice-image">Voice impression image</Label>
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
              <Input
                id="voice-image"
                accept="image/*"
                className="sr-only"
                disabled={submitting}
                type="file"
                onChange={(event) => onChooseImage(event.target.files?.[0] || null)}
              />
              <Label
                htmlFor="voice-image"
                className={cn(
                  "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-border/70 bg-card px-4 py-5 text-center transition hover:bg-muted/40",
                  submitting && "pointer-events-none opacity-60"
                )}
              >
                <ImagePlus className="size-7 text-primary" />
                <span className="text-sm font-semibold">{imageFile ? "Replace impression image" : "Upload impression image"}</span>
                <span className="max-w-sm text-xs leading-5 text-muted-foreground">
                  Choose a square or portrait image that helps identify this custom voice.
                </span>
              </Label>
              {imageFile && imageUrl ? (
                <div className="mt-4 flex min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-lg border border-border/70 bg-card p-3">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/70 bg-muted">
                    <img alt={imageFile.name} className="size-full object-cover" src={imageUrl} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="block max-w-full truncate text-sm font-medium" title={imageFile.name}>{imageFile.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Saved as the voice card image.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 bg-popover pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X />
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={onSubmit}>
            {submitting ? <Spinner /> : <CloudUpload />}
            Save Custom Voice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TtsDialog({
  canSubmit,
  creditBalance,
  onOpenChange,
  onSelectedVoiceChange,
  onSubmit,
  onTextChange,
  onTtsLanguageChange,
  open,
  pricing,
  selectedVoice,
  selectedVoiceId,
  submitting,
  ttsLanguage,
  text,
  voices,
}: {
  canSubmit: boolean
  creditBalance: number | null
  onOpenChange: (open: boolean) => void
  onSelectedVoiceChange: (value: string) => void
  onSubmit: () => void
  onTextChange: (value: string) => void
  onTtsLanguageChange: (value: string) => void
  open: boolean
  pricing: { characterCount: number; creditsCost: number }
  selectedVoice: VoiceListItem | null
  selectedVoiceId: string
  submitting: boolean
  ttsLanguage: string
  text: string
  voices: VoiceListItem[]
}) {
  const insufficientCredits = creditBalance !== null && pricing.creditsCost > creditBalance
  const showCustomLanguage = selectedVoice?.source === "custom"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <AudioLines />
        Generate Text to Speech
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Generate Text to Speech</DialogTitle>
          <DialogDescription>Use a cloned voice or a Deepgram default voice to generate audio.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="tts-voice">Voice</Label>
            <NativeSelect
              id="tts-voice"
              className="w-full"
              disabled={submitting || !voices.length}
              value={selectedVoiceId}
              onChange={(event) => onSelectedVoiceChange(event.target.value)}
            >
              {voices.map((voice) => (
                <NativeSelectOption key={voice.id} value={voice.id}>
                  {voice.name} ({voice.source === "custom" ? "Custom" : "Default, " + getVoiceLanguageLabel(voice.language)})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {showCustomLanguage ? (
            <div className="grid gap-2">
              <Label htmlFor="tts-language">Output language</Label>
              <NativeSelect
                id="tts-language"
                className="w-full"
                disabled={submitting}
                value={ttsLanguage}
                onChange={(event) => onTtsLanguageChange(event.target.value)}
              >
                {customTtsLanguages.map((item) => (
                  <NativeSelectOption key={item.code} value={item.code}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="tts-text">Text</Label>
            <Textarea
              id="tts-text"
              className="min-h-40 resize-none"
              disabled={submitting}
              maxLength={maxTextCharacters}
              placeholder="Enter up to 2,000 characters..."
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{pricing.characterCount} / {maxTextCharacters} characters</span>
              <span>Every 500 characters costs 10 credits.</span>
            </div>
          </div>

          <div
            className={cn(
              "grid gap-3 rounded-lg border p-4 sm:grid-cols-3",
              insufficientCredits ? "border-destructive/40 bg-destructive/10" : "border-border/70 bg-muted/20"
            )}
          >
            <PriceStat label="Estimated cost" value={`${pricing.creditsCost} credits`} />
            <PriceStat label="Available" value={creditBalance === null ? "..." : `${creditBalance} credits`} />
            <PriceStat label="Billing rule" value="10 / 500 chars" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X />
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={onSubmit}>
            {submitting ? <Spinner /> : <Sparkles />}
            Generate Text to Speech
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PriceStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function VoiceSection({
  deletingVoiceId = "",
  emptyDescription,
  loading,
  onDelete,
  onPlay,
  onSelect,
  previewingVoiceId,
  selectingVoiceId,
  title,
  voices,
}: {
  deletingVoiceId?: string
  emptyDescription: string
  loading: boolean
  onDelete?: (voice: VoiceListItem) => void
  onPlay: (voice: VoiceListItem) => void
  onSelect: (voice: VoiceListItem) => void
  previewingVoiceId: string
  selectingVoiceId: string
  title: string
  voices: VoiceListItem[]
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{emptyDescription}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? <VoiceSkeleton /> : null}
        {!loading && voices.map((voice, index) => (
          <VoiceAssetCard
            key={voice.id}
            deleting={deletingVoiceId === voice.id}
            previewing={previewingVoiceId === voice.id}
            selecting={selectingVoiceId === voice.id}
            tone={index}
            voice={voice}
            onDelete={onDelete ? () => onDelete(voice) : undefined}
            onPlay={() => onPlay(voice)}
            onSelect={() => onSelect(voice)}
          />
        ))}
        {!loading && !voices.length ? (
          <EmptyState
            icon={<Mic2 className="size-5" />}
            title="Nothing here yet"
            description={emptyDescription}
          />
        ) : null}
      </div>
    </section>
  )
}

function EmptyState({
  description,
  icon,
  title,
}: {
  description: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/95 p-6 text-center shadow-sm sm:col-span-2 xl:col-span-3">
      <div className="mx-auto grid size-11 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function VoiceSkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-lg border border-border/70 bg-card/95 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="size-14 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="mt-8 h-9 w-full" />
        </div>
      ))}
    </>
  )
}

function GeneratedAudioSkeleton() {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-3 w-72" />
      <Skeleton className="mt-5 h-10 w-full" />
    </div>
  )
}

