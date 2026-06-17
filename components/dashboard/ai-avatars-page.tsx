"use client"

import { Check, Download, ImagePlus, RefreshCcw, Upload, UserRound, Wand2, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  DashboardError,
  DashboardPage,
  DashboardPageHeader,
} from "@/components/dashboard/dashboard-layout"
import { AvatarAssetCard } from "@/components/dashboard/library-asset-cards"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { showAppToast } from "@/components/ui/app-toast"
import { getValidAccessToken, refreshSession } from "@/lib/backend"
import type {
  AiAvatar,
  AiAvatarJob,
  AvatarJobResponse,
  AvatarStyle,
  GeneratedAvatarPreview as GeneratedAvatarPreviewResult,
} from "@/lib/avatar-types"
import { avatarStyles } from "@/lib/avatar-types"
import { cn } from "@/lib/utils"

type LocalGeneratedAvatar = {
  desktopFile: File
  desktopImageUrl: string
  mobileFile: File
  mobileImageUrl: string
}

const activeStatuses = new Set(["queued", "running", "generating", "uploading"])
const generationCooldownMs = 60_000

export function AiAvatarsPage() {
  const [avatars, setAvatars] = useState<AiAvatar[]>([])
  const [activeJob, setActiveJob] = useState<AiAvatarJob | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const [avatarName, setAvatarName] = useState("")
  const [style, setStyle] = useState<AvatarStyle | "">("")
  const [prompt, setPrompt] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [showGenerationStatus, setShowGenerationStatus] = useState(false)
  const [avatarImagesEnabled, setAvatarImagesEnabled] = useState(false)
  const [loadedAvatarImages, setLoadedAvatarImages] = useState<Record<string, boolean>>({})
  const [generatingRequest, setGeneratingRequest] = useState(false)
  const [generatedAvatar, setGeneratedAvatar] = useState<LocalGeneratedAvatar | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingAvatarId, setDeletingAvatarId] = useState("")
  const [error, setError] = useState("")
  const [generationCooldownUntil, setGenerationCooldownUntil] = useState(0)
  const pollRef = useRef<number | null>(null)
  const avatarImageDelayRef = useRef<number | null>(null)
  const previewRef = useRef("")
  const generatedPreviewRefs = useRef<string[]>([])
  const discardedJobIdsRef = useRef<Set<string>>(new Set())
  const previewRetryCountsRef = useRef<Record<string, number>>({})
  const generationRequestRef = useRef(false)
  const confirmedDialogCloseRef = useRef(false)

  const savedAvatars = useMemo(() => avatars.filter((avatar) => avatar.source !== "default"), [avatars])
  const defaultAvatars = useMemo(() => avatars.filter((avatar) => avatar.source === "default"), [avatars])
  const isJobActive = activeJob ? activeStatuses.has(activeJob.status) : false
  const isGenerationCoolingDown = generationCooldownUntil > Date.now()
  const shouldShowDialogStatus = showGenerationStatus || Boolean(activeJob)
  const avatarNameValidationMessage = useMemo(
    () => getAvatarNameValidationMessage(avatarName, avatars, defaultAvatars),
    [avatarName, avatars, defaultAvatars]
  )
  const canSubmitAvatarName = Boolean(avatarName.trim()) && !avatarNameValidationMessage
  const canGenerate =
    canSubmitAvatarName &&
    Boolean(style && (file || prompt.trim())) &&
    !submitting &&
    !isJobActive &&
    !isGenerationCoolingDown
  const canUpload = canSubmitAvatarName && Boolean(style && (file || generatedAvatar)) && !submitting && !isJobActive
  useEffect(() => {
    loadAvatars().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!activeJob || !isJobActive) return

    pollRef.current = window.setInterval(() => {
      pollJob(activeJob.id)
    }, 2500)

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [activeJob, isJobActive])

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      generatedPreviewRefs.current.forEach((url) => URL.revokeObjectURL(url))
      if (avatarImageDelayRef.current) window.clearTimeout(avatarImageDelayRef.current)
    }
  }, [])

  useEffect(() => {
    if (!generationCooldownUntil) return

    const remaining = generationCooldownUntil - Date.now()
    const timeout = window.setTimeout(() => setGenerationCooldownUntil(0), Math.max(remaining, 0))
    return () => window.clearTimeout(timeout)
  }, [generationCooldownUntil])

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

  async function loadAvatars() {
    try {
      const response = await apiFetch("/api/avatars")
      const body = await readJson<{ avatars: AiAvatar[] }>(response)

      if (avatarImageDelayRef.current) {
        window.clearTimeout(avatarImageDelayRef.current)
      }

      setAvatarImagesEnabled(false)
      setLoadedAvatarImages({})
      setAvatars(body.avatars)
      setError("")
      avatarImageDelayRef.current = window.setTimeout(() => setAvatarImagesEnabled(true), 160)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load avatars.")
    }
  }

  async function pollJob(jobId: string) {
    try {
      const response = await apiFetch(`/api/avatars/jobs/${jobId}`)
      const body = await readJson<AvatarJobResponse>(response)
      if (discardedJobIdsRef.current.has(jobId)) return
      setActiveJob(body.job)

      if (body.job.status === "failed" && isGenerationRateLimitMessage(body.job.error)) {
        setGenerationCooldownUntil(Date.now() + generationCooldownMs)
      }

      if (body.avatar) {
        await loadAvatars()
      }

      if (body.generatedPreview) {
        previewRetryCountsRef.current[jobId] = 0
        await setLocalGeneratedAvatar(body.generatedPreview)
      } else if (body.job.status === "completed" && !body.avatar) {
        const retryCount = previewRetryCountsRef.current[jobId] || 0
        if (retryCount < 8) {
          previewRetryCountsRef.current[jobId] = retryCount + 1
          window.setTimeout(() => pollJob(jobId), 1000)
        }
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not refresh avatar status.")
    }
  }

  async function onUseDefault(avatar: AiAvatar) {
    setSubmitting(true)
    setError("")

    try {
      const response = await apiFetch(`/api/avatars/${avatar.id}/select`, {
        method: "POST",
      })
      const body = await readJson<{ avatar: AiAvatar }>(response)
      setAvatars((current) => {
        const next = current.map((item) => item.id === body.avatar.id
          ? body.avatar
          : { ...item, is_selected: false }
        )

        return next.some((item) => item.id === body.avatar.id) ? next : [body.avatar, ...next]
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not select default avatar.")
    } finally {
      setSubmitting(false)
    }
  }

  async function onSelectAvatar(avatarId: string) {
    setSubmitting(true)
    setError("")

    try {
      const response = await apiFetch(`/api/avatars/${avatarId}/select`, { method: "POST" })
      const body = await readJson<{ avatar: AiAvatar }>(response)
      setAvatars((current) =>
        current.map((avatar) => ({
          ...avatar,
          is_selected: avatar.id === body.avatar.id,
        }))
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not select avatar.")
    } finally {
      setSubmitting(false)
    }
  }

  async function onDeleteAvatar(avatarId: string) {
    setDeletingAvatarId(avatarId)
    setError("")

    try {
      const response = await apiFetch(`/api/avatars/${avatarId}`, { method: "DELETE" })
      await readJson<{ avatar: AiAvatar }>(response)
      setAvatars((current) => current.filter((avatar) => avatar.id !== avatarId))
      showAppToast("Avatar deleted.", {
        description: "The avatar was removed from your workspace.",
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete avatar.")
    } finally {
      setDeletingAvatarId("")
    }
  }

  async function onUploadAsIs() {
    if ((!file && !generatedAvatar) || !style) return
    const cleanAvatarName = avatarName.trim()
    const nameError = getAvatarNameValidationMessage(cleanAvatarName, avatars, defaultAvatars)
    if (nameError) {
      setError(nameError)
      return
    }

    setSubmitting(true)
    setError("")

    try {
      const form = new FormData()
      if (generatedAvatar) {
        form.append("desktopFile", generatedAvatar.desktopFile)
        form.append("mobileFile", generatedAvatar.mobileFile)
        form.append("source", "ai")
      } else if (file) {
        form.append("file", file)
      }
      form.append("style", style)
      form.append("name", cleanAvatarName)

      const response = await apiFetch("/api/avatars/upload", {
        method: "POST",
        body: form,
      })
      const body = await readJson<{ avatar: AiAvatar }>(response)
      setAvatars((current) => [
        body.avatar,
        ...current
          .filter((item) => item.id !== body.avatar.id)
          .map((item) => ({
            ...item,
            is_selected: false,
          })),
      ])
      resetDialogInputs()
      setShowGenerationStatus(false)
      setActiveJob(null)
      closeDialogWithoutConfirmation()
      showAppToast("Avatar uploaded successfully.", {
        description: "The new avatar is now selected in your workspace.",
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not upload avatar.")
    } finally {
      setSubmitting(false)
    }
  }

  async function onGenerate() {
    if (generationRequestRef.current || !style || (!file && !prompt.trim()) || isGenerationCoolingDown) return
    const cleanAvatarName = avatarName.trim()
    const nameError = getAvatarNameValidationMessage(cleanAvatarName, avatars, defaultAvatars)
    if (nameError) {
      setError(nameError)
      return
    }

    generationRequestRef.current = true
    setSubmitting(true)
    setGeneratingRequest(true)
    setShowGenerationStatus(true)
    clearGeneratedPreview()
    setError("")

    try {
      const form = new FormData()
      if (file) form.append("file", file)
      form.append("name", cleanAvatarName)
      form.append("style", style)
      form.append("prompt", prompt)

      const response = await apiFetch("/api/avatars/generate", {
        method: "POST",
        body: form,
      })
      const body = await readJson<{ job: AiAvatarJob }>(response)
      discardedJobIdsRef.current.delete(body.job.id)
      previewRetryCountsRef.current[body.job.id] = 0
      setActiveJob(body.job)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not start avatar generation.")
    } finally {
      generationRequestRef.current = false
      setGeneratingRequest(false)
      setSubmitting(false)
    }
  }

  async function onRegenerate() {
    if (isJobActive || isGenerationCoolingDown || generationRequestRef.current) return

    if (file || prompt.trim()) {
      await onGenerate()
      return
    }

    if (!activeJob) return

    generationRequestRef.current = true
    setSubmitting(true)
    setShowGenerationStatus(true)
    clearGeneratedPreview()
    setError("")

    try {
      const response = await apiFetch(`/api/avatars/jobs/${activeJob.id}/regenerate`, { method: "POST" })
      const body = await readJson<{ job: AiAvatarJob }>(response)
      discardedJobIdsRef.current.delete(body.job.id)
      previewRetryCountsRef.current[body.job.id] = 0
      setActiveJob(body.job)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not regenerate avatar.")
    } finally {
      generationRequestRef.current = false
      setSubmitting(false)
    }
  }

  function resetDialogInputs() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = ""
    }
    clearGeneratedPreview()
    setFile(null)
    setAvatarName("")
    setPreviewUrl("")
    setPrompt("")
    setStyle("")
  }

  function onDialogOpenChange(
    open: boolean,
    eventDetails?: {
      cancel?: () => void
      preventUnmountOnClose?: () => void
      reason?: string
    }
  ) {
    if (open) {
      confirmedDialogCloseRef.current = false
      resetDialogInputs()
      setShowGenerationStatus(false)

      if (!isJobActive) {
        setActiveJob(null)
        setGeneratedAvatar(null)
      }
    }

    if (!open) {
      if (confirmedDialogCloseRef.current) {
        confirmedDialogCloseRef.current = false
        setDialogOpen(false)
        return
      }

      eventDetails?.cancel?.()
      if (eventDetails?.reason !== "close-press") return

      eventDetails?.preventUnmountOnClose?.()
      requestDialogClose()
      return
    }

    setDialogOpen(open)
  }

  function requestDialogClose() {
    setConfirmCloseOpen(true)
  }

  function closeDialogWithoutConfirmation() {
    confirmedDialogCloseRef.current = true
    setDialogOpen(false)
  }

  function closeDialogAndDiscard() {
    setConfirmCloseOpen(false)
    if (activeJob) {
      discardedJobIdsRef.current.add(activeJob.id)
    }
    resetDialogInputs()
    setShowGenerationStatus(false)
    setActiveJob(null)
    closeDialogWithoutConfirmation()
  }

  async function onSaveGeneratedAvatar() {
    const avatar = generatedAvatar
    if (!avatar) return

    const desktopImageUrl = avatar.desktopImageUrl
    const mobileImageUrl = avatar.mobileImageUrl
    if (!desktopImageUrl || !mobileImageUrl) return

    const timestamp = getAvatarDownloadTimestamp()
    triggerDownload(desktopImageUrl, getGeneratedAvatarDownloadName(timestamp, "desktop"))
    triggerDownload(mobileImageUrl, getGeneratedAvatarDownloadName(timestamp, "mobile"))
  }

  async function setLocalGeneratedAvatar(preview: GeneratedAvatarPreviewResult) {
    clearGeneratedPreview()

    const [desktop, mobile] = await Promise.all([
      generatedPreviewImageToFile(preview.desktop.dataUrl, preview.desktop.filename, preview.desktop.mimeType),
      generatedPreviewImageToFile(preview.mobile.dataUrl, preview.mobile.filename, preview.mobile.mimeType),
    ])
    const desktopImageUrl = URL.createObjectURL(desktop)
    const mobileImageUrl = URL.createObjectURL(mobile)
    generatedPreviewRefs.current = [desktopImageUrl, mobileImageUrl]

    setGeneratedAvatar({
      desktopFile: desktop,
      desktopImageUrl,
      mobileFile: mobile,
      mobileImageUrl,
    })
  }

  function clearGeneratedPreview() {
    generatedPreviewRefs.current.forEach((url) => URL.revokeObjectURL(url))
    generatedPreviewRefs.current = []
    setGeneratedAvatar(null)
  }

  function onChooseFile(nextFile: File | null) {
    clearGeneratedPreview()

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = ""
    }

    setFile(nextFile)
    if (!nextFile) {
      setPreviewUrl("")
      return
    }

    const url = URL.createObjectURL(nextFile)
    previewRef.current = url
    setPreviewUrl(url)
  }

  function onAvatarImageLoad(imageKey: string) {
    setLoadedAvatarImages((current) => ({
      ...current,
      [imageKey]: true,
    }))
  }

  return (
    <DashboardPage>
      <section className={cn("grid gap-4", activeJob && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
        <div className="grid gap-5">
          <DashboardPageHeader
            icon={UserRound}
            eyebrow="AI Avatars"
            title="Podcast Avatar"
            description="Build a reusable identity for videos, podcasts, chat profiles, and generated media."
            actions={
              <>
                <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange} disablePointerDismissal>
                  <DialogTrigger render={<Button />}>
                    <ImagePlus />
                    Create New Avatar
                  </DialogTrigger>
                  <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl" showCloseButton={false}>
                    <Button
                      aria-label="Close"
                      className="absolute right-4 top-4"
                      disabled={submitting}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                      onClick={requestDialogClose}
                    >
                      <X />
                    </Button>
                    <DialogHeader>
                      <DialogTitle>Create New Avatar</DialogTitle>
                      <DialogDescription>
                        Upload a reference image, choose a style, and either generate with AI or keep the image as-is.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.8fr)]">
                      <div className="grid content-start gap-5">
                        <div className="grid gap-2">
                          <Label htmlFor="avatar-name">Avatar name</Label>
                          <Input
                            id="avatar-name"
                            aria-invalid={Boolean(avatarNameValidationMessage)}
                            disabled={submitting || isJobActive}
                            placeholder="e.g. Podcast Avatar"
                            value={avatarName}
                            onChange={(event) => setAvatarName(event.target.value)}
                          />
                          {avatarNameValidationMessage ? (
                            <p className="text-xs text-destructive">{avatarNameValidationMessage}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Names must be unique across saved and default avatars.
                            </p>
                          )}
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="avatar-image">Avatar image</Label>
                          <label
                            className={cn(
                              "grid min-h-56 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 text-center transition hover:bg-muted/50",
                              (submitting || isJobActive) && "pointer-events-none opacity-50"
                            )}
                            htmlFor="avatar-image"
                          >
                            <Input
                              id="avatar-image"
                              accept="image/*"
                              className="sr-only"
                              disabled={submitting || isJobActive}
                              type="file"
                              onChange={(event) => onChooseFile(event.target.files?.[0] || null)}
                            />
                            {previewUrl ? (
                              <div className="relative size-full min-h-56">
                                <img
                                  alt="Avatar image"
                                  className="absolute inset-0 size-full object-cover"
                                  src={previewUrl}
                                />
                              </div>
                            ) : (
                              <div className="grid gap-2 justify-items-center p-5">
                                <Upload className="size-7 text-muted-foreground" />
                                <span className="text-sm font-medium">Choose image</span>
                                <span className="text-xs text-muted-foreground">PNG, JPG, or WebP reference image</span>
                              </div>
                            )}
                          </label>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="avatar-style">Avatar style</Label>
                          <NativeSelect
                            id="avatar-style"
                            className="w-full"
                            disabled={submitting || isJobActive}
                            value={style}
                            onChange={(event) => setStyle(event.target.value as AvatarStyle | "")}
                          >
                            <NativeSelectOption disabled value="">
                              Choose a style
                            </NativeSelectOption>
                            {avatarStyles.map((item) => (
                              <NativeSelectOption key={item} value={item}>
                                {item}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="avatar-prompt">Customization prompt</Label>
                          <Textarea
                            id="avatar-prompt"
                            className="min-h-32 resize-none"
                            disabled={submitting || isJobActive}
                            placeholder="Optional: outfit, mood, background, lighting..."
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                          />
                        </div>
                      </div>

                      <DialogGenerationStatus
                        activeJob={activeJob}
                        generatedAvatar={generatedAvatar}
                        isJobActive={isJobActive}
                        loading={generatingRequest || isJobActive}
                        show={shouldShowDialogStatus}
                        submitting={submitting}
                        generationCoolingDown={isGenerationCoolingDown}
                        onRegenerate={onRegenerate}
                        onSave={onSaveGeneratedAvatar}
                      />
                    </div>

                    <DialogFooter className="sm:justify-between">
                      <Button variant="outline" onClick={requestDialogClose}>
                        Close
                      </Button>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="outline" disabled={!canUpload} onClick={onUploadAsIs}>
                          {submitting ? <Spinner /> : <Upload />}
                          Upload as it is
                        </Button>
                        <Button disabled={!canGenerate} onClick={onGenerate}>
                          {submitting ? <Spinner /> : <Wand2 />}
                          Generate with AI
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Close this form?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3 text-left">
                        <span className="block">Are you sure you want to close the avatar form?</span>
                        <span className="block font-medium text-destructive">
                          娉細绯荤粺鍙兘浼氫涪澶卞凡缁忓～鍐欑殑琛ㄥ崟淇℃伅
                        </span>
                        <span className="block">Saved or uploaded work remains available in the library.</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep editing</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={closeDialogAndDiscard}>
                        Close form
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            }
          />
        </div>

        {activeJob ? (
          <StatusPanel
            activeJob={activeJob}
            generatedAvatar={generatedAvatar}
            generationCoolingDown={isGenerationCoolingDown}
            isJobActive={isJobActive}
            loading={loading}
            onRegenerate={onRegenerate}
            onSave={onSaveGeneratedAvatar}
            submitting={submitting}
          />
        ) : null}
      </section>

      {error ? (
        <DashboardError>{error}</DashboardError>
      ) : null}

      {isGenerationCoolingDown ? (
        <div className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground">
          Image maker is returning 429 TooManyRequests. Please wait about one minute before generating again.
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Your avatars</h3>
            <p className="text-sm text-muted-foreground">Generated and uploaded avatars saved to your workspace.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? <AvatarMetadataPendingCard /> : null}

          {!loading && savedAvatars.map((avatar, index) => (
            <AvatarAssetCard
              key={avatar.id}
              actionLabel={avatar.is_selected ? "Selected" : "Use avatar"}
              avatar={{
                desktopImageUrl: getAvatarDesktopImageUrl(avatar),
                mobileImageUrl: getAvatarMobileImageUrl(avatar),
                name: avatar.name,
                source: avatar.source,
                style: avatar.style,
              }}
              disabled={submitting || avatar.is_selected || !avatarImagesEnabled}
              deleting={deletingAvatarId === avatar.id}
              desktopImageLoaded={Boolean(loadedAvatarImages[`${avatar.id}:desktop`])}
              imageLoadingEnabled={avatarImagesEnabled}
              mobileImageLoaded={Boolean(loadedAvatarImages[`${avatar.id}:mobile`])}
              metadataOnly={!avatarImagesEnabled}
              placeholderTone={index % 4}
              selected={avatar.is_selected}
              onDesktopImageLoad={() => onAvatarImageLoad(`${avatar.id}:desktop`)}
              onDelete={() => onDeleteAvatar(avatar.id)}
              onMobileImageLoad={() => onAvatarImageLoad(`${avatar.id}:mobile`)}
              onAction={() => onSelectAvatar(avatar.id)}
            />
          ))}

          {!savedAvatars.length && !loading ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              No saved avatars yet. Pick a default or create a new one.
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Default avatars</h3>
          <p className="text-sm text-muted-foreground">Start fast with a ready-made avatar style.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {defaultAvatars.map((avatar) => (
            <AvatarAssetCard
              key={avatar.id}
              actionLabel="Use avatar"
              avatar={{
                desktopImageUrl: getAvatarDesktopImageUrl(avatar),
                mobileImageUrl: getAvatarMobileImageUrl(avatar),
                name: avatar.name,
                source: "default",
                style: avatar.style,
              }}
              disabled={submitting}
              selected={avatar.is_selected}
              onAction={() => onUseDefault(avatar)}
            />
          ))}
        </div>
      </section>
    </DashboardPage>
  )
}

function StatusPanel({
  activeJob,
  generatedAvatar,
  generationCoolingDown,
  isJobActive,
  loading,
  onRegenerate,
  onSave,
  submitting,
}: {
  activeJob: AiAvatarJob | null
  generatedAvatar: LocalGeneratedAvatar | null
  generationCoolingDown: boolean
  isJobActive: boolean
  loading: boolean
  onRegenerate: () => void
  onSave: () => void
  submitting: boolean
}) {
  if (loading) {
    return (
      <div className="grid min-h-48 place-items-center rounded-xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading avatars
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          {isJobActive ? <Spinner /> : <UserRound className="size-5" />}
        </div>
        <div>
          <p className="text-sm font-medium">Generation status</p>
          <p className="mt-1 text-xs text-muted-foreground">{activeJob?.status || "Ready"}</p>
        </div>
      </div>

      <Progress className="mt-5" value={activeJob?.progress || 0}>
        <ProgressLabel>{activeJob?.message || "No active generation job."}</ProgressLabel>
        <ProgressValue />
      </Progress>

      {activeJob?.error ? (
        <p className="mt-3 text-sm leading-6 text-destructive">{activeJob.error}</p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Long-running AI work runs in Trigger.dev, so the page can keep showing progress while the job finishes.
        </p>
      )}

      <div className="mt-5 grid gap-2">
        <Button className="w-full" disabled={!generatedAvatar} variant="outline" onClick={onSave}>
          <Download />
          Save locally
        </Button>
        <Button
          className="w-full"
          disabled={!activeJob || isJobActive || submitting || generationCoolingDown}
          variant="outline"
          onClick={onRegenerate}
        >
          {submitting ? <Spinner /> : <RefreshCcw />}
          Regenerate
        </Button>
      </div>
    </div>
  )
}

function DialogGenerationStatus({
  activeJob,
  generatedAvatar,
  generationCoolingDown,
  isJobActive,
  loading,
  onRegenerate,
  onSave,
  show,
  submitting,
}: {
  activeJob: AiAvatarJob | null
  generatedAvatar: LocalGeneratedAvatar | null
  generationCoolingDown: boolean
  isJobActive: boolean
  loading: boolean
  onRegenerate: () => void
  onSave: () => void
  show: boolean
  submitting: boolean
}) {
  const progress = activeJob?.progress || (loading ? 8 : 0)
  const message =
    activeJob?.message || (loading ? "Starting avatar generation." : "Avatar generation progress will appear here.")
  const desktopImageUrl = generatedAvatar?.desktopImageUrl || ""
  const mobileImageUrl = generatedAvatar?.mobileImageUrl || ""
  const isGenerationComplete = Boolean(desktopImageUrl && mobileImageUrl && activeJob?.status === "completed" && !isJobActive)

  return (
    <aside
      aria-hidden={!show}
      className={cn(
        "flex min-h-[360px] flex-col rounded-xl border border-border/70 bg-muted/20 p-4 transition-opacity",
        !show && "pointer-events-none opacity-0"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{isGenerationComplete ? "Generated avatars" : "Generation status"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isGenerationComplete ? "Ready to upload" : activeJob?.status || (loading ? "Starting" : "Ready")}
          </p>
        </div>
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full border transition-colors duration-300",
            isGenerationComplete
              ? "border-accent/35 bg-accent/16 text-foreground"
              : "border-border bg-background text-muted-foreground"
          )}
        >
          {isGenerationComplete ? <Check className="size-4" /> : loading ? <Spinner /> : <UserRound className="size-4" />}
        </div>
      </div>

      {isGenerationComplete && generatedAvatar ? (
        <div className="mt-5 grid animate-in fade-in slide-in-from-right-2 duration-300 gap-4">
          <div className="grid grid-cols-2 items-start gap-3">
            <GeneratedAvatarPreview aspect="aspect-video" imageUrl={desktopImageUrl} label="16:9 ratio" />
            <GeneratedAvatarPreview aspect="aspect-[9/16]" imageUrl={mobileImageUrl} label="9:16 ratio" />
          </div>
        </div>
      ) : (
        <div className="mt-5 grid animate-in fade-in duration-300 gap-3">
          <p className="min-h-5 text-sm text-muted-foreground">{message}</p>
          <Progress value={progress}>
            <ProgressLabel className="sr-only">Avatar generation progress</ProgressLabel>
            <ProgressValue />
          </Progress>
        </div>
      )}

      {activeJob?.error ? <p className="mt-4 text-sm leading-6 text-destructive">{activeJob.error}</p> : null}

      <div className="mt-auto grid gap-2 pt-5">
        <Button disabled={!generatedAvatar} variant="outline" onClick={onSave}>
          <Download />
          Save locally
        </Button>
        <Button disabled={!activeJob || isJobActive || submitting || generationCoolingDown} variant="outline" onClick={onRegenerate}>
          {submitting ? <Spinner /> : <RefreshCcw />}
          Regenerate
        </Button>
      </div>
    </aside>
  )
}

function GeneratedAvatarPreview({
  aspect,
  imageUrl,
  label,
}: {
  aspect: string
  imageUrl: string
  label: string
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-border/70 bg-card/70 p-2 shadow-sm">
      <div className={cn("overflow-hidden rounded-lg bg-muted", aspect)}>
        <img alt={label} className="size-full object-cover" src={imageUrl} />
      </div>
      <p className="px-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

async function generatedPreviewImageToFile(dataUrl: string, filename: string, mimeType: string) {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], filename, { type: mimeType || blob.type || "image/png" })
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noreferrer"
  document.body.append(link)
  link.click()
  link.remove()
}

function getGeneratedAvatarDownloadName(timestamp: string, variant: "desktop" | "mobile") {
  return `Neko25-${timestamp}-${variant}.png`
}

function getAvatarDownloadTimestamp() {
  const date = new Date()
  const pad = (value: number) => value.toString().padStart(2, "0")
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("")
}

function isGenerationRateLimitMessage(message = "") {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("429") ||
    normalized.includes("toomanyrequests") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate-limiting") ||
    normalized.includes("rate limit")
  )
}

function getAvatarNameValidationMessage(
  name: string,
  avatars: AiAvatar[],
  defaults: AiAvatar[]
) {
  const normalizedName = normalizeAvatarName(name)
  if (!normalizedName) return "Avatar name is required."

  const savedNames = avatars.map((avatar) => avatar.name)
  const defaultNames = defaults.map((avatar) => avatar.name)
  const hasConflict = [...savedNames, ...defaultNames].some(
    (existingName) => normalizeAvatarName(existingName) === normalizedName
  )

  return hasConflict ? "Avatar name already exists in saved or default avatars." : ""
}

function getAvatarDesktopImageUrl(avatar: AiAvatar) {
  return avatar.desktop_image_url || avatar.image_url
}

function getAvatarMobileImageUrl(avatar: AiAvatar) {
  return avatar.mobile_image_url || avatar.image_url
}

function normalizeAvatarName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

function AvatarMetadataPendingCard() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 shadow-sm">
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
    </div>
  )
}

