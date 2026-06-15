"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Box, Check, CircleDollarSign, Clapperboard, Film, Image as ImageIcon, LayoutTemplate, LoaderCircle, Mic2, MonitorPlay, Palette, Radio, Sparkles, Type, UserRound, WandSparkles } from "lucide-react"
import { Player } from "@remotion/player"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AiVideoAgentRemotion } from "@/components/dashboard/ai-video-agent-remotion"
import {
  AvatarChoice,
  ChoiceEmptyState,
  ChoiceGroupCard,
  VoiceChoice,
  getAvatarPreviewImageUrl,
} from "@/components/dashboard/media-choice-components"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { showAppToast } from "@/components/ui/app-toast"
import { getValidAccessToken, refreshSession } from "@/lib/insforge"
import type { AiAvatar } from "@/lib/avatar-types"
import type { VoiceListItem } from "@/lib/voice-types"
import {
  aiVideoAgentAspectRatios,
  aiVideoAgentCaptionEffectLabels,
  aiVideoAgentCaptionEffects,
  aiVideoAgentCaptionStyleLabels,
  aiVideoAgentCaptionStyles,
  aiVideoAgentDurations,
  aiVideoAgentPresentationFormatLabels,
  aiVideoAgentPresentationFormats,
  aiVideoAgentSceneCounts,
  aiVideoAgentTransitionDurations,
  aiVideoAgentTransitionEffectLabels,
  aiVideoAgentTransitionEffects,
  aiVideoAgentVisualStyleLabels,
  aiVideoAgentVisualStyles,
  getAiVideoAgentCreditCost,
  getAiVideoAgentDimensions,
  type AiVideoAgentAspectRatio,
  type AiVideoAgentCaptionEffect,
  type AiVideoAgentCaptionStyle,
  type AiVideoAgentDuration,
  type AiVideoAgentInitialData,
  type AiVideoAgentPresentationFormat,
  type AiVideoAgentProject,
  type AiVideoAgentSceneCount,
  type AiVideoAgentSceneTransition,
  type AiVideoAgentTimeline,
  type AiVideoAgentTransitionDuration,
  type AiVideoAgentTransitionEffect,
  type AiVideoAgentVisualSource,
  type AiVideoAgentVisualStyle,
} from "@/lib/ai-video-agent"
import { cn } from "@/lib/utils"

const activeStatuses = new Set(["queued", "running", "generating", "rendering", "uploading"])
const demoCaptionText = "This is a demo"

const captionStyleDescriptions: Record<AiVideoAgentCaptionStyle, string> = {
  clean_lower: "A crisp lower-third subtitle with soft shadow for general business videos.",
  cinematic_gold: "Warm gold typography with cinematic contrast for premium storytelling.",
  neon_pop: "Bright outlined captions for punchy social and creator-style edits.",
  editorial_stack: "High-contrast editorial blocks for clean magazine-style pacing.",
  minimal_box: "A compact dark caption box that stays readable over busy footage.",
  karaoke_wave: "Energetic teal captions designed for music, rhythm, and emphasis.",
}

const visualStyleDescriptions: Record<AiVideoAgentVisualStyle, string> = {
  "2d_cel": "Flat cel-shaded frames with clean edges and expressive color blocks.",
  "3d_blindbox_clay": "Toy-like 3D forms, soft clay surfaces, and collectible character charm.",
  cyberpunk: "High-contrast neon, dense city light, and futuristic visual energy.",
  realistic_cinematic: "Natural lighting, lens depth, and grounded cinematic realism.",
}

const visualStyleIcons: Record<AiVideoAgentVisualStyle, React.ReactNode> = {
  "2d_cel": <Palette className="size-5" />,
  "3d_blindbox_clay": <Box className="size-5" />,
  cyberpunk: <Sparkles className="size-5" />,
  realistic_cinematic: <ImageIcon className="size-5" />,
}

const presentationFormatDescriptions: Record<AiVideoAgentPresentationFormat, string> = {
  podcast: "Conversation-led framing with a host-like rhythm and focused talk-show pacing.",
  commentary: "Narrated explainer structure with direct analysis and clear emphasis.",
  visual_novel: "Character-driven visual scenes with story beats and staged dialogue energy.",
  realistic: "Direct real-world presentation with practical, documentary-like clarity.",
}

const presentationFormatIcons: Record<AiVideoAgentPresentationFormat, React.ReactNode> = {
  podcast: <Radio className="size-5" />,
  commentary: <Mic2 className="size-5" />,
  visual_novel: <Clapperboard className="size-5" />,
  realistic: <MonitorPlay className="size-5" />,
}

const captionPreviewStyles: Record<AiVideoAgentCaptionStyle, { className: string; fontLabel: string }> = {
  clean_lower: {
    className: "font-sans text-[22px] font-black text-white [text-shadow:0_3px_16px_rgba(0,0,0,.86)]",
    fontLabel: "Bold Sans",
  },
  cinematic_gold: {
    className: "font-serif text-[22px] font-black text-[#f8d66d] [text-shadow:0_3px_18px_rgba(0,0,0,.9)]",
    fontLabel: "Serif Gold",
  },
  neon_pop: {
    className: "rounded-full border-2 border-cyan-300 bg-slate-950/78 px-3 py-1 font-sans text-[22px] font-black text-fuchsia-100 [text-shadow:0_0_10px_rgba(217,70,239,.85)]",
    fontLabel: "Pop Outline",
  },
  editorial_stack: {
    className: "rounded-full bg-white/95 px-3 py-1 font-sans text-xl font-black uppercase tracking-wide text-slate-950",
    fontLabel: "Editorial Caps",
  },
  minimal_box: {
    className: "rounded-xl bg-black/72 px-3 py-1.5 font-sans text-[22px] font-extrabold text-white",
    fontLabel: "Compact Sans",
  },
  karaoke_wave: {
    className: "font-sans text-[22px] font-black italic text-teal-200 [text-shadow:0_0_14px_rgba(45,212,191,.72),0_3px_14px_rgba(0,0,0,.88)]",
    fontLabel: "Karaoke Italic",
  },
}

const captionEffectPreviewStyles: Record<AiVideoAgentCaptionEffect, { className: string; fontLabel: string }> = {
  system_bold: { className: "font-sans font-black", fontLabel: "System Bold" },
  rounded_sans: { className: "font-sans font-black", fontLabel: "Rounded Sans" },
  serif_song: { className: "font-serif font-black", fontLabel: "Serif Song" },
  gothic_hei: { className: "font-sans font-black uppercase", fontLabel: "Gothic Hei" },
  mono_tech: { className: "font-mono font-extrabold", fontLabel: "Mono Tech" },
  handwritten_play: { className: "font-serif italic font-black", fontLabel: "Handwritten" },
}

export function CreateAiVideoAgentClient() {
  const router = useRouter()
  const [avatars, setAvatars] = useState<AiAvatar[]>([])
  const [voices, setVoices] = useState<VoiceListItem[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("New AI video")
  const [scriptMode, setScriptMode] = useState<"manual" | "topic">("manual")
  const [topic, setTopic] = useState("")
  const [script, setScript] = useState("")
  const [avatarId, setAvatarId] = useState("")
  const [voiceId, setVoiceId] = useState("")
  const [durationSeconds, setDurationSeconds] = useState<AiVideoAgentDuration>(5)
  const [sceneCount, setSceneCount] = useState<AiVideoAgentSceneCount>(1)
  const [aspectRatio, setAspectRatio] = useState<AiVideoAgentAspectRatio>("16:9")
  const [captionStyle, setCaptionStyle] = useState<AiVideoAgentCaptionStyle>("clean_lower")
  const [captionEffect, setCaptionEffect] = useState<AiVideoAgentCaptionEffect>("system_bold")
  const [visualStyle, setVisualStyle] = useState<AiVideoAgentVisualStyle>("2d_cel")
  const [presentationFormat, setPresentationFormat] = useState<AiVideoAgentPresentationFormat>("podcast")
  const [timeline, setTimeline] = useState<AiVideoAgentTimeline | null>(null)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeProject, setActiveProject] = useState<AiVideoAgentProject | null>(null)
  const [loadingVoiceId, setLoadingVoiceId] = useState("")
  const [playingVoiceId, setPlayingVoiceId] = useState("")
  const [error, setError] = useState("")
  const [activeSceneIndex, setActiveSceneIndex] = useState(0)
  const [renderingFinal, setRenderingFinal] = useState(false)
  const [sceneCaptionEffects, setSceneCaptionEffects] = useState<Record<string, AiVideoAgentCaptionEffect>>({})
  const [transitionSettings, setTransitionSettings] = useState<Record<string, AiVideoAgentSceneTransition>>({})
  const pollRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const defaultPreviewUrlsRef = useRef<Record<string, string>>({})

  const selectedAvatar = useMemo(() => avatars.find((item) => item.id === avatarId) || avatars.find((item) => item.is_selected) || avatars[0] || null, [avatars, avatarId])
  const selectedVoice = useMemo(() => voices.find((item) => item.id === voiceId) || voices.find((item) => item.is_selected) || voices[0] || null, [voices, voiceId])
  const groupedAvatars = useMemo(() => ({
    custom: avatars.filter((avatar) => avatar.source !== "default"),
    default: avatars.filter((avatar) => avatar.source === "default"),
  }), [avatars])
  const groupedVoices = useMemo(() => ({
    custom: voices.filter((voice) => voice.source === "custom"),
    default: voices.filter((voice) => voice.source === "default"),
  }), [voices])
  const credits = useMemo(() => getAiVideoAgentCreditCost({ durationSeconds, sceneCount }), [durationSeconds, sceneCount])
  const isActive = activeProject ? activeStatuses.has(activeProject.status) : false
  const canSubmit = Boolean(title.trim() && selectedAvatar && selectedVoice && (scriptMode === "manual" ? script.trim() : topic.trim() || script.trim())) && !submitting && !isActive

  const loadInitial = useCallback(async () => {
    const response = await apiFetch("/api/ai-video-agent")
    const body = await readJson<AiVideoAgentInitialData>(response)
    setAvatars(body.avatars)
    setVoices(body.voices)
    setCreditBalance(body.creditBalance)
    setAvatarId((current) => current || body.avatars.find((item) => item.is_selected)?.id || body.avatars[0]?.id || "")
    setVoiceId((current) => current || body.voices.find((item) => item.is_selected)?.id || body.voices[0]?.id || "")
  }, [])

  const pollProject = useCallback(async (projectId: string) => {
    try {
      const response = await apiFetch(`/api/ai-video-agent/jobs/${projectId}`)
      const body = await readJson<{ project: AiVideoAgentProject; creditBalance: number | null }>(response)
      setActiveProject(body.project)
      if (typeof body.creditBalance === "number") setCreditBalance(body.creditBalance)
      if (body.project.status === "completed") {
        showAppToast("AI video preview is ready.", { description: "Open the library to render or download." })
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not refresh status.")
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const defaultPreviewUrls = defaultPreviewUrlsRef.current
    const timeout = window.setTimeout(() => {
      loadInitial().catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Could not load form data.")).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      if (pollRef.current) window.clearInterval(pollRef.current)
      audioRef.current?.pause()
      audioRef.current = null
      Object.values(defaultPreviewUrls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [loadInitial])

  useEffect(() => {
    if (!activeProject || !activeStatuses.has(activeProject.status)) return
    pollRef.current = window.setInterval(() => {
      pollProject(activeProject.id)
    }, 3000)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [activeProject, pollProject])

  async function generateScript() {
    if (!topic.trim() || generatingScript) return
    setGeneratingScript(true)
    setError("")
    try {
      const response = await apiFetch("/api/ai-video-agent/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspectRatio, script, topic, durationSeconds, sceneCount }),
      })
      const body = await readJson<{ script: string; timeline: AiVideoAgentTimeline }>(response)
      setScript(body.script)
      setTimeline(body.timeline)
      setScriptMode("manual")
      showAppToast("Timeline generated.", { description: "Review scenes and dialogue before launching the agent." })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not generate script.")
    } finally {
      setGeneratingScript(false)
    }
  }

  async function playVoicePreview(voice: VoiceListItem) {
    if (playingVoiceId === voice.id) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingVoiceId("")
      return
    }

    audioRef.current?.pause()
    audioRef.current = null
    setPlayingVoiceId("")
    setLoadingVoiceId(voice.id)
    setError("")

    try {
      let audioUrl = voice.preview_audio_url || ""
      if (!audioUrl && voice.source === "custom") audioUrl = voice.sample_audio_url || ""

      if (!audioUrl && voice.source === "default") {
        audioUrl = defaultPreviewUrlsRef.current[voice.id] || ""
        if (!audioUrl) {
          const response = await apiFetch("/api/voices/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voiceId: voice.id }),
          })
          const contentType = response.headers.get("Content-Type") || ""
          if (!response.ok || contentType.includes("application/json")) {
            const body = (await response.json().catch(() => ({}))) as { message?: string }
            throw new Error(body.message || "Could not generate voice preview.")
          }
          audioUrl = URL.createObjectURL(await response.blob())
          defaultPreviewUrlsRef.current[voice.id] = audioUrl
        }
      }

      if (!audioUrl) throw new Error("This voice does not have a preview yet.")

      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null
          setPlayingVoiceId("")
        }
      }
      audio.onpause = () => {
        if (audioRef.current === audio && !audio.ended) {
          audioRef.current = null
          setPlayingVoiceId("")
        }
      }
      setPlayingVoiceId(voice.id)
      await audio.play()
    } catch (nextError) {
      audioRef.current = null
      setPlayingVoiceId("")
      setError(nextError instanceof Error ? nextError.message : "Could not play voice preview.")
    } finally {
      setLoadingVoiceId("")
    }
  }

  async function submit() {
    if (!canSubmit || !selectedAvatar || !selectedVoice) return
    setSubmitting(true)
    setError("")
    try {
      const response = await apiFetch("/api/ai-video-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          scriptMode,
          topic,
          script,
          avatarId: selectedAvatar.id,
          voiceId: selectedVoice.id,
          durationSeconds,
          aspectRatio,
          captionStyle,
          captionEffect,
          bRollStyle: "ai_video",
          sceneCount,
          visualStyle,
          presentationFormat,
          timeline,
        }),
      })
      const body = await readJson<{ project: AiVideoAgentProject; creditBalance: number }>(response)
      setActiveProject(body.project)
      setCreditBalance(body.creditBalance)
      showAppToast("AI video agent started.", { description: `${body.project.credits_cost} credits were reserved.` })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start generation.")
    } finally {
      setSubmitting(false)
    }
  }

  async function renderFinalVideo() {
    if (!activeProject || renderingFinal) return
    setRenderingFinal(true)
    setError("")
    try {
      const composition = buildEditedComposition(activeProject, sceneCaptionEffects, transitionSettings)
      const response = await apiFetch(`/api/ai-video-agent/${activeProject.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composition }),
      })
      const body = await readJson<{ project: AiVideoAgentProject }>(response)
      setActiveProject(body.project)
      showAppToast("Final render started.", { description: "The scene sequence is being combined into one video." })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start final render.")
    } finally {
      setRenderingFinal(false)
    }
  }

  if (loading) return <Skeleton className="h-[720px] rounded-xl" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button nativeButton={false} render={<Link href="/dashboard/ai-video-agent" />} variant="outline">
          <ArrowLeft />
          Library
        </Button>
        <div className="rounded-lg border border-border/70 bg-card/95 px-4 py-2 text-sm shadow-sm">
          <span className="text-muted-foreground">Credits </span>
          <span className="font-semibold">{creditBalance ?? "..."}</span>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-5">
          <Panel title="Project" icon={<Film className="size-4" />}>
            <Label htmlFor="title">Video name</Label>
            <Input id="title" disabled={isActive || submitting} value={title} onChange={(event) => setTitle(event.target.value)} />
          </Panel>

          <Panel title="Script" icon={<WandSparkles className="size-4" />}>
            <div className="grid grid-cols-2 gap-2">
              {(["manual", "topic"] as const).map((mode) => (
                <Button key={mode} disabled={isActive || submitting} variant={scriptMode === mode ? "default" : "outline"} onClick={() => setScriptMode(mode)}>
                  {mode === "manual" ? "Manual" : "Topic"}
                </Button>
              ))}
            </div>
            {scriptMode === "topic" ? (
              <div className="grid gap-3">
                <Label htmlFor="topic">Topic</Label>
                <Input id="topic" disabled={isActive || submitting} value={topic} onChange={(event) => setTopic(event.target.value)} />
                <Button disabled={!topic.trim() || generatingScript} onClick={generateScript}>
                  {generatingScript ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                  Generate Script
                </Button>
              </div>
            ) : null}
            <Label htmlFor="script">Voiceover script</Label>
            <Textarea id="script" className="min-h-44 resize-none" disabled={isActive || submitting} value={script} onChange={(event) => setScript(event.target.value)} />
          </Panel>

          <Panel title="Format" icon={<LayoutTemplate className="size-4" />}>
            <ChoiceGrid description="Single scene video length" label="Duration">
              {aiVideoAgentDurations.map((item) => <Choice key={item} active={durationSeconds === item} disabled={isActive || submitting} onClick={() => setDurationSeconds(item)}>{item}s</Choice>)}
            </ChoiceGrid>
            <ChoiceGrid label="Scene count">
              {aiVideoAgentSceneCounts.map((item) => <Choice key={item} active={sceneCount === item} disabled={isActive || submitting} onClick={() => setSceneCount(item)}>{item}</Choice>)}
            </ChoiceGrid>
            <ChoiceGrid label="Screen size">
              {aiVideoAgentAspectRatios.map((item) => <Choice key={item} active={aspectRatio === item} disabled={isActive || submitting} onClick={() => setAspectRatio(item)}>{item}</Choice>)}
            </ChoiceGrid>
          </Panel>

          <Panel title="Avatar" icon={<UserRound className="size-4" />}>
            <div className="grid gap-4">
              <ChoiceGroupCard
                contentClassName="max-h-[430px] overflow-y-auto overscroll-contain rounded-lg bg-muted/25 p-3 ring-1 ring-border/70"
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
                      disabled={isActive || submitting}
                      selected={selectedAvatar?.id === avatar.id}
                      onSelect={() => setAvatarId(avatar.id)}
                    />
                  ))}
                </div>
                {!groupedAvatars.custom.length ? <ChoiceEmptyState message="Create an avatar first, then it will appear here." /> : null}
              </ChoiceGroupCard>

              <ChoiceGroupCard
                contentClassName="max-h-[430px] overflow-y-auto overscroll-contain rounded-lg bg-muted/25 p-3 ring-1 ring-border/70"
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
                      disabled={isActive || submitting}
                      selected={selectedAvatar?.id === avatar.id}
                      onSelect={() => setAvatarId(avatar.id)}
                    />
                  ))}
                </div>
                {!groupedAvatars.default.length ? <ChoiceEmptyState message="Default avatars are still loading or unavailable." /> : null}
              </ChoiceGroupCard>
            </div>
          </Panel>

          <Panel title="Voice" icon={<Mic2 className="size-4" />}>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChoiceGroupCard
                contentClassName="max-h-[288px] overflow-y-auto overscroll-contain rounded-lg bg-muted/25 p-3 ring-1 ring-border/70"
                count={groupedVoices.custom.length}
                description="Cloned voices prepared from your samples."
                icon={<WandSparkles className="size-4" />}
                title="Custom"
              >
                <div className="grid gap-3">
                  {groupedVoices.custom.map((voice) => (
                    <VoiceChoice
                      key={voice.id}
                      disabled={isActive || submitting}
                      loading={loadingVoiceId === voice.id}
                      playing={playingVoiceId === voice.id}
                      selected={selectedVoice?.id === voice.id}
                      voice={voice}
                      onPlay={() => playVoicePreview(voice)}
                      onSelect={() => setVoiceId(voice.id)}
                    />
                  ))}
                </div>
                {!groupedVoices.custom.length ? <ChoiceEmptyState message="Clone a voice to unlock custom narration." /> : null}
              </ChoiceGroupCard>

              <ChoiceGroupCard
                contentClassName="max-h-[288px] overflow-y-auto overscroll-contain rounded-lg bg-muted/25 p-3 ring-1 ring-border/70"
                count={groupedVoices.default.length}
                description="Curated voices for fast AI Video Agent generation."
                icon={<Mic2 className="size-4" />}
                title="Default"
              >
                <div className="grid gap-3">
                  {groupedVoices.default.map((voice) => (
                    <VoiceChoice
                      key={voice.id}
                      disabled={isActive || submitting}
                      loading={loadingVoiceId === voice.id}
                      playing={playingVoiceId === voice.id}
                      selected={selectedVoice?.id === voice.id}
                      voice={voice}
                      onPlay={() => playVoicePreview(voice)}
                      onSelect={() => setVoiceId(voice.id)}
                    />
                  ))}
                </div>
                {!groupedVoices.default.length ? <ChoiceEmptyState message="Default voices are still loading or unavailable." /> : null}
              </ChoiceGroupCard>
            </div>
          </Panel>

          <Panel title="Select caption style" icon={<LayoutTemplate className="size-4" />}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {aiVideoAgentCaptionStyles.map((item) => (
                <CaptionStyleChoice
                  key={item}
                  active={captionStyle === item}
                  description={captionStyleDescriptions[item]}
                  disabled={isActive || submitting}
                  captionEffect={captionEffect}
                  label={aiVideoAgentCaptionStyleLabels[item]}
                  styleKey={item}
                  onClick={() => setCaptionStyle(item)}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Caption effects" icon={<Type className="size-4" />}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {aiVideoAgentCaptionEffects.map((item) => (
                <Choice key={item} active={captionEffect === item} disabled={isActive || submitting} onClick={() => setCaptionEffect(item)}>
                  {aiVideoAgentCaptionEffectLabels[item]}
                </Choice>
              ))}
            </div>
          </Panel>

          {timeline ? (
            <TimelineEditor
              disabled={isActive || submitting}
              timeline={timeline}
              onChange={setTimeline}
            />
          ) : null}

          <Panel title="Video style" icon={<Film className="size-4" />}>
            <ChoiceGroupCard
              contentClassName="grid gap-3 sm:grid-cols-2"
              count={aiVideoAgentVisualStyles.length}
              description="Controls the generated image and video look."
              icon={<Palette className="size-4" />}
              title="Visual Style"
            >
              {aiVideoAgentVisualStyles.map((item) => (
                <DescriptiveChoice
                  key={item}
                  active={visualStyle === item}
                  description={visualStyleDescriptions[item]}
                  disabled={isActive || submitting}
                  icon={visualStyleIcons[item]}
                  label={aiVideoAgentVisualStyleLabels[item]}
                  onClick={() => setVisualStyle(item)}
                />
              ))}
            </ChoiceGroupCard>
            <ChoiceGroupCard
              contentClassName="grid gap-3 sm:grid-cols-2"
              count={aiVideoAgentPresentationFormats.length}
              description="Controls how the content is presented to the viewer."
              icon={<MonitorPlay className="size-4" />}
              title="Presentation Formats"
            >
              {aiVideoAgentPresentationFormats.map((item) => (
                <DescriptiveChoice
                  key={item}
                  active={presentationFormat === item}
                  description={presentationFormatDescriptions[item]}
                  disabled={isActive || submitting}
                  icon={presentationFormatIcons[item]}
                  label={aiVideoAgentPresentationFormatLabels[item]}
                  onClick={() => setPresentationFormat(item)}
                />
              ))}
            </ChoiceGroupCard>
          </Panel>

          <Button className="h-11 w-full" disabled={!canSubmit} onClick={submit}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            Generate AI Video
          </Button>
        </section>

        <PreviewPanel
          activeProject={activeProject}
          aspectRatio={aspectRatio}
          avatar={selectedAvatar}
          captionStyle={captionStyle}
          captionEffect={captionEffect}
          credits={credits}
          durationSeconds={durationSeconds}
          activeSceneIndex={activeSceneIndex}
          presentationFormat={presentationFormat}
          renderingFinal={renderingFinal}
          sceneCaptionEffects={sceneCaptionEffects}
          sceneCount={sceneCount}
          transitionSettings={transitionSettings}
          visualStyle={visualStyle}
          voice={selectedVoice}
          onOpenLibrary={() => router.push("/dashboard/ai-video-agent")}
          onRenderFinal={renderFinalVideo}
          onSceneCaptionEffectChange={(sceneId, value) => setSceneCaptionEffects((current) => ({ ...current, [sceneId]: value }))}
          onSceneChange={setActiveSceneIndex}
          onTransitionChange={(sceneId, values) => setTransitionSettings((current) => ({
            ...current,
            [sceneId]: { ...(current[sceneId] || buildDefaultTransition(sceneId, activeSceneIndex)), ...values },
          }))}
        />
      </div>
    </div>
  )
}

function Panel({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-border/70 bg-card/95 p-4 shadow-sm backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  )
}

function ChoiceGrid({ children, description, label }: { children: React.ReactNode; description?: string; label: string }) {
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

function Choice({ active, children, disabled, onClick }: { active: boolean; children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button className={cn("rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60", active ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-background")} disabled={disabled} type="button" onClick={onClick}>
      {children}
    </button>
  )
}

function CaptionStyleChoice({
  active,
  captionEffect,
  description,
  disabled,
  label,
  onClick,
  styleKey,
}: {
  active: boolean
  captionEffect: AiVideoAgentCaptionEffect
  description: string
  disabled: boolean
  label: string
  onClick: () => void
  styleKey: AiVideoAgentCaptionStyle
}) {
  const previewStyle = captionPreviewStyles[styleKey]
  const effectStyle = captionEffectPreviewStyles[captionEffect]

  return (
    <button
      className={cn(
        "rounded-lg border bg-card/95 p-4 text-left transition hover:border-border hover:shadow-[0_10px_28px_rgb(0_0_0_/_0.07)] disabled:cursor-not-allowed disabled:opacity-60",
        active ? "border-primary ring-2 ring-primary/25" : "border-border/70"
      )}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <div className="relative mb-4 grid aspect-video place-items-center overflow-hidden rounded-lg border border-dashed border-border/80 bg-transparent p-4">
        <div className="flex size-full items-center justify-center">
          <span className={cn("inline-block max-w-full whitespace-nowrap text-center leading-tight", previewStyle.className, effectStyle.className)}>
            {demoCaptionText}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{label}</h4>
        {active ? <Check className="size-4 text-primary" /> : null}
      </div>
      <p className="mt-1 text-xs font-medium text-primary">{previewStyle.fontLabel} / {effectStyle.fontLabel}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  )
}

function DescriptiveChoice({
  active,
  description,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean
  description: string
  disabled: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        "min-h-28 rounded-lg border bg-card/95 p-4 text-left transition hover:border-border hover:shadow-[0_10px_28px_rgb(0_0_0_/_0.07)] disabled:cursor-not-allowed disabled:opacity-60",
        active ? "border-primary ring-2 ring-primary/25" : "border-border/70"
      )}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            {icon}
          </span>
          <h4 className="text-sm font-semibold">{label}</h4>
        </div>
        {active ? <Check className="size-4 text-primary" /> : null}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  )
}

function buildDefaultTransition(sceneId: string, sceneIndex: number): AiVideoAgentSceneTransition {
  return {
    sceneId,
    sceneIndex,
    effect: "crossfade",
    fadeInSeconds: 0.5,
    fadeOutSeconds: 0.5,
  }
}

function buildEditedComposition(
  project: AiVideoAgentProject,
  sceneCaptionEffects: Record<string, AiVideoAgentCaptionEffect>,
  transitionSettings: Record<string, AiVideoAgentSceneTransition>
) {
  const scenes = project.composition?.scenes || []
  const sourceCaptionEffects = project.composition?.captionEffects && typeof project.composition.captionEffects === "object"
    ? project.composition.captionEffects as Record<string, AiVideoAgentCaptionEffect>
    : {}
  const sourceTransitions = new Map((project.composition?.transitions || []).map((item) => [String(item.sceneId), item]))
  return {
    ...project.composition,
    captionEffect: project.caption_effect,
    captionEffects: Object.fromEntries(scenes.map((scene, index) => {
      const sceneId = String(scene.id || `scene-${index + 1}`)
      return [sceneId, sceneCaptionEffects[sceneId] || sourceCaptionEffects[sceneId] || project.caption_effect || "system_bold"]
    })),
    transitions: scenes.map((scene, index) => {
      const sceneId = String(scene.id || `scene-${index + 1}`)
      return transitionSettings[sceneId] || sourceTransitions.get(sceneId) || buildDefaultTransition(sceneId, index)
    }),
  }
}

function buildScenePreviewComposition(composition: AiVideoAgentProject["composition"], activeSceneIndex: number) {
  const scenes = composition.scenes || []
  const scene = scenes[Math.min(activeSceneIndex, Math.max(0, scenes.length - 1))]
  if (!scene) return composition

  const start = Number(scene.startSeconds || 0)
  const end = Number(scene.endSeconds || start + Number(composition.durationSeconds || 5))
  const duration = Math.max(1, end - start)
  const sceneId = String(scene.id || `scene-${activeSceneIndex + 1}`)
  const assets = Array.isArray(scene.assets) ? scene.assets as Array<Record<string, unknown>> : []
  const shiftedAssets = assets.map((asset) => {
    const metadata = asset.metadata && typeof asset.metadata === "object" ? asset.metadata as Record<string, unknown> : {}
    return {
      ...asset,
      metadata: {
        ...metadata,
        startSeconds: Math.max(0, Number(metadata.startSeconds || 0) - start),
        endSeconds: Math.max(0, Number(metadata.endSeconds || 0) - start),
      },
    }
  })

  return {
    ...composition,
    durationSeconds: duration,
    scenes: [{
      ...scene,
      startSeconds: 0,
      endSeconds: duration,
      assets: shiftedAssets,
    }],
    captions: (composition.captions || [])
      .filter((caption) => Number(caption.end) >= start && Number(caption.start) <= end)
      .map((caption) => ({
        ...caption,
        start: Math.max(0, Number(caption.start) - start),
        end: Math.min(duration, Math.max(0, Number(caption.end) - start)),
      }))
      .filter((caption) => Number(caption.end) > Number(caption.start)),
    captionEffects: {
      [sceneId]: (composition.captionEffects as Record<string, AiVideoAgentCaptionEffect> | undefined)?.[sceneId] || composition.captionEffect || "system_bold",
    },
    transitions: (composition.transitions || [])
      .filter((transition) => transition.sceneId === sceneId || transition.sceneIndex === activeSceneIndex)
      .map((transition) => ({ ...transition, sceneIndex: 0 })),
  }
}

function TimelineEditor({
  disabled,
  onChange,
  timeline,
}: {
  disabled: boolean
  onChange: (timeline: AiVideoAgentTimeline) => void
  timeline: AiVideoAgentTimeline
}) {
  function updateScene(sceneIndex: number, values: Partial<AiVideoAgentTimeline["scenes"][number]>) {
    onChange({
      ...timeline,
      scenes: timeline.scenes.map((scene, index) => index === sceneIndex ? { ...scene, ...values } : scene),
    })
  }

  function updateVisual(sceneIndex: number, values: Partial<AiVideoAgentTimeline["scenes"][number]["visual"]>) {
    const scene = timeline.scenes[sceneIndex]
    updateScene(sceneIndex, { visual: { ...scene.visual, ...values } })
  }

  function updateDialogue(sceneIndex: number, dialogueIndex: number, values: Partial<AiVideoAgentTimeline["scenes"][number]["dialogues"][number]>) {
    const scene = timeline.scenes[sceneIndex]
    updateScene(sceneIndex, {
      dialogues: scene.dialogues.map((dialogue, index) => index === dialogueIndex ? { ...dialogue, ...values } : dialogue),
    })
  }

  return (
    <Panel title="Script timeline" icon={<Film className="size-4" />}>
      <div className="grid gap-4">
        {timeline.scenes.map((scene, sceneIndex) => (
          <section key={scene.id || sceneIndex} className="rounded-lg border border-border/70 bg-muted/15 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px]">
              <div className="grid gap-2">
                <Label>Scene title</Label>
                <Input disabled={disabled} value={scene.title} onChange={(event) => updateScene(sceneIndex, { title: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Start</Label>
                <Input disabled={disabled} type="number" value={scene.startSeconds} onChange={(event) => updateScene(sceneIndex, { startSeconds: Number(event.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>End</Label>
                <Input disabled={disabled} type="number" value={scene.endSeconds} onChange={(event) => updateScene(sceneIndex, { endSeconds: Number(event.target.value) })} />
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
              <div className="grid gap-2">
                <Label>Visual source</Label>
                <select
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  disabled={disabled}
                  value={scene.visual.source}
                  onChange={(event) => updateVisual(sceneIndex, { source: event.target.value as AiVideoAgentVisualSource })}
                >
                  <option value="auto">Auto</option>
                  <option value="ai">AI image</option>
                  <option value="pixabay">Pixabay</option>
                  <option value="upload">Upload</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Visual prompt</Label>
                <Input disabled={disabled} value={scene.visual.prompt} onChange={(event) => updateVisual(sceneIndex, { prompt: event.target.value })} />
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {scene.dialogues.map((dialogue, dialogueIndex) => (
                <div key={dialogue.id || dialogueIndex} className="grid gap-2 rounded-lg border border-border/60 bg-background/70 p-3 md:grid-cols-[110px_110px_minmax(0,1fr)]">
                  <Input disabled={disabled} type="number" value={dialogue.startSeconds} onChange={(event) => updateDialogue(sceneIndex, dialogueIndex, { startSeconds: Number(event.target.value) })} />
                  <Input disabled={disabled} type="number" value={dialogue.endSeconds} onChange={(event) => updateDialogue(sceneIndex, dialogueIndex, { endSeconds: Number(event.target.value) })} />
                  <Textarea disabled={disabled} className="min-h-16 resize-none" value={dialogue.text} onChange={(event) => updateDialogue(sceneIndex, dialogueIndex, { text: event.target.value })} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  )
}

function PreviewPanel({
  activeSceneIndex,
  activeProject,
  aspectRatio,
  avatar,
  captionEffect,
  captionStyle,
  credits,
  durationSeconds,
  onOpenLibrary,
  onRenderFinal,
  onSceneCaptionEffectChange,
  onSceneChange,
  onTransitionChange,
  presentationFormat,
  renderingFinal,
  sceneCaptionEffects,
  sceneCount,
  transitionSettings,
  visualStyle,
  voice,
}: {
  activeSceneIndex: number
  activeProject: AiVideoAgentProject | null
  aspectRatio: AiVideoAgentAspectRatio
  avatar: AiAvatar | null
  captionEffect: AiVideoAgentCaptionEffect
  captionStyle: AiVideoAgentCaptionStyle
  credits: number
  durationSeconds: AiVideoAgentDuration
  onOpenLibrary: () => void
  onRenderFinal: () => void
  onSceneCaptionEffectChange: (sceneId: string, value: AiVideoAgentCaptionEffect) => void
  onSceneChange: (index: number) => void
  onTransitionChange: (sceneId: string, values: Partial<AiVideoAgentSceneTransition>) => void
  presentationFormat: AiVideoAgentPresentationFormat
  renderingFinal: boolean
  sceneCaptionEffects: Record<string, AiVideoAgentCaptionEffect>
  sceneCount: number
  transitionSettings: Record<string, AiVideoAgentSceneTransition>
  visualStyle: AiVideoAgentVisualStyle
  voice: VoiceListItem | null
}) {
  const dimensions = getAiVideoAgentDimensions(aspectRatio)
  const completed = activeProject?.status === "completed"
  const progress = activeProject?.progress || 0
  const avatarImageUrl = avatar ? getAvatarPreviewImageUrl(avatar, aspectRatio) : ""
  const projectComposition = activeProject?.composition && Object.keys(activeProject.composition).length
    ? buildEditedComposition(activeProject, sceneCaptionEffects, transitionSettings)
    : null
  const previewComposition = projectComposition
    ? buildScenePreviewComposition(projectComposition, activeSceneIndex)
    : null
  const previewDuration = Math.max(1, Number(previewComposition?.durationSeconds || durationSeconds))
  const previewSceneKey = String(previewComposition?.scenes?.[0]?.id || activeSceneIndex)
  const sceneOptions = projectComposition?.scenes || []
  const activeScene = sceneOptions[Math.min(activeSceneIndex, Math.max(0, sceneOptions.length - 1))]
  const activeSceneId = String(activeScene?.id || "")
  const activeTransition = activeSceneId ? transitionSettings[activeSceneId] || buildDefaultTransition(activeSceneId, activeSceneIndex) : null
  const draftComposition = {
    id: "draft",
    title: "Draft preview",
    durationSeconds,
    fps: 30,
    ...dimensions,
    aspectRatio,
    captionStyle,
    captionEffect,
    visualStyle,
    presentationFormat,
    sceneCount,
    scenes: [{
      id: "draft-scene",
      startSeconds: 0,
      endSeconds: durationSeconds,
      title: avatar?.name || "Live Preview",
      captionText: demoCaptionText,
      assets: avatarImageUrl ? [{ asset_type: "avatar_clip", assetType: "avatar_clip", url: avatarImageUrl }] : [],
    }],
    captions: [{ text: demoCaptionText, start: 0, end: Math.min(4, durationSeconds) }],
  }

  return (
    <aside className="xl:sticky xl:top-24 xl:self-start">
      <div className="space-y-4 rounded-lg border border-border/70 bg-card/95 p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Live preview</h3>
            <p className="mt-1 text-sm text-muted-foreground">{sceneCount} scenes, {durationSeconds}s each</p>
          </div>
          <Badge variant="outline"><CircleDollarSign className="size-3" />{credits}</Badge>
        </div>
        {sceneOptions.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sceneOptions.map((scene, index) => (
              <Button key={String(scene.id || index)} size="sm" variant={activeSceneIndex === index ? "default" : "outline"} onClick={() => onSceneChange(index)}>
                Scene {index + 1}
              </Button>
            ))}
          </div>
        ) : null}
        <div className={cn("mx-auto overflow-hidden rounded-xl border border-border bg-black", aspectRatio === "9:16" ? "aspect-[9/16] max-h-[640px] w-[82%]" : "aspect-video w-full")}>
          <Player
            key={`${activeProject?.id || "draft"}-${previewSceneKey}-${previewDuration}`}
            acknowledgeRemotionLicense
            component={AiVideoAgentRemotion}
            compositionHeight={dimensions.height}
            compositionWidth={dimensions.width}
            controls
            durationInFrames={Math.max(1, previewDuration * 30)}
            fps={30}
            inputProps={{ composition: previewComposition || draftComposition }}
            style={{ height: "100%", width: "100%" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat icon={<UserRound className="size-4" />} label="Avatar" value={avatar?.name || "Not selected"} />
          <Stat icon={<Mic2 className="size-4" />} label="Voice" value={voice?.name || "Not selected"} />
          <Stat icon={<LayoutTemplate className="size-4" />} label="Ratio" value={aspectRatio} />
          <Stat icon={<Film className="size-4" />} label="Style" value={aiVideoAgentVisualStyleLabels[visualStyle]} />
        </div>
        {completed && activeSceneId && activeTransition ? (
          <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="grid gap-2">
              <Label>Scene caption font</Label>
              <select
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={sceneCaptionEffects[activeSceneId] || captionEffect}
                onChange={(event) => onSceneCaptionEffectChange(activeSceneId, event.target.value as AiVideoAgentCaptionEffect)}
              >
                {aiVideoAgentCaptionEffects.map((item) => <option key={item} value={item}>{aiVideoAgentCaptionEffectLabels[item]}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Fade in</Label>
                <select
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  value={activeTransition.fadeInSeconds}
                  onChange={(event) => onTransitionChange(activeSceneId, { fadeInSeconds: Number(event.target.value) as AiVideoAgentTransitionDuration })}
                >
                  {aiVideoAgentTransitionDurations.map((item) => <option key={item} value={item}>{item}s</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Fade out</Label>
                <select
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  value={activeTransition.fadeOutSeconds}
                  onChange={(event) => onTransitionChange(activeSceneId, { fadeOutSeconds: Number(event.target.value) as AiVideoAgentTransitionDuration })}
                >
                  {aiVideoAgentTransitionDurations.map((item) => <option key={item} value={item}>{item}s</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Effect</Label>
                <select
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  value={activeTransition.effect}
                  onChange={(event) => onTransitionChange(activeSceneId, { effect: event.target.value as AiVideoAgentTransitionEffect })}
                >
                  {aiVideoAgentTransitionEffects.map((item) => <option key={item} value={item}>{aiVideoAgentTransitionEffectLabels[item]}</option>)}
                </select>
              </div>
            </div>
          </div>
        ) : null}
        <Progress className="avatar-progress [&_[data-slot=progress-track]]:h-3" value={progress}>
          <ProgressLabel>{activeProject?.message || "Ready to generate."}</ProgressLabel>
          <ProgressValue />
        </Progress>
        {activeProject?.error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{activeProject.error}</p> : null}
        {completed ? (
          <div className="grid gap-2">
            <Button disabled={!projectComposition || renderingFinal || Boolean(activeProject?.final_video_url)} onClick={onRenderFinal}>
              {renderingFinal ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}
              Render final video
            </Button>
            <Button onClick={onOpenLibrary} variant="outline">
              <Check />
              Open Library
            </Button>
          </div>
        ) : activeProject ? (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Agent is working</div>
        ) : null}
      </div>
    </aside>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs uppercase">{label}</span></div>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await getValidAccessToken()
  if (!token) throw new Error("Your session has expired. Please sign in again.")
  const makeRequest = (accessToken: string) => {
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${accessToken}`)
    return fetch(path, { ...init, headers })
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
