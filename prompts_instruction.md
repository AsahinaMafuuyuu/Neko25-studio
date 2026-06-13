# Prompts Instruction

This project stores reusable AI prompts in the root `prompts/` folder. Prompt files use the `[business-domain].[type].ts` naming style and export pure builder functions so runtime context can be injected safely.

## AI Video Agent

- `prompts/ai-video-agent-script.prompt.ts`
  - Builds topic-to-voiceover prompts for AI Video Agent.
  - Also exports the talking-avatar script prompt used by the related avatar script endpoint.
  - Inputs include topic, duration guidance, target length, tone, and optional presentation format.

- `prompts/ai-video-agent-timeline.prompt.ts`
  - Builds editable JSON timeline prompts.
  - Inputs include topic/source script, single-scene duration, scene count, aspect ratio, visual style, and presentation format.

- `prompts/ai-video-agent-scene-planning.prompt.ts`
  - Builds fallback scene-planning prompts for Trigger generation.
  - Inputs include final script, scene count, visual style, and presentation format.

- `prompts/ai-video-agent-avatar-scene.prompt.ts`
  - Builds per-scene avatar video prompts.
  - Inputs include the scene row, timeline scene, dialogue rows, visual style, and presentation format.

- `prompts/ai-video-agent-broll.prompt.ts`
  - Builds B-roll/supporting visual prompts.
  - Contains empty style prompt placeholders for Visual Style and Presentation Format. Fill these constants later when final art-direction copy is ready.

## Style Prompt Placeholders

The current Visual Style and Presentation Format option-specific prompt text is intentionally blank:

- Visual Style: `2d_cel`, `3d_blindbox_clay`, `cyberpunk`, `realistic_cinematic`
- Presentation Format: `podcast`, `commentary`, `visual_novel`, `realistic`

Keep these placeholders in source control and fill them in the corresponding prompt file when the final prompt copy is approved.
