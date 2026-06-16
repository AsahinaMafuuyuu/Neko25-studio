"use client"

import { useState, type CSSProperties } from "react"
import { AbsoluteFill, Audio, Sequence, Video, interpolate, useCurrentFrame } from "remotion"

import type { AiVideoAgentComposition } from "@/lib/ai-video-agent"

export function AiVideoAgentRemotion({ composition }: { composition: AiVideoAgentComposition }) {
  const frame = useCurrentFrame()
  const scenes = composition.scenes || []
  const fps = composition.fps || 30
  const width = composition.width || 1920
  const height = composition.height || 1080
  const fallbackBackground = composition.aspectRatio === "9:16" ? "#101828" : "#111827"
  const captions = Array.isArray(composition.captions) ? composition.captions : []
  const allDialogueAssets = scenes.flatMap((scene) => {
    const assets = Array.isArray(scene.assets) ? scene.assets as Array<Record<string, unknown>> : []
    return assets.filter((asset) => String(asset.asset_type || asset.assetType || "") === "dialogue_audio")
  })

  return (
    <AbsoluteFill style={{ backgroundColor: fallbackBackground, color: "white", fontFamily: "Inter, sans-serif" }}>
      {composition.audioUrl ? <Audio src={composition.audioUrl} /> : null}
      {allDialogueAssets.map((asset, index) => {
        const metadata = typeof asset.metadata === "object" && asset.metadata ? asset.metadata as Record<string, unknown> : {}
        const start = Number(metadata.startSeconds || 0)
        const url = typeof asset.url === "string" ? asset.url : ""
        if (!url) return null
        return (
          <Sequence key={`dialogue-audio-${index}`} from={Math.round(start * fps)}>
            <Audio src={url} />
          </Sequence>
        )
      })}
      {scenes.map((scene, index) => {
        const start = Number(scene.startSeconds || 0)
        const end = Number(scene.endSeconds || start + 5)
        const duration = Math.max(1, Math.round((end - start) * fps))
        const assets = Array.isArray(scene.assets) ? scene.assets as Array<Record<string, unknown>> : []
        const avatarMedia = assets.find((asset) => String(asset.asset_type || asset.assetType || "") === "avatar_scene_video")
          || assets.find((asset) => String(asset.asset_type || asset.assetType || "") === "avatar_clip")
        const sceneMedia = assets.find((asset) => String(asset.asset_type || asset.assetType || "") === "scene_image")
          || assets.find((asset) => String(asset.asset_type || asset.assetType || "").includes("b_roll"))
        const avatarUrl = typeof avatarMedia?.url === "string" ? avatarMedia.url : ""
        const sceneUrl = typeof sceneMedia?.url === "string" ? sceneMedia.url : ""
        const transition = (composition.transitions || []).find((item) => item.sceneId === scene.id || item.sceneIndex === index)
        const captionEffects = composition.captionEffects && typeof composition.captionEffects === "object" ? composition.captionEffects as Record<string, string> : {}

        return (
          <Sequence key={String(scene.id || index)} from={Math.round(start * fps)} durationInFrames={duration}>
            <SceneFrame
              avatarUrl={avatarUrl}
              captions={captions}
              captionStyle={composition.captionStyle || "clean_lower"}
              captionEffect={captionEffects[String(scene.id || "")] || composition.captionEffect || "system_bold"}
              durationFrames={duration}
              frame={Math.max(0, frame - Math.round(start * fps))}
              height={height}
              scene={scene}
              sceneUrl={sceneUrl}
              transition={transition}
              width={width}
            />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

function SceneFrame({
  avatarUrl,
  captions,
  captionEffect,
  captionStyle,
  durationFrames,
  frame,
  height,
  scene,
  sceneUrl,
  transition,
  width,
}: {
  avatarUrl: string
  captions: NonNullable<AiVideoAgentComposition["captions"]>
  captionEffect: string
  captionStyle: string
  durationFrames: number
  frame: number
  height: number
  scene: Record<string, unknown>
  sceneUrl: string
  transition?: Record<string, unknown>
  width: number
}) {
  const transitionStyle = getTransitionStyle(frame, durationFrames, transition)
  const currentSecond = Number(scene.startSeconds || 0) + frame / 30
  const activeCaption = captions.find((caption) => {
    const start = Number(caption.start)
    const end = Number(caption.end)
    return end > start && currentSecond >= start && currentSecond <= end
  })
  const caption = activeCaption?.text || ""

  return (
    <AbsoluteFill style={transitionStyle}>
      <MediaLayer fallbackGradient="linear-gradient(135deg,#111827,#334155)" url={avatarUrl || sceneUrl} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.02) 46%,rgba(0,0,0,.58))" }} />
      {activeCaption && caption ? (
        <CaptionOverlay
          caption={caption}
          captionEffect={captionEffect}
          captionStyle={captionStyle}
          currentSecond={currentSecond}
          cueEnd={Number(activeCaption.end)}
          cueStart={Number(activeCaption.start)}
          landscape={width > height}
        />
      ) : null}
    </AbsoluteFill>
  )
}

function MediaLayer({
  contain,
  dimmed,
  fallbackGradient,
  url,
}: {
  contain?: boolean
  dimmed?: boolean
  fallbackGradient?: string
  url: string
}) {
  const [failedUrl, setFailedUrl] = useState("")
  const failed = failedUrl === url
  const mediaStyle: CSSProperties = {
    filter: dimmed ? "saturate(.86) blur(1px)" : undefined,
    height: "100%",
    objectFit: contain ? "contain" : "cover",
    opacity: dimmed ? 0.72 : 1,
    width: "100%",
  }
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url)

  if (!url || failed) {
    return <AbsoluteFill style={{ background: fallbackGradient || "linear-gradient(135deg,var(--foreground),var(--primary),var(--accent))" }} />
  }

  if (isVideo) {
    return <Video src={url} style={mediaStyle} onError={() => setFailedUrl(url)} />
  }

  return <img alt="" src={url} style={mediaStyle} onError={() => setFailedUrl(url)} />
}

function CaptionOverlay({
  caption,
  captionEffect,
  captionStyle,
  cueEnd,
  cueStart,
  currentSecond,
  landscape,
}: {
  caption: string
  captionEffect: string
  captionStyle: string
  cueEnd: number
  cueStart: number
  currentSecond: number
  landscape: boolean
}) {
  const duration = Math.max(0, cueEnd - cueStart)
  const fadeSeconds = Math.min(0.28, duration / 4)
  const canFade = duration > 0.04 && fadeSeconds > 0.001
  const opacity = canFade
    ? interpolate(currentSecond, [cueStart, cueStart + fadeSeconds, cueEnd - fadeSeconds, cueEnd], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
    : 1
  const translateY = canFade
    ? interpolate(currentSecond, [cueStart, cueStart + fadeSeconds], [18, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
    : 0

  return (
    <div
      style={{
        alignItems: "center",
        bottom: landscape ? 132 : 176,
        display: "flex",
        justifyContent: "center",
        left: landscape ? 96 : 64,
        opacity,
        position: "absolute",
        right: landscape ? 96 : 64,
        textAlign: "center",
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div style={getCaptionStyle(captionStyle, captionEffect, landscape)}>
        {caption.slice(0, 220)}
      </div>
    </div>
  )
}

function getCaptionStyle(style: string, effect: string, landscape: boolean): CSSProperties {
  const base: CSSProperties = {
    display: "inline-block",
    fontFamily: getCaptionFontFamily(effect),
    fontSize: landscape ? 86 : 74,
    fontWeight: 900,
    letterSpacing: 0,
    lineHeight: 1.12,
    maxWidth: "86%",
    padding: landscape ? "16px 26px" : "14px 22px",
    position: "relative",
    textAlign: "center",
  }

  if (style === "cinematic_gold") {
    return {
      ...base,
      color: "#f8d66d",
      fontFamily: getCaptionFontFamily(effect, "Georgia, Times New Roman, serif"),
      textShadow: "0 4px 20px rgba(0,0,0,.86), 0 0 14px rgba(248,214,109,.32)",
    }
  }
  if (style === "neon_pop") {
    return {
      ...base,
      background: "rgba(8,8,20,.76)",
      border: landscape ? "5px solid #67e8f9" : "4px solid #67e8f9",
      borderRadius: 999,
      color: "#f5d0fe",
      padding: landscape ? "16px 32px" : "14px 28px",
      textShadow: "0 0 16px rgba(217,70,239,.9), 0 4px 18px rgba(0,0,0,.9)",
    }
  }
  if (style === "editorial_stack") {
    return {
      ...base,
      background: "rgba(255,255,255,.94)",
      borderRadius: 999,
      color: "#111827",
      fontSize: landscape ? 66 : 56,
      letterSpacing: 0,
      textTransform: "uppercase",
    }
  }
  if (style === "minimal_box") {
    return {
      ...base,
      background: "rgba(0,0,0,.72)",
      borderRadius: 18,
      color: "#fff",
      fontSize: landscape ? 68 : 58,
      padding: landscape ? "16px 28px" : "14px 24px",
    }
  }
  if (style === "karaoke_wave") {
    return {
      ...base,
      color: "#7dd3fc",
      fontStyle: "italic",
      textShadow: "0 0 18px rgba(45,212,191,.76), 0 5px 20px rgba(0,0,0,.92)",
    }
  }
  return {
    ...base,
    color: "#fff",
    textShadow: "0 4px 18px rgba(0,0,0,.88), 0 1px 2px rgba(0,0,0,.95)",
  }
}

function getCaptionFontFamily(effect: string, fallback = "Inter, Arial, Helvetica, sans-serif") {
  if (effect === "rounded_sans") return '"Arial Rounded MT Bold", "Trebuchet MS", Inter, sans-serif'
  if (effect === "serif_song") return 'SimSun, "Songti SC", Georgia, serif'
  if (effect === "gothic_hei") return 'SimHei, "Microsoft YaHei", Impact, sans-serif'
  if (effect === "mono_tech") return '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
  if (effect === "handwritten_play") return '"Comic Sans MS", "Segoe Print", cursive'
  return fallback
}

function getTransitionStyle(frame: number, durationFrames: number, transition?: Record<string, unknown>): CSSProperties {
  const effect = typeof transition?.effect === "string" ? transition.effect : "none"
  const fadeInFrames = Math.max(0, Math.round(Number(transition?.fadeInSeconds || 0) * 30))
  const fadeOutFrames = Math.max(0, Math.round(Number(transition?.fadeOutSeconds || 0) * 30))
  const fadeInOpacity = fadeInFrames ? interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateRight: "clamp" }) : 1
  const fadeOutOpacity = fadeOutFrames ? interpolate(frame, [Math.max(0, durationFrames - fadeOutFrames), durationFrames], [1, 0], { extrapolateLeft: "clamp" }) : 1
  const opacity = Math.min(fadeInOpacity, fadeOutOpacity)
  const style: CSSProperties = { opacity }

  if (effect === "slide") {
    style.transform = `translateX(${interpolate(frame, [0, Math.max(1, fadeInFrames)], [10, 0], { extrapolateRight: "clamp" })}%)`
  }
  if (effect === "wipe") {
    style.clipPath = `inset(0 ${interpolate(frame, [0, Math.max(1, fadeInFrames)], [100, 0], { extrapolateRight: "clamp" })}% 0 0)`
  }
  if (effect === "fade_to_black") {
    style.backgroundColor = "black"
  }

  return style
}
