"use client"

import Link from "next/link"
import { ArrowLeft, Download, Film, LoaderCircle, WandSparkles } from "lucide-react"
import { Player } from "@remotion/player"
import { useCallback, useEffect, useState } from "react"

import { AiVideoAgentRemotion } from "@/components/dashboard/ai-video-agent-remotion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { getValidAccessToken, refreshSession } from "@/lib/insforge"
import {
  getAiVideoAgentDimensions,
  getAiVideoAgentStatusLabel,
  type AiVideoAgentAsset,
  type AiVideoAgentCaptionEffect,
  type AiVideoAgentProject,
  type AiVideoAgentProjectDetail,
  type AiVideoAgentScene,
} from "@/lib/ai-video-agent"
import { cn } from "@/lib/utils"

export function AiVideoAgentDetailClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<AiVideoAgentProject | null>(null)
  const [scenes, setScenes] = useState<AiVideoAgentScene[]>([])
  const [assets, setAssets] = useState<AiVideoAgentAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState("")
  const [activeSceneIndex, setActiveSceneIndex] = useState(0)

  const loadProject = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/ai-video-agent/${projectId}`)
      const body = await readJson<AiVideoAgentProjectDetail>(response)
      setProject(body.project)
      setScenes(body.scenes)
      setAssets(body.assets)
      setError("")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load project.")
    }
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      loadProject().finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadProject])

  async function renderProject() {
    if (!project || rendering) return
    setRendering(true)
    setError("")
    try {
      const response = await apiFetch(`/api/ai-video-agent/${project.id}/render`, { method: "POST" })
      const body = await readJson<{ project: AiVideoAgentProject }>(response)
      setProject(body.project)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start render.")
    } finally {
      setRendering(false)
    }
  }

  if (loading) return <Skeleton className="h-[720px] rounded-xl" />
  if (error || !project) return <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">{error || "Project not found."}</div>

  const dimensions = getAiVideoAgentDimensions(project.aspect_ratio)
  const hasFinalVideo = Boolean(project.final_video_url)
  const sceneOptions = project.composition?.scenes || []
  const previewComposition = !hasFinalVideo ? buildScenePreviewComposition(project.composition, activeSceneIndex) : project.composition
  const previewDurationSeconds = Number(previewComposition.durationSeconds || project.composition.durationSeconds || project.duration_seconds)
  const previewSceneKey = String(previewComposition.scenes?.[0]?.id || activeSceneIndex)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button nativeButton={false} render={<Link href="/dashboard/ai-video-agent" />} variant="outline">
          <ArrowLeft />
          Library
        </Button>
        <div className="flex flex-wrap gap-2">
          <Badge variant={project.status === "completed" ? "default" : project.status === "failed" ? "destructive" : "secondary"}>
            {getAiVideoAgentStatusLabel(project.status)}
          </Badge>
          <Badge variant="outline">{project.scene_count} scenes</Badge>
          <Badge variant="outline">{project.credits_cost} credits</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          {!hasFinalVideo && sceneOptions.length ? (
            <div className="flex flex-wrap gap-2">
              {sceneOptions.map((scene, index) => (
                <Button key={String(scene.id || index)} size="sm" variant={activeSceneIndex === index ? "default" : "outline"} onClick={() => setActiveSceneIndex(index)}>
                  Scene {index + 1}
                </Button>
              ))}
            </div>
          ) : null}
          <div className={cn("overflow-hidden rounded-xl border border-border bg-black shadow-sm", project.aspect_ratio === "9:16" ? "mx-auto aspect-[9/16] max-h-[720px] w-full max-w-md" : "aspect-video")}>
            {hasFinalVideo ? (
              <video className="size-full object-contain" controls src={project.final_video_url} />
            ) : project.composition && Object.keys(project.composition).length ? (
              <Player
                key={`${project.id}-${previewSceneKey}-${previewDurationSeconds}`}
                acknowledgeRemotionLicense
                component={AiVideoAgentRemotion}
                compositionHeight={dimensions.height}
                compositionWidth={dimensions.width}
                controls
                durationInFrames={Math.max(1, Math.round(previewDurationSeconds * 30))}
                fps={30}
                inputProps={{ composition: previewComposition }}
                style={{ height: "100%", width: "100%" }}
              />
            ) : (
              <div className="grid size-full place-items-center text-sm text-white/70">Composition is not ready yet.</div>
            )}
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <h2 className="text-2xl font-semibold tracking-tight">{project.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{project.script || project.topic}</p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold">Generation status</h3>
            <Progress className="mt-4" value={project.progress}>
              <ProgressLabel>{project.message || getAiVideoAgentStatusLabel(project.status)}</ProgressLabel>
              <ProgressValue />
            </Progress>
            {project.error ? <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{project.error}</p> : null}
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold">Assets</h3>
            <div className="mt-4 grid gap-2 text-sm">
              <Detail label="Scenes" value={String(scenes.length)} />
              <Detail label="Assets" value={String(assets.length)} />
              <Detail label="Captions" value={String(project.captions?.length || 0)} />
              <Detail label="Format" value={`${project.aspect_ratio}, ${project.duration_seconds}s`} />
            </div>
          </div>
          <div className="grid gap-2 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <Button disabled={!project.composition || rendering || hasFinalVideo} onClick={renderProject}>
              {rendering ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}
              {hasFinalVideo ? "Final video rendered" : "Render Final"}
            </Button>
            <Button disabled={!project.final_video_url} nativeButton={false} render={project.final_video_url ? <a href={project.final_video_url} download /> : undefined} variant="outline">
              <Download />
              Download
            </Button>
            <Button nativeButton={false} render={<Link href="/dashboard/ai-video-agent/create" />} variant="outline">
              <Film />
              Create Another
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
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

  return {
    ...composition,
    durationSeconds: duration,
    scenes: [{
      ...scene,
      startSeconds: 0,
      endSeconds: duration,
      assets: assets.map((asset) => {
        const metadata = asset.metadata && typeof asset.metadata === "object" ? asset.metadata as Record<string, unknown> : {}
        return {
          ...asset,
          metadata: {
            ...metadata,
            startSeconds: Math.max(0, Number(metadata.startSeconds || 0) - start),
            endSeconds: Math.max(0, Number(metadata.endSeconds || 0) - start),
          },
        }
      }),
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
      [sceneId]: ((composition.captionEffects as Record<string, AiVideoAgentCaptionEffect> | undefined)?.[sceneId] || composition.captionEffect || "system_bold") as AiVideoAgentCaptionEffect,
    },
    transitions: (composition.transitions || []).filter((item) => String(item.sceneId) === sceneId || Number(item.sceneIndex) === activeSceneIndex),
  }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
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
