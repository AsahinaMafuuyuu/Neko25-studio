# Kravix AI Studio

Kravix AI Studio 是一个基于 Next.js 的多语言 AI 创作工作台，面向视频生成、数字人、AI 头像、语音克隆和素材管理等工作流。项目使用 Supabase 负责认证、Postgres/RLS、用户资料、积分和任务记录，使用 Cloudflare R2 存放视频、音频、图片等媒体资源。

## 主要功能

- 多语言门户和工作台：支持 `zh`、`en`、`ja`，默认入口重定向到 `/zh`。
- 认证与用户资料：邮箱密码登录/注册，Google 和 X OAuth，用户资料同步到 Supabase。
- AI Video Agent：创建多场景视频项目，支持脚本、时间线、数字人片段、B-roll、字幕、预览、渲染和下载。
- AI Video Avatar：基于头像图片与提示词生成数字人视频。
- AI Avatars：上传或生成可复用头像，支持桌面和移动端比例图。
- AI Voice Cloning：语音克隆、预览、TTS 任务和语音资产管理。
- My Library：统一素材库入口，用于管理视频、音频、头像和项目资产。

## 技术栈

- Next.js `16.2.7` + React `19.2.4`
- TypeScript + Tailwind CSS 4
- next-intl 多语言路由
- Supabase Auth + Postgres/RLS
- Cloudflare R2 媒体存储
- Trigger.dev v4 后台生成任务
- Remotion 视频预览和渲染
- Replicate、Deepgram、Agnes、Pixabay 和 OpenAI-compatible 接口
- shadcn/ui、Base UI、lucide-react

## 快速开始

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。根路径会跳转到 `/zh`，工作台入口为 `/zh/dashboard`。

常用命令：

```bash
npm run dev
npm run lint
npm run build
npm test
npm run start
```

项目约定：修改 JavaScript/TypeScript 文件后必须运行 `npm test`。新增生产依赖前需要确认，并优先使用 `npm`。

## 环境变量

本地环境变量放在 `.env.local` 或 `.env` 中，不要提交真实密钥。参考 `.env.example`。

### Supabase

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Supabase 负责 Auth、Postgres、RLS、用户资料、积分和任务记录。需要在 Supabase dashboard 中启用 Email Auth、Google OAuth、Twitter/X OAuth，并配置本地和生产环境的 `/auth/callback` 回调 URL。

### Cloudflare R2

```bash
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_BUCKET=kravix-media
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_PUBLIC_BASE_URL=
```

R2 负责所有视频、音频、头像、封面和下载文件。应用会把逻辑 bucket 名写入对象 key 前缀，例如 `ai-avatars/users/{userId}/...`，数据库中持久化返回的 `url` 和 `key`。

### 应用和任务

```bash
APP_BASE_URL=http://localhost:3000
TRIGGER_PROJECT_REF=
TRIGGER_SECRET_KEY=
TOTP_ENCRYPTION_KEY=
```

`APP_BASE_URL` 用于 Trigger.dev 任务解析相对媒体 URL。本地开发通常为 `http://localhost:3000`，部署后改为线上站点 URL。

## 数据库

数据库迁移文件位于 `migrations/`，用于 Supabase Postgres。按文件名顺序应用这些 SQL；它们使用 `auth.users(id)` 外键和 `auth.uid()` RLS 策略。

注意：

- 写迁移时使用 `migrations/YYYYMMDDHHmmss_name.sql` 命名。
- RLS 中引用用户使用 `auth.users(id)`，策略中使用 `auth.uid()`。
- 数据库 insert 仍使用数组格式：`insert([{ ... }])`。
- 账户删除使用 Supabase Admin API 删除 auth user，业务表依赖外键级联清理。

## 项目结构

```text
app/                 Next.js App Router 页面和 API Route
components/          UI 组件、认证页、Dashboard 功能页
hooks/               React hooks
lib/                 Supabase/R2 适配、生成服务、服务端数据访问和类型工具
messages/            zh/en/ja 多语言文案
migrations/          Supabase/Postgres 迁移
prompts/             AI Video Agent 提示词模板
public/              演示视频、图片和静态资源
src/i18n/            next-intl 路由与请求配置
src/trigger/         Trigger.dev 后台任务
```

## 验证

提交前至少运行：

```bash
npm test
```

该命令会依次执行 ESLint 和 Next.js 生产构建。
