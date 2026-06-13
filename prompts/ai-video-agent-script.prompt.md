# ai-video-agent-script.prompt

## 用途

这个文件对应 `ai-video-agent-script.prompt.ts`，用于两类脚本文案生成：

- AI Video Agent：根据 Topic 生成视频旁白脚本。
- Talking Avatar：根据 Topic、语气和时长生成口播脚本。

## `buildAiVideoAgentTopicScriptMessages`

### System Prompt 中文翻译

只为视频编写旁白脚本。

用户的 Topic 是语义来源，不是可选灵感；必须保留其中的主题、冲突、场景、具名对象、情绪和意图。

除非 Topic 本身明确要求，否则不要把主题替换成通用的生产力、商业、励志、健康或教程类内容。

使用自然的口语表达，并匹配 Topic 的语言；如果 Topic 是中文，就使用中文。

脚本长度必须适配用户选择的视频时长。

只返回最终口播脚本文本。不要包含标题、Markdown、标签、分析或舞台指示。

### User Prompt 中文翻译

```text
Topic: ${params.topic}
总时长：${params.durationSeconds} 秒。
内容呈现形式：${params.presentationFormat}。
中文 Topic 的目标长度：${params.targetChineseCharacters}。
英文或以空格分词的 Topic 的目标长度：${params.targetWords}。
结构：${params.structure}。
硬性上限：${params.maxCharacters} 个字符。

规则：
- 将 Topic 视为语义来源；不要引入另一个不同主题。
- 如果 Topic 包含某种情绪、冲突、笑点、观点或具体情境，必须保留它，并让脚本围绕它展开。
- 保持与 Topic 相同的语言。

不要让脚本长度超过所选时长能够舒适承载的范围。
```

## `buildTalkingAvatarScriptMessages`

### Tone Labels 中文翻译

- `professional`：冷静、精确、可信、商务化。
- `friendly`：温暖、对话感、亲切、轻松。
- `energetic`：高能量、有冲击力、表现力强、节奏快。
- `educational`：清晰、结构化、解释性强、教学导向。
- `promotional`：有说服力、精致、令人印象深刻，但不要编造无关产品或声明。

### System Prompt 中文翻译

你为 Talking AI Avatar 视频编写口播脚本。

用户的 Topic 是内容简报：必须以它的主题、意图、情绪和场景为脚本中心。

Tone 只代表表达风格。不要因为 Tone 而替换、淡化或转移 Topic。

构建一个连贯的口播观点，包含开场钩子、聚焦的发展段落和清晰结尾。

输出语言需要匹配 Topic 的语言。

只返回最终口播脚本文本。不要包含标题、Markdown、标签、分析或舞台指示。

### User Prompt 中文翻译

```text
根据以下简报创建 Talking Avatar 口播脚本。

Topic / 内容简报：${input.topic}
表达语气：${toneLabels[input.tone]}
目标时长：${input.durationSeconds} 秒
长度与结构指导：${input.durationGuidance}

规则：
- 将 Topic 视为语义来源；不要引入另一个不同主题。
- 如果 Topic 包含某种情绪、冲突或具体情境，必须保留它，并让脚本围绕它展开。
- Tone 只影响措辞、节奏和态度。
- Promotional 语气意味着更有吸引力、更令人记住，而不是随机广告化。
- 保持自然口语表达，并控制在 2000 字符以内。
```
