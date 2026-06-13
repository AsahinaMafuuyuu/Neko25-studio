# Kravix AI Studio

Kravix AI Studio 是一个基于 Next.js 的多语言 AI 创作工作台，面向视频生成、数字人、AI 头像、语音克隆和素材管理等工作流。项目使用 InsForge 作为认证、数据库、存储和积分体系后端，使用 Trigger.dev 执行长耗时生成任务，并用 Remotion 做视频预览与最终渲染。

## 主要功能

- 多语言门户与工作台：支持 `zh`、`en`、`ja`，默认入口重定向到 `/zh`。
- 认证与用户资料：邮箱密码登录/注册，Google 和 X OAuth 入口，用户资料同步到 InsForge。
- AI Video Agent：创建多场景视频项目，支持脚本/主题生成、时间线、数字人片段、B-roll、字幕、转场、预览、渲染和下载。
- AI Video Avatar：基于头像图片与提示词生成数字人视频。
- AI Avatars：上传或提示词生成可复用头像，支持桌面和移动端比例图。
- AI Voice Cloning：语音克隆、预览、TTS 任务和语音资产管理。
- My Library：统一素材库入口，用于沉淀视频、音频、头像和项目资产。

## 技术栈

- Next.js `16.2.7` + React `19.2.4`
- TypeScript + Tailwind CSS 4
- next-intl 多语言路由
- InsForge SDK/CLI：认证、数据库、存储、迁移、项目配置
- Trigger.dev v4：后台生成任务
- Remotion：视频预览和渲染
- Replicate、Deepgram、Agnes、Pixabay 及 OpenAI-compatible 接口：生成脚本、图片、视频、语音与字幕
- shadcn/ui、Base UI、lucide-react：界面组件与图标

## 快速开始

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。根路径会跳转到 `/zh`，工作台入口为 `/zh/dashboard`。

常用命令：

```bash
npm run dev      # 本地开发
npm run lint     # ESLint
npm run build    # 生产构建
npm test         # lint + build
npm run start    # 启动生产构建
```

> 项目约定：修改 JavaScript 文件后必须运行 `npm test`。新增生产依赖前需要先确认，并优先使用 `npm`。

## 环境变量

本地环境变量放在 `.env.local` 或 `.env` 中，不要提交任何真实密钥。当前代码会读取以下变量：

### InsForge

```bash
NEXT_PUBLIC_INSFORGE_URL=https://your-project.us-east.insforge.app
NEXT_PUBLIC_INSFORGE_API_KEY=your-public-or-project-key
INSFORGE_URL=https://your-project.us-east.insforge.app
INSFORGE_API_KEY=your-server-side-key
```

`NEXT_PUBLIC_*` 用于浏览器端认证请求；`INSFORGE_*` 用于服务端 API 路由、资料同步、存储和数据库操作。`.insforge/project.json` 由 CLI 管理，不要手动编辑或提交。

### 应用与后台任务

```bash
APP_BASE_URL=http://localhost:3000
```

`APP_BASE_URL` 用于 Trigger.dev 任务读取相对路径媒体资源。本地开发通常是 `http://localhost:3000`，部署后改为线上站点 URL。

### 脚本与图片生成

```bash
SCRIPT_GENERATOR_API_KEY=
SCRIPT_GENERATOR_API_URL=https://api.aisz.mom/v1/chat/completions
SCRIPT_GENERATOR_MODEL=

IMAGE_MAKER_API_URL=
IMAGE_MAKER_API_KEY=
IMAGE_MAKER_MODEL=
IMAGE_MAKER_PROVIDER=agnes
IMAGE_MAKER_TIMEOUT_MS=120000
IMAGE_MAKER_DESKTOP_SIZE=1024x576
IMAGE_MAKER_MOBILE_SIZE=576x1024
```

`IMAGE_MAKER_PROVIDER` 可为 `agnes` 或 `openai-compatible`。不设置时会根据 URL 或模型名推断。

### 语音、字幕与视频生成

```bash
DEEPGRAM_API_KEY=
REPLICATE_API_TOKEN=
REPLICATE_QWEN_TTS_MODEL=qwen/qwen3-tts
REPLICATE_QWEN_TTS_SPEAKER=Aiden
REPLICATE_WHISPERX_MODEL=
REPLICATE_POLL_TIMEOUT_MS=600000

AGNES_API_KEY=
AGNES_BROLL_API_KEY=
VIDEO_GENERATOR_API_URL=https://apihub.agnes-ai.com/v1/videos
VIDEO_GENERATOR_MODEL=
VIDEO_GENERATOR_CHANNEL1_API_KEY=
VIDEO_GENERATOR_CHANNEL2_API_KEY=

PIXABAY_API_KEY=
FFMPEG_BIN=
FFMPEG_PATH=
```

`ffmpeg-static` 已作为依赖安装，只有在需要指定外部 ffmpeg 时才设置 `FFMPEG_BIN` 或 `FFMPEG_PATH`。

## InsForge 后端

项目已链接到 InsForge 项目 `Neko25-studio`，API base 为 `https://hq4he973.us-east.insforge.app`。后端相关文件：

- `insforge.toml`：认证回调、注册开关、密码策略等项目配置。
- `migrations/`：数据库迁移，包含用户资料、AI 头像、语音克隆、AI Video Avatar、默认素材目录、AI Video Agent v1/v2 等表结构。
- `migrations_disabled/`：暂不启用的迁移备份。

常用 CLI：

```bash
npx @insforge/cli current
npx @insforge/cli metadata
npx @insforge/cli db migrations list
npx @insforge/cli db migrations up --all
npx @insforge/cli config plan
npx @insforge/cli config apply
```

写迁移时使用 `migrations/YYYYMMDDHHmmss_name.sql` 命名。InsForge 迁移由后端托管事务执行，迁移文件里不要手写 `BEGIN` / `COMMIT`。

## Trigger.dev 任务

Trigger 配置在 `trigger.config.ts`，任务目录为 `src/trigger`：

- `ai-avatar.ts`：头像生成。
- `ai-voice.ts`：语音克隆、TTS、语音处理。
- `ai-video-avatar.ts`：数字人视频生成和回调收尾。
- `ai-video-agent.ts`：多场景视频生成、字幕、B-roll、数字人片段、Remotion 渲染。
- `example.ts`：示例任务。

本地调试生成任务时，需要同时启动 Next.js 开发服务，并确保 Trigger.dev 环境中配置了同一组服务端密钥。

## 项目结构

```text
app/                 Next.js App Router 页面与 API Route
components/          UI 组件、认证页、Dashboard 功能页
hooks/               React hooks
lib/                 InsForge、生成服务、服务端数据访问和类型工具
messages/            zh/en/ja 多语言文案
migrations/          InsForge/Postgres 迁移
prompts/             AI Video Agent 的提示词模板
public/              演示视频、图片和静态资源
src/i18n/            next-intl 路由与请求配置
src/trigger/         Trigger.dev 后台任务
```

## 开发注意事项

- 这个项目使用 Next.js 16，相关 API 可能不同于旧版本。改动 Next.js 相关代码前，优先阅读 `node_modules/next/dist/docs/` 里的对应文档。
- InsForge 数据库 insert 使用数组格式：`insert([{ ... }])`。
- RLS 中引用用户使用 `auth.users(id)`，策略中使用 `auth.uid()`。
- 存储上传后同时持久化返回的 `url` 和 `key`。
- `.env`、`.env.local`、`.insforge/`、`.trigger/` 和日志文件都不应提交。

## 验证

提交前建议至少运行：

```bash
npm test
```

该命令会依次执行 ESLint 和 Next.js 生产构建，是当前项目的主要质量门禁。
