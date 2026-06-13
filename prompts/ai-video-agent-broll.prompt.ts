import type { AiVideoAgentScene } from "@/lib/ai-video-agent"

export const aiVideoAgentVisualStylePromptPlaceholders = {
  "2d_cel": "2D anime style, cel shading, flat colors, clear closed lineart, crisp outlines, hard edge shadows, high contrast lighting, vibrant and clean palette, anime MV aesthetic, masterpiece, high key. Subtle chromatic aberration, cinematic lens flare, Tyndall effect, floating dust particles in the air, screen space reflections, dramatic atmosphere.",
  "3d_blindbox_clay": "3D blind box toy style, chibi, Pop Mart style, matte clay material, smooth vinyl texture, subsurface scattering. Macro photography, tilt-shift lens, depth of field. Soft studio lighting, softbox illumination, pastel colors. Clean solid background, Octane render, highly detailed, 8k, masterpiece.",
  cyberpunk: "Cyberpunk/Sci-Fi style, futuristic city night view, massive holographic projections, intricate pipes and cables. Cyborg, glowing neon lights (cyan and magenta), high contrast, dark-toned background. Wet asphalt reflections, metal and glass textures. Cinematic lighting, rim light, volumetric fog, anamorphic lens flare. Unreal Engine 5 render, ray tracing, Octane render, highly detailed, Cyberpunk 2077 aesthetic, 8k resolution, masterpiece.",
  realistic_cinematic: "Cinematic realism, cinematic photography, close-up portrait. Stoic facial expression, hyper-realistic skin texture, visible pores, subsurface scattering. Rembrandt lighting, strong chiaroscuro, rim light. 85mm prime lens, f/1.4 large aperture, shallow depth of field, beautiful bokeh. Cool color palette, desaturated, Kodak film stock, subtle film grain. Unreal Engine 5, ray tracing, highly detailed, 8k resolution, masterpiece.",
} as const

export const aiVideoAgentPresentationFormatPromptPlaceholders = {
  podcast: "A professional talking head podcast setup, medium shot framing of a [形容词：如 futuristic / elegant / professional] digital avatar facing the camera directly, centered composition. Clean and minimalist dark studio background with subtle neon rim lighting. Lower third of the image is left intentionally blank for text and audio visualizer. High contrast, sharp focus, 8k resolution, cinematic lighting, hyper-detailed, clean aesthetic. --ar 9:16 --v 6.0",
  commentary: "Fast zoom-in whip pan with dynamic tracking shots and screen shake for commentary impact. Epic striking combat with dodging and ultimate skill casting. Dynamic particle effects, volumetric sparks, shockwaves, and motion blur on all impacts. Cinematic UE5 rendering with high contrast, dramatic lighting, cel-shaded style, saturated colors, 8K quality.",
  visual_novel: "Classic visual novel/ADV game screen composition featuring a mid-shot/half-body character artwork centered and facing the camera head-on. A subtle depth-of-field bokeh blur accentuates the main character. The lower third of the image is intentionally left empty or darkened, with a clean composition specifically designed to accommodate AVG dialogue boxes and typewriter-style subtitle visualization. Sharp, well-defined edges, flat cel-shaded lighting, high contrast, 8K resolution, intricate facial features, and a pure visual aesthetic.",
  realistic: "A highly photorealistic, cinematic medium shot of a quiet slice-of-life interior. A pale person with long hair is deeply focused, composing music and typing on a keyboard at a cluttered, cozy wooden desk in a dimly lit room. The desk is filled with realistic details: a MIDI keyboard, scattered handwritten notes, a half-empty coffee mug, and tangled cables. Cinematic ambient lighting, soft glowing light from the dual monitors reflecting on the character's face, cool blue shadows contrasting with warm desk lamp illumination. Shot on 35mm lens, 8k resolution, ultra-detailed textures, moody and introverted atmosphere. --no watermarks, text, floating UI elements, generic AI icons, perfect pristine clean surfaces --ar 16:9 --style raw --v 6.0",
} as const

export function buildAiVideoAgentBRollPrompt(input: {
  presentationFormat: string
  scene: AiVideoAgentScene
  visualStyle: string
}) {
  const visualPrompt = input.scene.prompt || input.scene.b_roll_request || input.scene.summary || input.scene.title
  return [
    "Create a dynamic AI video B-roll shot for a professional edited video.",
    "This must be supporting visual coverage, not an avatar, presenter, talking head, interview, or product UI screen recording.",
    "Use natural cinematic camera movement, realistic motion, coherent scene continuity, and clean composition.",
    "No subtitles, no captions, no text overlays, no watermarks, no logos, no UI panels.",
    `Visual style: ${input.visualStyle}`,
    `Presentation format: ${input.presentationFormat}`,
    `Scene intent: ${input.scene.summary || input.scene.title}`,
    `Visual direction: ${visualPrompt}`,
  ].join("\n")
}
