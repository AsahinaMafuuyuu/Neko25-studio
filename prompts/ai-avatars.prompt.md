# ai-avatars.prompt

## 用途

这个文件对应 `ai-avatars.prompt.ts`，用于为 AI Avatars 功能生成图片模型提示词。

该提示词会根据用户选择的头像风格、可选个性化描述、是否上传了参考图，以及目标画幅，构造给图片生成或图片编辑模型使用的最终 prompt。

## `buildAiAvatarImagePrompt`

### 输入字段

- `style`：头像风格，可选值来自 `AvatarStyle`。
- `prompt`：用户输入的个性化描述，可为空。
- `hasSourceImage`：是否存在用户上传的源图片。
- `variant`：目标图片变体，包含画幅比例和变体说明。

## Style Prompt 中文说明

- `Podcast`：生成适合播客主持人场景的精致头像，包含演播室光线、自信表情、专业媒体人物气质。
- `Casual`：生成亲切自然的日常头像，包含自然光、轻松穿搭、现代个人资料照风格。
- `3D Cartoon`：生成高质量 3D 卡通头像，包含柔和光照、表达丰富的五官、圆润形体和高级动画角色感。
- `Stylized`：生成风格化编辑头像，包含艺术化光线、鲜明色彩处理和具有记忆点的现代肖像身份。

## Prompt 中文翻译

```text
{stylePrompts[input.style]}

只返回一张 {input.variant.label} 头像图片，画幅比例必须是 {input.variant.aspectRatio}。

按照 {input.variant.aspectRatio} 构图完整画面；不要裁切或把方图加黑边/留白塞进目标比例。

保持脸部清晰可见，并保留足够头部空间和肩部细节，方便作为头像预览。

如果存在源图片：
使用上传图片作为主要参考图。除非个性化描述明确要求改变，否则保留主体身份、姿势、构图和整体画面关系。

如果存在个性化描述：
个性化描述：{input.prompt}
```

## 备注

该 prompt 只负责描述图片生成意图，不包含 provider API 参数。图片尺寸、生成/编辑 endpoint 和错误处理由 `lib/ai-avatars-requests.ts` 负责。
