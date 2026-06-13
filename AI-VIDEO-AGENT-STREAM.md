1. AI Video Agent 标准模型 I/O
SCRIPT_GENERATOR：创建页 Generate Script
输入：topic、duration、aspectRatio、sceneCount、长度要求。
期望输出：JSON timeline。
{
  "version": 2,
  "durationSeconds": 30,
  "aspectRatio": "16:9",
  "scenes": [
    {
      "id": "scene-1",
      "index": 0,
      "startSeconds": 0,
      "endSeconds": 7.5,
      "title": "冲突开场",
      "visual": {
        "source": "auto",
        "prompt": "一个人吃雪糕时被路人挑衅，现代街头场景"
      },
      "dialogues": [
        {
          "id": "dialogue-1-1",
          "startSeconds": 0,
          "endSeconds": 7.5,
          "text": "正吃着雪糕，突然有人冲过来反驳说心脏不好，还挑衅说：你跑不过我，你信不信？",
          "emotion": "surprised"
        }
      ]
    }
  ]
}
SCRIPT_GENERATOR：后台 topic 转纯脚本
输入：topic、duration、目标字数。
期望输出：纯 voiceover script。
正吃着雪糕，突然有人冲过来反驳说心脏不好...
这个就是你贴的格式，适合这一层。
SCRIPT_GENERATOR：后台 script 转 scenes
输入：完整 script、sceneCount、bRollStyle。
期望输出：JSON array。
[
  {
    "title": "荒谬反驳",
    "summary": "用吃雪糕和心脏健康的荒谬关联引出冲突。",
    "narration": "正吃着雪糕，突然有人冲过来反驳说心脏不好...",
    "bRollRequest": "街头吃雪糕，被人挑衅的戏剧化画面",
    "prompt": "cinematic street scene, person eating ice cream, confrontation",
    "keyword": "ice cream argument"
  }
]
VOICE：默认音色 Deepgram
输入：
{
  "model": "provider_voice_id",
  "text": "每句 dialogue 的 text"
}
输出：音频 Blob，通常是 audio/wav 或 audio/mpeg。
VOICE：自定义音色 Replicate Qwen TTS
输入：
{
  "mode": "voice_clone",
  "speaker": "Aiden",
  "language": "auto",
  "reference_audio": "用户声音样本 URL",
  "text": "dialogue text"
}
输出：音频 URL，再下载成 Blob。
IMAGE_MAKER：场景参考图
输入：
{
  "model": "agnes-image-2.1-flash",
  "prompt": "scene visual prompt + 画幅要求 + no text overlays",
  "n": 1,
  "size": "1024x576",
  "width": 1024,
  "height": 576
}
输出：图片，代码兼容这些字段：
{
  "data": [
    {
      "b64_json": "...base64..."
    }
  ]
}
或：
{
  "data": [
    {
      "url": "https://..."
    }
  ]
}
AGNES VIDEO：avatar scene video
输入：
{
  "model": "agnes-video-v2.0",
  "prompt": "avatar-led scene prompt",
  "image": "avatar image URL",
  "width": 1152,
  "height": 648,
  "num_frames": 241,
  "frame_rate": 8,
  "extra_body": {
    "audio": "scene dialogue audio URL"
  }
}
输出：task/video id。
{
  "task_id": "...",
  "video_id": "...",
  "status": "queued"
}
轮询后期望：
{
  "status": "completed",
  "video_url": "https://...",
  "thumbnail_url": "https://..."
}
最终合成
这里不是 AI 模型，是 ffmpeg。
输入：每个 avatar_scene_video + 每句 dialogue audio。
输出：最终 final.mp4。