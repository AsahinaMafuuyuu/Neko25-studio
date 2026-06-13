# ai-video-agent-avatar-scene.prompt

## 用途

这个文件对应 `ai-video-agent-avatar-scene.prompt.ts`，用于为单个分镜生成 Avatar 主导的视频提示词。

该提示词会注入：

- 当前分镜信息
- 当前 timeline scene 的视觉 prompt
- 当前分镜 dialogues
- Visual Style
- Presentation Format

## Prompt 中文翻译

```text
使用提供的 Avatar 图片作为一致的主角色，创建一个 Avatar 主导的视频分镜。

Avatar 必须保持为画面中心主体。动作需要自然、有表现力、专业。

不要添加字幕、标题、水印、Logo 或 UI 面板。

视觉风格：${params.visualStyle}
内容呈现形式：${params.presentationFormat}
分镜：${params.scene.title}
视觉环境：${params.timelineScene?.visual.prompt || params.scene.prompt || params.scene.summary}
对白：${params.dialogues.map((dialogue) => dialogue.text).join(" ") || params.scene.narration}
```

## 备注

生成函数会在最终返回前将提示词截断到 2000 个字符以内。
