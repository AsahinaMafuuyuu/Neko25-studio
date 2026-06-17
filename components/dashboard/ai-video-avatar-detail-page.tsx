"use client"

import Link from "next/link"
import { ArrowLeft, CalendarDays, Download, Film, LayoutTemplate, RefreshCcw, UserRound, WandSparkles } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
  DashboardError,
  DashboardPage,
} from "@/components/dashboard/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { getValidAccessToken, refreshSession } from "@/lib/insforge"
import type { AiVideoAvatarVideo } from "@/lib/video-avatar-types"
import { getVideoAvatarStatusLabel } from "@/lib/video-avatar-types"
import { cn } from "@/lib/utils"

export function AiVideoAvatarDetailPage({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState<AiVideoAvatarVideo | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadVideo = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/ai-video-avatars/${videoId}`)
      const body = await readJson<{ video: AiVideoAvatarVideo; creditBalance: number }>(response)
      setVideo(body.video)
      setCreditBalance(body.creditBalance)
      setError("")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load AI video avatar.")
    }
  }, [videoId])

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      loadVideo().finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadVideo])

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="aspect-video rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (error || !video) {
    return (
      <DashboardError>{error || "AI video avatar not found."}</DashboardError>
    )
  }

  const completed = video.status === "completed" && Boolean(video.video_url)
  const createdAt = new Date(video.created_at).toLocaleString()

  return (
    <DashboardPage>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button nativeButton={false} render={<Link href="/dashboard/ai-video-avatar" />} variant="outline">
          <ArrowLeft />
          Library
        </Button>
        <div className="flex flex-wrap gap-2">
          <Badge variant={video.status === "completed" ? "default" : video.status === "failed" ? "destructive" : "secondary"}>
            {getVideoAvatarStatusLabel(video.status)}
          </Badge>
          <Badge variant="outline">{creditBalance ?? "..."} credits available</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <div className={cn("overflow-hidden rounded-xl border border-border bg-muted shadow-sm", video.aspect_ratio === "9:16" ? "mx-auto aspect-[9/16] max-h-[720px] w-full max-w-md" : "aspect-video")}>
            {completed ? (
              <video className="size-full bg-black object-contain" controls poster={video.thumbnail_url || undefined} src={video.video_url} />
            ) : video.thumbnail_url || video.avatar_image_url ? (
              <img alt={video.title} className="size-full object-cover" src={video.thumbnail_url || video.avatar_image_url} />
            ) : (
              <div className="grid size-full place-items-center text-sm text-muted-foreground">Video output is not ready yet.</div>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <h2 className="text-2xl font-semibold tracking-tight">{video.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{video.script}</p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold">Generation status</h3>
            <Progress className="mt-4" value={video.progress}>
              <ProgressLabel>{video.message || getVideoAvatarStatusLabel(video.status)}</ProgressLabel>
              <ProgressValue />
            </Progress>
            {video.error ? (
              <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{video.error}</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold">Metadata</h3>
            <div className="mt-4 grid gap-3">
              <DetailRow icon={<UserRound className="size-4" />} label="Avatar" value={video.avatar_name} />
              <DetailRow icon={<WandSparkles className="size-4" />} label="Voice" value={`${video.voice_name} (${video.voice_source})`} />
              <DetailRow icon={<LayoutTemplate className="size-4" />} label="Format" value={`${video.aspect_ratio}, ${video.duration_seconds}s`} />
              <DetailRow icon={<CalendarDays className="size-4" />} label="Created" value={createdAt} />
              <DetailRow icon={<Film className="size-4" />} label="Cost" value={`${video.credits_cost} credits`} />
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <Button disabled={!completed} nativeButton={false} render={completed ? <a href={video.video_url} download /> : undefined}>
              <Download />
              Download Video
            </Button>
            <Button nativeButton={false} render={<Link href="/dashboard/ai-video-avatar/create" />} variant="outline">
              <RefreshCcw />
              Generate Another
            </Button>
          </div>
        </aside>
      </div>
    </DashboardPage>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-20 shrink-0 text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value || "-"}</span>
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
