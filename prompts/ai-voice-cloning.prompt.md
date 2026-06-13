# ai-voice-cloning.prompt

## 用途

这个文件对应 `ai-voice-cloning.prompt.ts`，用于集中封装 AI Voice Cloning 相关 provider input payload。

这里的 builder 不生成自然语言大模型 prompt，而是生成语音相关 provider 的结构化输入：

- Replicate WhisperX 语音样本转写。
- Replicate Qwen3-TTS voice clone TTS。
- Deepgram 默认声音 TTS。

## `buildVoiceSampleTranscriptionInput`

用于把用户上传的声音样本发送给 WhisperX 转写，生成后续 voice clone 资产里的 `sample_transcript` 和 `sample_detected_language`。

### Payload 中文说明

```text
task: transcribe
debug: 关闭调试输出
vad_onset: 0.5
audio_file: {audioUrl}
batch_size: 64
vad_offset: 0.363
diarization: 不做说话人分离
temperature: 0
align_output: 不返回对齐结果
language_detection_min_prob: 0
language_detection_max_tries: 5
```

## `buildQwenVoiceCloneInput`

用于把保存的用户声音样本作为参考音频，调用 Qwen3-TTS 生成克隆声音的 TTS 输出。

### Payload 中文说明

```text
mode: voice_clone
speaker: {input.speaker}
language: {input.language}
reference_audio: {input.referenceAudioUrl}
text: {input.text}
```

## `buildDeepgramSpeakBody`

用于默认声音预览和默认声音 TTS。Deepgram 的 voice model 通过 URL query 的 `model` 参数传入，body 只包含文本。

### Payload 中文说明

```text
text: {text}
```

## 备注

这些 builder 只负责 provider 输入结构。API key、模型名称、请求 URL、轮询和错误处理由 `lib/ai-voice-cloning-requests.ts` 负责。
