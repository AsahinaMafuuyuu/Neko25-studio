## 执行前核对

在项目根目录执行：

```
npx @insforge/cli current
```

确认当前项目是：

```
Neko25-studio
```

然后检查旧表 owner：

```
npx @insforge/cli db query "select schemaname, tablename, tableowner from pg_tables where schemaname = 'public' and tablename in ('ai_video_projects','ai_video_scenes','ai_video_assets') order by tablename;"
```

如果看到类似：

```
ai_video_assets   postgres
ai_video_projects postgres
ai_video_scenes   postgres
```

说明旧表确实不是 `project_admin` owner，不应继续对旧表做 `ALTER TABLE`。

------

## 新建迁移文件

在项目根目录创建文件：

```
migrations/20260611130000_ai-video-agent-v2-main-tables.sql
```

内容如下：

```
-- AI Video Agent workflow v2 main tables.
--
-- This migration intentionally does not ALTER the legacy ai_video_* tables.
-- Some existing legacy tables are owned by the platform postgres role, which
-- prevents project_admin migrations from evolving them. These v2 tables are the
-- new source of truth for AI Video Agent projects going forward.

create table if not exists public.ai_video_v2_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled AI Video',
  prompt text not null default '',
  script text not null default '',
  timeline jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  aspect_ratio text not null default '9:16',
  workflow_version integer not null default 2,
  generation_mode text not null default 'scene_segments',
  lip_sync_mode text not null default 'compatible',
  caption_effect text not null default 'soft_fade',
  avatar_asset_id uuid,
  voice_asset_id uuid,
  trigger_job_id text,
  final_video_url text,
  final_video_key text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_projects_aspect_ratio_check check (aspect_ratio in ('16:9', '9:16')),
  constraint ai_video_v2_projects_workflow_version_check check (workflow_version = 2),
  constraint ai_video_v2_projects_status_check check (
    status in ('draft', 'queued', 'generating', 'rendering', 'completed', 'failed', 'cancelled')
  )
);

create table if not exists public.ai_video_v2_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_v2_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_index integer not null default 0,
  start_seconds numeric not null default 0,
  end_seconds numeric not null default 0,
  title text not null default '',
  summary text not null default '',
  visual_source text not null default 'auto',
  visual_prompt text not null default '',
  uploaded_asset_id uuid,
  resolved_asset_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_scenes_visual_source_check check (visual_source in ('upload', 'pixabay', 'ai', 'auto')),
  constraint ai_video_v2_scenes_time_check check (end_seconds >= start_seconds),
  unique (project_id, scene_index)
);

create table if not exists public.ai_video_v2_dialogues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_v2_projects(id) on delete cascade,
  scene_id uuid references public.ai_video_v2_scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dialogue_index integer not null default 0,
  start_seconds numeric not null default 0,
  end_seconds numeric not null default 0,
  text text not null default '',
  emotion text,
  audio_asset_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_dialogues_time_check check (end_seconds >= start_seconds),
  unique (project_id, scene_id, dialogue_index)
);

create table if not exists public.ai_video_v2_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_v2_projects(id) on delete cascade,
  scene_id uuid references public.ai_video_v2_scenes(id) on delete set null,
  dialogue_id uuid references public.ai_video_v2_dialogues(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null,
  provider text not null default 'unknown',
  storage_key text,
  public_url text,
  mime_type text,
  duration_seconds numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_assets_type_check check (
    asset_type in (
      'avatar',
      'voice',
      'voiceover',
      'captions_json',
      'composition_json',
      'scene_image',
      'scene_video',
      'dialogue_audio',
      'avatar_scene_video',
      'final_render'
    )
  )
);

create table if not exists public.ai_video_v2_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_v2_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_job_id text,
  status text not null default 'queued',
  progress integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_jobs_status_check check (
    status in ('queued', 'generating', 'rendering', 'completed', 'failed', 'cancelled')
  ),
  constraint ai_video_v2_jobs_progress_check check (progress between 0 and 100)
);

create index if not exists ai_video_v2_projects_user_created_idx
  on public.ai_video_v2_projects (user_id, created_at desc);

create index if not exists ai_video_v2_projects_trigger_job_idx
  on public.ai_video_v2_projects (trigger_job_id);

create index if not exists ai_video_v2_scenes_project_index_idx
  on public.ai_video_v2_scenes (project_id, scene_index);

create index if not exists ai_video_v2_dialogues_project_index_idx
  on public.ai_video_v2_dialogues (project_id, start_seconds, dialogue_index);

create index if not exists ai_video_v2_dialogues_scene_index_idx
  on public.ai_video_v2_dialogues (scene_id, dialogue_index);

create index if not exists ai_video_v2_assets_project_type_idx
  on public.ai_video_v2_assets (project_id, asset_type);

create index if not exists ai_video_v2_jobs_project_idx
  on public.ai_video_v2_jobs (project_id, created_at desc);

create index if not exists ai_video_v2_jobs_trigger_job_idx
  on public.ai_video_v2_jobs (trigger_job_id);

alter table public.ai_video_v2_projects enable row level security;
alter table public.ai_video_v2_scenes enable row level security;
alter table public.ai_video_v2_dialogues enable row level security;
alter table public.ai_video_v2_assets enable row level security;
alter table public.ai_video_v2_jobs enable row level security;

create policy "ai_video_v2_projects_owner_all"
  on public.ai_video_v2_projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_video_v2_scenes_owner_all"
  on public.ai_video_v2_scenes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_video_v2_dialogues_owner_all"
  on public.ai_video_v2_dialogues
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_video_v2_assets_owner_all"
  on public.ai_video_v2_assets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_video_v2_jobs_owner_all"
  on public.ai_video_v2_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to project_admin;

grant select, insert, update, delete on public.ai_video_v2_projects to project_admin;
grant select, insert, update, delete on public.ai_video_v2_scenes to project_admin;
grant select, insert, update, delete on public.ai_video_v2_dialogues to project_admin;
grant select, insert, update, delete on public.ai_video_v2_assets to project_admin;
grant select, insert, update, delete on public.ai_video_v2_jobs to project_admin;

grant usage, select, update on all sequences in schema public to project_admin;

alter table public.ai_video_v2_projects owner to project_admin;
alter table public.ai_video_v2_scenes owner to project_admin;
alter table public.ai_video_v2_dialogues owner to project_admin;
alter table public.ai_video_v2_assets owner to project_admin;
alter table public.ai_video_v2_jobs owner to project_admin;
```

------

## 注意：如果 policy already exists 报错

Postgres 不支持所有版本的 `CREATE POLICY IF NOT EXISTS`，所以上面的 SQL 没用 `if not exists`。

如果你重复执行迁移，可能会报 policy 已存在。正常情况下只通过 migration 执行一次，不会有问题。

如果需要手动重复执行，请先删除已有 policy，或把 `create policy` 包成 `do 

\[ begin ... exception when duplicate_object then null; end \]

;`。

------

## 执行迁移

不要再执行旧的失败迁移：

```
npx @insforge/cli db migrations up 20260610120000_ai-video-agent-workflow-v2.sql
```

改为执行新迁移：

```
npx @insforge/cli db migrations up 20260611130000_ai-video-agent-v2-main-tables.sql
```

------

## 验证新表存在

```
npx @insforge/cli db query "select schemaname, tablename, tableowner from pg_tables where schemaname = 'public' and tablename like 'ai_video_v2_%' order by tablename;"
```

目标结果应类似：

```
ai_video_v2_assets     project_admin
ai_video_v2_dialogues  project_admin
ai_video_v2_jobs       project_admin
ai_video_v2_projects   project_admin
ai_video_v2_scenes     project_admin
```

如果 owner 仍然是 `postgres`，说明 InsForge migration runner 仍然用平台角色创建表，而且 `OWNER TO project_admin` 没有生效。这种情况需要 InsForge 修 migration runner 或 owner 转移权限。

------

## 验证新字段

```
npx @insforge/cli db query "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'ai_video_v2_projects' order by ordinal_position;"
```

应看到：

```
id
user_id
title
prompt
script
timeline
status
aspect_ratio
workflow_version
generation_mode
lip_sync_mode
caption_effect
avatar_asset_id
voice_asset_id
trigger_job_id
final_video_url
final_video_key
error_message
metadata
created_at
updated_at
```

------

## 代码切换清单

迁移成功后，需要把 AI Video Agent v2 的读写从旧表切到新表。

需要重点检查这些文件：

```
lib/ai-video-agent-server.ts
app/api/ai-video-agent/route.ts
app/api/ai-video-agent/script/route.ts
app/api/ai-video-agent/jobs/[id]/route.ts
app/api/ai-video-agent/uploads/route.ts
src/trigger/ai-video-agent.ts
components/dashboard/create-ai-video-agent-client.tsx
components/dashboard/ai-video-agent-remotion.tsx
```

将 v2 主流程中的表名替换为：

```
ai_video_projects       -> ai_video_v2_projects
ai_video_scenes         -> ai_video_v2_scenes
ai_video_dialogues      -> ai_video_v2_dialogues
ai_video_assets         -> ai_video_v2_assets
```

但不要盲目全局替换。建议只替换 v2 工作流相关读写。

旧项目兼容逻辑可以保留旧表读取。

------

## 推荐代码改法

建议在 `lib/ai-video-agent-server.ts` 增加表名常量：

```
export const AI_VIDEO_V2_TABLES = {
  projects: "ai_video_v2_projects",
  scenes: "ai_video_v2_scenes",
  dialogues: "ai_video_v2_dialogues",
  assets: "ai_video_v2_assets",
  jobs: "ai_video_v2_jobs",
} as const;
```

然后所有 v2 代码使用：

```
insforge.from(AI_VIDEO_V2_TABLES.projects)
insforge.from(AI_VIDEO_V2_TABLES.scenes)
insforge.from(AI_VIDEO_V2_TABLES.dialogues)
insforge.from(AI_VIDEO_V2_TABLES.assets)
insforge.from(AI_VIDEO_V2_TABLES.jobs)
```

不要散落硬编码表名，这样以后如果表名调整，改一处即可。

------

## 测试

修改 JS/TS 后必须执行：

```
npm test
```

这是项目 `AGENTS.md` 明确要求。

如果测试通过，再执行：

```
npm run build
```

如果 build 也通过，再进入 UI 测一次：

1. 打开 AI Video Agent 创建页。
2. 生成 script timeline。
3. 确认 timeline 后创建项目。
4. 检查数据库 `ai_video_v2_projects` 是否新增记录。
5. 检查 `ai_video_v2_scenes`、`ai_video_v2_dialogues`、`ai_video_v2_assets` 是否有数据。
6. 检查 job status 查询是否能返回 timeline/assets/dialogues。
7. 检查 final render 是否写入 `ai_video_v2_assets.asset_type = 'final_render'`。

------

## 回滚方式

因为这个迁移不修改旧表，所以回滚相对简单。

如果刚创建新表但还没上线代码，可以删除新表：

```
drop table if exists public.ai_video_v2_jobs cascade;
drop table if exists public.ai_video_v2_assets cascade;
drop table if exists public.ai_video_v2_dialogues cascade;
drop table if exists public.ai_video_v2_scenes cascade;
drop table if exists public.ai_video_v2_projects cascade;
```

注意：执行 drop 是破坏性操作。只有确认新表没有生产数据时再做。

------

## 最终判断标准

迁移成功且权限正确的判断标准是：

```
npx @insforge/cli db query "select schemaname, tablename, tableowner from pg_tables where schemaname = 'public' and tablename like 'ai_video_v2_%' order by tablename;"
```

必须看到新表 owner 是：

```
project_admin
```

如果不是，后续仍可能遇到不能 `ALTER TABLE` 的问题。

```
有一个重要提醒：这份文档里的 SQL 结构是根据我们当前讨论出的 v2 工作流和已知表名设计的，但我当前没能通过工具实际读取你的本地文件输出，所以它不是“我已自动核对仓库后生成”的版本。你执行前至少跑一遍文档里的核对命令，尤其是确认 `project_admin` 是否存在、`auth.users(id)` 是否可作为外键引用、以及 InsForge 是否支持 `gen_random_uuid()`。
```
