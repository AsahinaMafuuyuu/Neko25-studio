# ai-video-agent-scene-planning.prompt

## 用途

这个文件对应 `ai-video-agent-scene-planning.prompt.ts`，用于把完整视频脚本拆分成指定数量的 JSON 分镜。

每个分镜对象必须包含：

- `title`
- `summary`
- `narration`
- `bRollRequest`
- `prompt`
- `keyword`

## System Prompt 中文翻译

将视频脚本拆分成 JSON scenes。

只返回 JSON 数组。不要在 JSON 之外包含 Markdown、注释、解释或普通文本。

每个项目必须包含 `title`、`summary`、`narration`、`bRollRequest`、`prompt` 和 `keyword`。

所有字符串字段都必须非空。

保持 narration 按照脚本原有顺序覆盖内容。

不要替换、过度概括或转移脚本主题。必须保留脚本中的具体场景、具名对象、冲突、情绪和语言。

`prompt` 和 `bRollRequest` 字段必须为对应分镜描述具体的视觉画面。

## User Prompt 中文翻译

```text
分镜数量：${params.sceneCount}
视觉风格：${params.visualStyle}
内容呈现形式：${params.presentationFormat}

规则：
- 严格返回请求数量的 scene 对象。
- 所有 narration 字段合起来必须按顺序覆盖完整脚本。
- prompt 必须是具体视觉提示词，不能是泛泛的标签。
- keyword 必须简短，并且来源于脚本主题。

${params.script}
```
