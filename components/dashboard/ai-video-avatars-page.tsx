"use client"

import Link from "next/link"
import {
  Film,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { AiVideoAvatarVideoCard } from "@/components/dashboard/library-asset-cards"
import { Button } from "@/components/ui/button"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { showAppToast } from "@/components/ui/app-toast"
import { getValidAccessToken, refreshSession } from "@/lib/insforge"
import type { AiVideoAvatarVideo } from "@/lib/video-avatar-types"

export function AiVideoAvatarsPage() {
  const [videos, setVideos] = useState<AiVideoAvatarVideo[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [previewVideo, setPreviewVideo] = useState<AiVideoAvatarVideo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AiVideoAvatarVideo | null>(null)
  const [deletingId, setDeletingId] = useState("")

  const loadVideos = useCallback(async () => {
    try {
      const response = await apiFetch("/api/ai-video-avatars")
      const body = await readJson<{ videos: AiVideoAvatarVideo[]; creditBalance: number }>(response)
      setVideos(body.videos)
      setCreditBalance(body.creditBalance)
      setError("")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load AI video avatars.")
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      loadVideos().finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadVideos])

  async function deleteVideo(video: AiVideoAvatarVideo) {
    if (deletingId) return

    setDeletingId(video.id)
    setError("")

    try {
      const response = await apiFetch(`/api/ai-video-avatars/${video.id}`, {
        method: "DELETE",
      })
      await readJson<{ video: AiVideoAvatarVideo }>(response)
      setVideos((current) => current.filter((item) => item.id !== video.id))
      setPreviewVideo((current) => current?.id === video.id ? null : current)
      setDeleteTarget(null)
      showAppToast("Avatar video deleted.", {
        description: "The library record was removed from the cloud database.",
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete AI video avatar.")
    } finally {
      setDeletingId("")
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="size-4" />
              AI Video Avatars
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">Talking Avatar Videos</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Generate and manage AI avatar videos with selected avatars, voices, scripts, ratios, and durations.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Credits</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{creditBalance ?? "..."}</p>
            </div>
            <Button nativeButton={false} render={<Link href="/dashboard/ai-video-avatar/create" />}>
              <Plus />
              Generate New Avatar Video
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? <VideoSkeletons /> : null}

        {!loading && videos.map((video) => (
          <AiVideoAvatarVideoCard
            key={video.id}
            deleting={deletingId === video.id}
            video={video}
            onPreview={() => setPreviewVideo(video)}
            onRequestDelete={() => setDeleteTarget(video)}
          />
        ))}

        {!loading && !videos.length ? <EmptyVideoState /> : null}
      </section>

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

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deletingId && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 className="size-8" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this avatar video?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the video from your library and deletes the matching cloud database record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteTarget || Boolean(deletingId)}
              variant="destructive"
              onClick={() => deleteTarget && deleteVideo(deleteTarget)}
            >
              <Trash2 />
              {deletingId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyVideoState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm sm:col-span-2 xl:col-span-3">
      <div className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <Film className="size-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold">No avatar videos yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Create your first talking AI avatar video with a saved avatar, voice, script, ratio, and duration.
      </p>
      <Button className="mt-5" nativeButton={false} render={<Link href="/dashboard/ai-video-avatar/create" />}>
        <Plus />
        Generate New Avatar Video
      </Button>
    </div>
  )
}

function VideoSkeletons() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="mt-4 h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
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
