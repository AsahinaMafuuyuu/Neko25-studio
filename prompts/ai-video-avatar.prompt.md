# ai-video-avatar.prompt

## 用途

这个文件对应 `ai-video-avatar.prompt.ts`，用于为 AI Video Avatar 功能生成 Agnes image-to-video 提示词。

该提示词会把用户保存的视频脚本和选中的声音名称组合成 provider prompt，交给 Agnes Video V2.0 创建数字人视频任务。

## `buildAiVideoAvatarAgnesPrompt`

### 输入字段

- `video.script`：用户输入或脚本生成器生成的数字人口播脚本。
- `video.voice_name`：用户选择的声音名称，用作动作和表达风格的弱提示。

## Prompt 中文翻译

```text
{video.script}

如果存在 voice_name：
选中的声音风格是 {video.voice_name}；请让主持人的动作保持自然，以适配未来的带声音数字人工作流。

如果不存在 voice_name：
请让主持人的动作保持自然，以适配未来的带声音数字人工作流。
```

## 备注

生成函数会在返回前把最终 prompt 截断到 2000 个字符以内，避免超过当前视频 provider 的输入上限。

Provider 请求参数，例如头像图片 URL、画幅比例和时长，由 `lib/ai-video-avatar-requests.ts` 负责封装。
