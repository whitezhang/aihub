# AiHub 一期架构设计文档

| 项 | 内容 |
|---|---|
| 关联 PRD | [`docs/prd-phase1-aihub.md`](prd-phase1-aihub.md) |
| 读者 | 架构师、研发 |
| 版本 | 一期（Phase 1） |
| 状态 | 草案（含「已冻结 / 由 PRD 推导 / 待确认提案」） |

**图例**

- **[冻结]**：已写入项目约束或 `DECISIONS.md`，不得擅自改
- **[PRD]**：由产品 PRD 直接推导
- **[提案]**：架构建议，落地前需负责人确认；确认后应记入 `DECISIONS.md`

---

## 1. 目标与约束

### 1.1 架构目标

支撑一期「导航发现」闭环：

1. 前端按五栏 IA 展示列表（热度 / 最新排序、二级标签预留、外链跳出）
2. 后端统一持有内容数据与业务逻辑；前端只调 `/api`
3. 从公开来源（GitHub、Product Hunt）同步摘要类内容到本站存储
4. 在 2G2C 线上环境可持续运行：同步轻量、串行、可失败可重试

### 1.2 硬约束

| 约束 | 来源 |
|---|---|
| 业务逻辑仅在 Node API；前端禁止直连 SQLite | **[冻结]** |
| 单进程 Node（≥22，ESM，`node:http`），不使用 Express | **[冻结]** |
| 数据：SQLite（`node:sqlite`）；路径 `DB_PATH`；migration 在 `src/rd/server/db/migrations/` | **[冻结]** |
| Nginx 托管静态；`/api` → `127.0.0.1:8082`；线上禁止完整前端 build | **[冻结]** |
| 评测相关 spawn 必须串行（本期导航主路径不依赖评测，但同进程须遵守） | **[冻结]** |
| 无账号、无社区、无详情页、无站内综合热度分 | **[PRD]** |
| Product Hunt 仅出现在 AI 前沿；与 GitHub 分开展示 | **[PRD]** |
| 品类三页（提示词/MCP/Skills）来源站点待决，允许空态 | **[PRD]** |

### 1.3 非目标（架构层）

- 用户鉴权、会话、UGC 写入链路
- 搜索引擎 / 全文检索集群
- 微服务拆分、独立爬虫集群、消息队列（一期不引入）
- 线上重编译、并行大规模抓取

---

## 2. 系统上下文

```text
┌─────────────┐     HTTPS      ┌─────────────┐
│  AI 爱好者   │ ─────────────► │    Nginx    │
└─────────────┘                └──────┬──────┘
                                      │
                    静态资源           │ /api/*
                         ▼            ▼
                 ┌────────────┐  ┌────────────────┐
                 │ Vue 前端    │  │ Node API :8082 │
                 │ (构建产物)  │  │ 业务 + 同步任务 │
                 └────────────┘  └────────┬───────┘
                                          │
                                          ▼
                                   ┌────────────┐
                                   │  SQLite    │
                                   └────────────┘
                                          ▲
                    出站拉取（串行、限速）   │
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
              GitHub 公开资料                            Product Hunt 公开页
              （前沿 + 未来品类）                         （仅 AI 前沿）
```

**边界**

- 浏览器只访问本站域名；深度内容在用户点击后离开至源站。
- 同步任务跑在 **同一 Node 进程内**（或由本机 cron 触发本进程提供的内部入口）——**[提案]**，见 §6。

---

## 3. 逻辑架构

### 3.1 分层

| 层 | 职责 | 目录（约定） |
|---|---|---|
| 前端展示 | 路由、列表 UI、排序/标签交互、外链；调用 `/api` | `src/rd/web/` |
| HTTP API | 路由分发、参数校验、只读查询、触发/状态查询（同步） | `src/rd/server/http/` |
| 领域服务 | 栏目列表查询、排序规则、标签过滤、空态语义 | `src/rd/server/services/` |
| 同步（Ingest） | 来源适配器、归一化、写入/更新条目、任务状态 | `src/rd/server/ingest/` |
| 持久化 | SQLite access、migrations | `src/rd/server/db/` |

### 3.2 前端信息架构映射 **[PRD]**

| 路由（提案） | 页面 | 数据依赖 |
|---|---|---|
| `/` | 首页（可导航即可；视觉另案） | 无硬性列表 API |
| `/prompts` | AI 提示词列表 | `category=prompt` |
| `/mcp` | MCP 列表 | `category=mcp` |
| `/skills` | Skills 列表 | `category=skills` |
| `/frontier` | AI 前沿（GH / PH 分区） | `category=frontier` + `source` |

无详情路由；条目点击使用 `url` 外链。

### 3.3 后端模块划分 **[提案]**

```text
server/
  http/          # node:http 路由与请求处理
  services/      # 列表查询、排序
  ingest/
    adapters/    # github、producthunt、（未来）prompts 等
    runner/      # 串行调度、限速、错误记录
  db/
    migrations/
```

原则：

- **读路径**与 **同步写路径** 分离模块，避免页面请求触发重型抓取。
- 每个外部来源一个 **Adapter**，输出统一领域条目；禁止在前端感知来源差异（除展示指标名：Star vs Upvote）。

---

## 4. 领域模型

### 4.1 核心概念

| 概念 | 含义 |
|---|---|
| Category（栏目） | `home` 不入库；`prompt` / `mcp` / `skills` / `frontier` |
| Source（来源） | `github` \| `producthunt` \|（未来品类来源枚举） |
| Item（条目） | 导航卡片的最小单位，对应 PRD §5 字段 |
| Tag（二级标签） | 主要用于 `frontier`；品类页可选 |
| SyncRun（同步运行） | 一次来源拉取任务的执行记录（运维可观测） |

### 4.2 统一条目模型 **[提案]**

产品字段 → 存储/API 字段建议：

| PRD 语义 | 字段名 | 类型语义 |
|---|---|---|
| 名称 | `title` | string |
| 简介 | `summary` | string |
| 链接 | `url` | string（绝对 URL） |
| 来源类型 | `source` | enum |
| 栏目 | `category` | enum |
| 热度指标 | `heat_value` + `heat_kind` | 整数 + `star`\|`upvote` |
| 时间（最新排序） | `source_time` | 来源侧时间；若无则用 `synced_at` 兜底策略需确认 |
| 二级标签 | `tags` | string[]（短枚举） |
| 去重键 | `external_id` | 来源内稳定 ID（如 GitHub `owner/repo`，PH slug） |

**热度规则（强制）**

- `heat_kind=star` 仅用于 GitHub；`upvote` 仅用于 Product Hunt。
- API/UI 不得把不同 `heat_kind` 混排进同一「按热度」列表。**[PRD]**
- AI 前沿两个分区 = 两次查询或一次查询后按 `source` 分组，禁止无 `source` 的混合热度排序。

### 4.3 品类与来源矩阵

| category | 允许 source（一期） | 备注 |
|---|---|---|
| `frontier` | `github`, `producthunt` | 必须分区展示 |
| `prompt` / `mcp` / `skills` | 待决；未定前无数据 | 空态合法 |

---

## 5. 数据架构（SQLite）

### 5.1 表设计 **[提案]**

**`items`**

| 列 | 说明 |
|---|---|
| `id` | 内部主键 |
| `category` | prompt / mcp / skills / frontier |
| `source` | github / producthunt / … |
| `external_id` | 来源稳定键；`UNIQUE(category, source, external_id)` |
| `title`, `summary`, `url` | 展示字段 |
| `heat_kind`, `heat_value` | 热度 |
| `source_time` | 可空；用于 latest 排序 |
| `synced_at` | 最近同步时间 |
| `status` | `active` / `hidden`（预留下架，一期可不暴露写 API） |

**`item_tags`**

| 列 | 说明 |
|---|---|
| `item_id` | FK |
| `tag` | 二级标签 |

**`sync_runs`**

| 列 | 说明 |
|---|---|
| `id`, `source`, `started_at`, `finished_at` | 运行窗口 |
| `status` | success / failed / partial |
| `stats_json` | 拉取条数、错误摘要等 |

Migration 放入 `src/rd/server/db/migrations/`；生产库文件不入库。**[冻结]**

### 5.2 索引建议 **[提案]**

- `(category, source, heat_value DESC)`
- `(category, source, source_time DESC)`
- `(category, source, external_id)` UNIQUE

### 5.3 数据量假设

一期为导航摘要，单表万级以内可接受；不做分库。列表分页在 SQL 层完成。

---

## 6. 同步（Ingest）架构

### 6.1 原则

- **串行**：同一时刻只跑一个同步任务（或全局一把锁），避免 2G2C 打满。**[提案，对齐项目串行文化]**
- **只存摘要**：标题、简介、指标、链接、标签；不存源站全文。**[PRD]**
- **失败可观测**：写入 `sync_runs`；单条失败不拖垮整次 run（partial）。
- **限速**：对外部站点保守间隔；遵守对方 ToS / robots 的产品与合规判断由负责人确认（见 §10）。

### 6.2 Adapter 合约 **[提案]**

每个 adapter 实现：

1. `fetchBatch(cursor) -> RawRecord[]`
2. `normalize(raw) -> ItemDraft`（映射到 §4.2）
3. `upsert(ItemDraft)`（按 `external_id` 更新热度与文案）

一期 adapter：

| Adapter | 用于 | 输入方式（提案） |
|---|---|---|
| `github` | frontier（及未来品类若同源） | **优先** GitHub 公开 API / 公开元数据接口获取 star、描述、html_url；避免对大量仓库 `git clone`（2G2C 不友好）。若产品坚持「下载」，限定为元数据或少量必要文件，不做全量仓库镜像。 |
| `producthunt` | frontier only | 公开网页抓取或官方/许可的数据访问方式；归一为 upvote + url |

> **待确认**：GitHub 侧采用「API 元数据」还是「git 下载」？PRD 口语为下载/抓取；架构默认 **API 元数据**，因资源与合规更可控。

### 6.3 调度 **[提案]**

推荐（二选一，需确认）：

- **A. 进程内定时器**：Node 启动后按固定间隔串行触发 ingest（实现简单，适合单机）。
- **B. 本机 cron + 内部触发 URL/CLI**：更易运维控制，需防未授权触发。

一期不引入独立 worker 进程。

同步 **不得** 由普通用户列表 API 同步触发（避免流量打爆）。

### 6.4 与品类待决的关系

`prompt` / `mcp` / `skills` 在来源选定前：

- 表结构与列表 API 先就绪；
- 无 adapter 注册则查询返回空列表 + 前端空态；
- 选定来源后只新增 adapter 与配置，不改 IA。

---

## 7. API 契约（草案）

> 以下为 **[提案]**，确认后冻结并写入 `DECISIONS.md`。一律 JSON；无鉴权。

### 7.1 列表

`GET /api/items`

| Query | 说明 |
|---|---|
| `category` | 必填：`prompt`\|`mcp`\|`skills`\|`frontier` |
| `source` | `frontier` 时必填：`github`\|`producthunt`；品类页可选 |
| `sort` | `heat`（默认）\|`latest` |
| `tag` | 可选，二级标签过滤 |
| `page` / `pageSize` | 分页；`pageSize` 上限需设硬顶（如 50） |

**响应（示意）**

```json
{
  "items": [
    {
      "id": "…",
      "category": "frontier",
      "source": "github",
      "title": "…",
      "summary": "…",
      "url": "https://github.com/…",
      "heatKind": "star",
      "heatValue": 1234,
      "sourceTime": "2026-08-20T00:00:00.000Z",
      "tags": ["llm"]
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 100
}
```

空列表：`items: []`，HTTP 200（品类未接入来源时的合法空态）。

### 7.2 同步可观测（可选一期）

`GET /api/sync/runs?source=github` — 最近运行状态（若担心暴露，可仅本地/运维网络访问）。**[待确认是否暴露]**

不提供公开「立即全量同步」接口给匿名用户。

### 7.3 明确不提供

- 详情 `GET /api/items/:id`（一期可不做；有也不作为产品详情页）
- 搜索、登录、收藏、投稿类 API

---

## 8. 前端架构要点

| 点 | 说明 |
|---|---|
| 栈 | Vue 3 + Vue Router + Pinia + Vite + Element Plus **[冻结]** |
| 数据 | Pinia 或页面级请求 `/api/items`；禁止读 SQLite |
| 前沿页 | 两个分区组件，分别请求 `source=github` 与 `source=producthunt` |
| 排序 | 切换 `sort=heat|latest` 重新请求 |
| 外链 | `target=_blank` + `rel="noopener noreferrer"`（实现细节，产品语义为跳出） |
| 首页 | 路由与导航壳先交付；视觉专项不阻塞列表链路 |
| 空态 | 品类无数据时展示可读空态，不隐藏导航 |

---

## 9. 部署与运行视图

```text
构建机（本地/CI）: 前端 build → 产物交付
线上 2G2C:
  Nginx → 静态产物
       → 反代 /api → Node :8082
  Node: 持有 SQLite（DB_PATH）、串行 ingest
  仅允许 npm ci --omit=dev；禁止线上完整 build  **[冻结]**
```

运维注意：

- SQLite 文件备份策略需运维侧约定（非本期功能，但上线前要有）。
- 同步日志避免刷盘过大。

---

## 10. 风险与合规

| 风险 | 影响 | 缓解（架构） |
|---|---|---|
| 外部站限流 / 页面结构变更 | 前沿数据中断 | Adapter 隔离；partial 成功；可观测 sync_runs |
| 抓取合规 | 法律/ToS | 来源准入由负责人确认；只存摘要；可下架 `hidden` |
| 2G2C 资源 | 同步拖垮 API | 全局串行锁、限速、低频率、禁止用户请求触发重抓 |
| Star/Upvote 混用 | 产品错误 | API 按 source 分查；前端分区 |
| 品类来源未定 | 三页长期空 | 空态合法；adapter 可插拔 |

---

## 11. 测试策略（架构落点）

| 层级 | 建议 |
|---|---|
| critical | 列表 API：按 category/source/sort 返回形态；空列表 200；热度 kind 不混用 |
| 单元 | adapter `normalize` 映射；排序 SQL/服务 |
| 禁止 | 前端测试直连 DB |

目录：`src/qa/critical/` 等，遵循现有 `make verify`。**[冻结]**

---

## 12. 待确认清单（阻断实现前）

请负责人确认后，再将结论写入 `DECISIONS.md`：

1. **GitHub 接入方式**：公开 API 元数据（推荐）vs git 下载/镜像？
2. **Product Hunt 接入方式**：许可范围内的具体手段（架构只要求 Adapter 可替换）。
3. **同步调度**：进程内定时（A）vs cron 触发（B）？
4. **`source_time` 缺失时**，「最新」排序是否允许回退 `synced_at`？
5. **是否对外暴露** `GET /api/sync/runs`？
6. **品类来源**：仍待产品选定（PRD §9）；架构保持可插拔。
7. **二级标签枚举**：可先空表，上线前是否必须有一版？
8. **列表默认 pageSize / 上限、同步频率**的产品数字（若验收需要）。

---

## 13. 建议落地顺序

1. Migration：`items` / `item_tags` / `sync_runs`
2. `GET /api/items` + 空数据 critical 测试
3. 前端五栏路由 + 列表/空态/分区
4. `github` adapter + 串行 runner（frontier）
5. `producthunt` adapter（frontier）
6. 标签过滤与排序打磨
7. 品类来源确定后加 adapter

---

## 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-20 | 基于一期 PRD 与项目冻结约束输出架构草案 |
