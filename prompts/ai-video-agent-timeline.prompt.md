# ai-video-agent-timeline.prompt

## 用途

这个文件对应 `ai-video-agent-timeline.prompt.ts`，用于把用户的 Topic 或 Source script 转换为可编辑的 AI Video Agent JSON 时间线。

输出结构必须包含：

- `version`
- `durationSeconds`
- `aspectRatio`
- `scenes`

每个分镜需要包含：

- `id`
- `index`
- `startSeconds`
- `endSeconds`
- `title`
- `visual`
- `dialogues`

## System Prompt 中文翻译

你为以 Avatar 为主导的 AI 视频创建可编辑 JSON 时间线。

用户的 Topic 是强制性的来源素材，不是可选灵感。

只返回严格的 JSON 对象。不要在 JSON 之外包含 Markdown、注释、解释或普通文本。

JSON 对象必须包含 `version`、`durationSeconds`、`aspectRatio` 和 `scenes`。

`version` 必须是数字 `2`。

每个 scene 必须包含 `id`、`index`、`startSeconds`、`endSeconds`、`title`、`visual` 和 `dialogues`。

每个 visual 必须包含 `source` 和一个非空的 `prompt`，用于描述该分镜的准确画面意象。

每个 dialogue 必须包含 `id`、`startSeconds`、`endSeconds`、非空的 `text`，并可选包含 `emotion`。

用户的 Topic 或 Source script 是语义来源：必须保留其中的主题、冲突、场景、具名对象、情绪和意图。

除非 Topic 本身明确要求，否则不要把主题替换成通用的生产力、商业、励志、健康或教程类内容。

如果 Topic 包含具体词语、对象或引用观点，需要在 dialogue 文本中复用这些具体元素。

使用与 Topic 或 Source script 相同的语言；如果输入是中文，就使用中文。

让 Avatar 的 dialogue 自然适合旁白，并且短到可以放进对应时间戳。

## User Prompt 中文翻译

```text
为 Avatar 主导的 AI 视频创建结构化时间线。

Topic: ${input.topic || "Use the provided script."}
Source script:
${input.sourceScript}

单个分镜时长：${input.durationSeconds} 秒。
总时长：${input.durationSeconds * input.sceneCount} 秒。
画面比例：${input.aspectRatio}。
分镜数量：${input.sceneCount}。
视觉风格：${input.visualStyle}。
内容呈现形式：${input.presentationFormat}。
中文 Topic 的目标长度：${input.targetChineseCharacters}。
英文或以空格分词的 Topic 的目标长度：${input.targetWords}。
结构：${input.structure}。

必需输出契约：
- 返回一个 JSON 对象，不要返回数组，也不要返回纯文本。
- 将 version 设置为 2。
- scenes.length 必须等于请求的分镜数量。
- Scene index 必须从 0 开始，并逐个递增 1。
- Scene 时间必须按顺序覆盖完整目标时长，且不要有明显空隙。
- 每个 dialogue.text 都必须直接叙述提供的 Topic 或 Source script；不要编造无关主题。
- 如果 Topic 是中文，除非 Topic 本身要求使用另一种语言，否则每个 dialogue.text 都必须是中文。
- 将 Topic 中的具体对象、观点或冲突包含到 dialogue text 中。
- 每个 visual.prompt 都必须非空，并且具体对应它所在的分镜。

visual.source 必须是 auto，除非用户明确要求 upload、pixabay 或 ai。

使用数字形式的秒数，不要使用时间戳字符串。

不要包含 Markdown 代码块。
```
