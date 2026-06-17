"use client"

import Link from "next/link"
import { Film, LoaderCircle, Plus, RefreshCcw, Trash2 } from "lucide-react"
import { Player } from "@remotion/player"
import { useCallback, useEffect, useState } from "react"

import { AiVideoAgentRemotion } from "@/components/dashboard/ai-video-agent-remotion"
import { AiVideoAgentProjectCard } from "@/components/dashboard/library-asset-cards"
import {
  DashboardActionGroup,
  DashboardEmptyState,
  DashboardError,
  DashboardMetric,
  DashboardPage,
  DashboardPageHeader,
} from "@/components/dashboard/dashboard-layout"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { showAppToast } from "@/components/ui/app-toast"
import { getValidAccessToken, refreshSession } from "@/lib/backend"
import {
  getAiVideoAgentDimensions,
  type AiVideoAgentCaptionEffect,
  type AiVideoAgentInitialData,
  type AiVideoAgentProject,
} from "@/lib/ai-video-agent"
import { cn } from "@/lib/utils"

export function AiVideoAgentClient() {
  const [projects, setProjects] = useState<AiVideoAgentProject[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [previewProject, setPreviewProject] = useState<AiVideoAgentProject | null>(null)
  const [previewSceneIndex, setPreviewSceneIndex] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<AiVideoAgentProject | null>(null)
  const [deletingId, setDeletingId] = useState("")

  const loadProjects = useCallback(async () => {
    try {
      const response = await apiFetch("/api/ai-video-agent")
      const body = await readJson<AiVideoAgentInitialData>(response)
      setProjects(body.projects)
      setCreditBalance(body.creditBalance)
      setError("")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load AI video projects.")
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      loadProjects().finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadProjects])

  async function deleteProject() {
    if (!deleteTarget || deletingId) return
    setDeletingId(deleteTarget.id)
    setError("")

    try {
      const response = await apiFetch(`/api/ai-video-agent/${deleteTarget.id}`, { method: "DELETE" })
      await readJson<{ ok: boolean }>(response)
      setProjects((current) => current.filter((item) => item.id !== deleteTarget.id))
      setPreviewProject((current) => current?.id === deleteTarget.id ? null : current)
      setDeleteTarget(null)
      showAppToast("Project deleted.", { description: "The saved AI video project was removed from your library." })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete project.")
    } finally {
      setDeletingId("")
    }
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Film}
        eyebrow="AI Video Agent"
        title="Saved Video Projects"
        description="Create, reopen, preview, render, and download multi-scene AI videos with persistent composition data."
        meta={<DashboardMetric label="Credits" value={creditBalance ?? "..."} />}
        actions={
          <DashboardActionGroup>
            <Button variant="outline" onClick={loadProjects}>
              <RefreshCcw />
              Refresh
            </Button>
            <Button nativeButton={false} render={<Link href="/dashboard/ai-video-agent/create" />}>
              <Plus />
              Create Video with AI Agent
            </Button>
          </DashboardActionGroup>
        }
      />

      {error ? <DashboardError>{error}</DashboardError> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? <ProjectSkeletons /> : null}
        {!loading && projects.map((project) => (
          <AiVideoAgentProjectCard
            key={project.id}
            project={project}
            deleting={deletingId === project.id}
            onDelete={() => setDeleteTarget(project)}
            onPreview={() => {
              setPreviewProject(project)
              setPreviewSceneIndex(0)
            }}
          />
        ))}
        {!loading && !projects.length ? <EmptyState /> : null}
      </section>

      <Dialog open={Boolean(previewProject)} onOpenChange={(open) => !open && setPreviewProject(null)}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewProject?.title || "Video preview"}</DialogTitle>
          </DialogHeader>
          {!previewProject?.final_video_url && previewProject?.composition?.scenes?.length ? (
            <div className="flex flex-wrap gap-2">
              {previewProject.composition.scenes.map((scene, index) => (
                <Button key={String(scene.id || index)} size="sm" variant={previewSceneIndex === index ? "default" : "outline"} onClick={() => setPreviewSceneIndex(index)}>
                  Scene {index + 1}
                </Button>
              ))}
            </div>
          ) : null}
          <div className={cn("mx-auto overflow-hidden rounded-xl border border-border bg-black", previewProject?.aspect_ratio === "9:16" ? "aspect-[9/16] max-h-[76vh] w-full max-w-sm" : "aspect-video w-full")}>
            {previewProject?.final_video_url ? (
              <video className="size-full object-contain" controls src={previewProject.final_video_url} />
            ) : previewProject?.composition && Object.keys(previewProject.composition).length ? (
              <RemotionPreview activeSceneIndex={previewSceneIndex} project={previewProject} />
            ) : (
              <div className="grid size-full place-items-center text-sm text-white/70">Preview is not ready yet.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deletingId && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved project and its scene records from the library. Generated storage files may remain in storage history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={Boolean(deletingId)} onClick={deleteProject}>
              {deletingId ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              {deletingId ? "Deleting" : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPage>
  )
}

function RemotionPreview({ activeSceneIndex, project }: { activeSceneIndex: number; project: AiVideoAgentProject }) {
  const dimensions = getAiVideoAgentDimensions(project.aspect_ratio)
  const composition = buildScenePreviewComposition(project.composition, activeSceneIndex)
  const durationSeconds = Number(composition.durationSeconds || project.composition.durationSeconds || project.duration_seconds)
  const sceneKey = String(composition.scenes?.[0]?.id || activeSceneIndex)
  return (
    <Player
      key={`${project.id}-${sceneKey}-${durationSeconds}`}
      acknowledgeRemotionLicense
      component={AiVideoAgentRemotion}
      compositionHeight={dimensions.height}
      compositionWidth={dimensions.width}
      controls
      durationInFrames={Math.max(1, Math.round(durationSeconds * 30))}
      fps={30}
      inputProps={{ composition }}
      style={{ height: "100%", width: "100%" }}
    />
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

function EmptyState() {
  return (
    <DashboardEmptyState
      className="sm:col-span-2 xl:col-span-3"
      icon={Film}
      title="No AI video projects yet"
      description="Build your first multi-scene video with an avatar, voiceover, B-roll, captions, and Remotion composition."
      action={
        <Button nativeButton={false} render={<Link href="/dashboard/ai-video-agent/create" />}>
          <Plus />
          Create Video with AI Agent
        </Button>
      }
    />
  )
}

function ProjectSkeletons() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="mt-4 h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-6 h-9 w-full" />
        </div>
      ))}
    </>
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
