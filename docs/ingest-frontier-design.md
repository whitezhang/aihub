# AI 前沿抓取与历史数据设计

关联：[一期架构](architecture-phase1-aihub.md) · [一期 PRD](prd-phase1-aihub.md)

## 1. 目标

| 需求 | 方案摘要 |
|---|---|
| AI 前沿展示 GitHub / Product Hunt 热点 | 两源分开展示；列表读「最近一次成功日」快照 |
| 每天抓取一次 | 按业务时区自然日，每日窗口内首次成功即停 |
| 冷启动无数据 | 该源从未有过 `success` 时，启动/tick **立即抓一次**（不等 `DAILY_AT`） |
| 单次失败 10 分钟后再抓，直到当天成功 | 日状态机 + `next_retry_at` |
| 本地保存 180 天历史 | 按日快照表；成功写入后裁剪 `day < today-180` |
| 本地测试与线上数据不互相覆盖 | **强制分库**：`AIHUB_ENV` + 不同 `DB_PATH`，启动校验 |

## 2. 日状态机（每个 source 独立）

`source ∈ { github, producthunt }`，`day = YYYY-MM-DD`（时区默认 `Asia/Shanghai`，可用 `INGEST_TZ` 覆盖）。

```text
（到点 / 冷启动 / 启动补跑）
    │
    ▼
 该源从未 success（冷库）──► 立即执行（忽略 DAILY_AT）
    │
 no row for (source, day) ──► 创建 pending；非冷启动则等到 DAILY_AT 后执行
    │
 success ──► 当天不再抓
    │
 failed ──► next_retry_at = now+10min，到点再抓，直到 success 或跨日
```

规则：

1. **每天最多「逻辑成功」一次**：`status=success` 后当日不再调度。
2. **冷启动**：某 `source` 在库中不存在任何 `status=success` 时，进程 tick 不等待 `INGEST_DAILY_AT`，立即尝试抓取（失败仍按 10 分钟重试）。
3. **失败重试**：任意失败（网络、解析、0 条视为失败等）→ 记 `failed`，`next_retry_at = now + 10min`。
4. **串行**：全局一把锁；同时只跑一个 ingest（先 github 再 producthunt，或队列 FIFO）。
5. **跨日**：新 `day` 新行；昨日失败不延续到今日（今日重新 pending）。
6. **进程重启**：根据 DB 中的 `status` / `next_retry_at` 恢复，不依赖内存。有历史成功数据时，仍遵守 `DAILY_AT`（启动时若已过点且当日未成功则补跑）。

首次尝试时刻（非冷启动）：`INGEST_DAILY_AT`（默认 `08:00`，该时区）。若进程在 08:00 之后启动且当日尚未 success，立即补跑。

## 3. 数据模型

### 3.1 为何单独快照，而不是只 upsert `items`

- 「180 天历史」需要保留**每日榜单**，不能被次日 upsert 覆盖掉。
- 展示仍要快：读最新成功日即可。

### 3.2 表

**`frontier_days`**

| 列 | 含义 |
|---|---|
| `source` | github / producthunt |
| `day` | 业务日 YYYY-MM-DD |
| `status` | pending / running / success / failed |
| `attempt_count` | 当日已尝试次数 |
| `last_attempt_at` | 上次尝试 |
| `next_retry_at` | 下次允许尝试（success 时清空） |
| `error` | 最近错误摘要 |
| `UNIQUE(source, day)` | |

**`frontier_day_items`**

| 列 | 含义 |
|---|---|
| `day_id` | FK → frontier_days |
| `rank` | 当日榜单名次 |
| `external_id`, `title`, `summary`, `url` | |
| `heat_kind`, `heat_value`, `source_time` | |
| `tags_json` | 二级标签 JSON 数组 |
| `UNIQUE(day_id, external_id)` | |

成功写入策略：同一 `(source, day)` **先删旧日条目再插入**（保证重试成功时榜单一致），再标 `success`。

**`items` 表**：成功后**同步投影**最新成功日到 `items`（`category=frontier`），兼容现有 `GET /api/items`；历史以快照为准。

### 3.3 保留 180 天

每次任意 source 成功后（或每日调度末尾）：

```sql
DELETE FROM frontier_days WHERE day < date(today, '-180 days');
-- 依赖 FK ON DELETE CASCADE 清 frontier_day_items
```

## 4. 列表读路径

`GET /api/items?category=frontier&source=github|producthunt`：

1. 取该 source **最近 `status=success` 的 day**（通常为今天或昨天）。
2. 返回该日 `frontier_day_items`（排序已由 rank / heat 写入时确定；`sort=heat|latest` 仍可在快照内排）。
3. 若无任何成功日 → 空列表（前端空态）。

可选后续：`?day=YYYY-MM-DD` 读历史（本期可不做 UI）。

## 5. 抓取 Adapter

| 源 | 方式 | 说明 |
|---|---|---|
| GitHub | 抓取 [github.com/trending](https://github.com/trending) HTML | 解析 `article.Box-row`；热度优先用「stars today」 |
| Product Hunt | 官方 GraphQL（`PRODUCTHUNT_API_KEY`+`SECRET` 或 `TOKEN`），按 `VOTES` 取真实 `votesCount` | 不再用 Feed 伪造 upvote |

条数：默认每源每日最多 **30** 条（`INGEST_LIMIT`）。

「热点」工作定义（可配置，默认）：

- GitHub：AI 相关检索（如 topic/关键词 llm、artificial-intelligence 等）按 stars 排序。
- Product Hunt：当日/近期热门中与 AI 相关的帖子（按 upvote）；具体过滤随 API 能力调整。

## 6. 本地 vs 线上：防覆盖

| 机制 | 做法 |
|---|---|
| 分库 | 数据只写当前进程的 `DB_PATH`；历史与日状态都在该库内 |
| 环境 | `AIHUB_ENV=local`（默认）\| `production` |
| 本地默认库 | `src/rd/server/db/local.sqlite`（gitignore） |
| 线上 | **必须**显式设置 `DB_PATH`（如 `/var/lib/aihub/prod.sqlite`），禁止落在仓库内 `local.sqlite` |
| 启动校验 | production + 路径含 `local.sqlite` → **拒绝启动**；local 误指常见线上目录 → **拒绝启动** |
| 测试 | Vitest 使用系统临时目录独立 sqlite；`INGEST_ENABLED=0` 默认关调度 |
| 禁止 | 不要把线上库文件拷进仓库；不要用同一 `DB_PATH` 同时跑本地与线上 |

```text
本地开发 ── DB_PATH=.../local.sqlite     ── 独立 180 天历史
线上服务 ── DB_PATH=/var/lib/aihub/….sqlite ── 独立 180 天历史
测试进程 ── os.tmpdir()/aihub-*.sqlite   ── 用完即删
```

三者**无共享文件**即无覆盖冲突。

## 7. 进程内调度（选定方案 A）

- `INGEST_ENABLED=1`（production 默认开；local 默认开但可关）。
- 定时器约每 60s tick 一次，检查两源是否该跑。
- 与 HTTP 同进程；tick 内若上锁则跳过。

## 8. 配置一览

| 变量 | 默认 | 含义 |
|---|---|---|
| `AIHUB_ENV` | `local` | local / production |
| `DB_PATH` | 见上 | sqlite 文件 |
| `INGEST_ENABLED` | local/prod 皆 `1`；测试 `0` | 是否调度 |
| `INGEST_TZ` | `Asia/Shanghai` | 业务日时区 |
| `INGEST_DAILY_AT` | `08:00` | 每日首次尝试 |
| `INGEST_RETRY_MINUTES` | `10` | 失败重试间隔 |
| `INGEST_RETENTION_DAYS` | `180` | 历史保留 |
| `INGEST_LIMIT` | `30` | 每源每日条数 |
| `GITHUB_TOKEN` | 空 | 已不再用于 trending 页面抓取（保留无关） |
| `PRODUCTHUNT_API_TOKEN` | 空 | 已改为抓首页，不再依赖 Token |

## 9. 风险

- PH 无 Token 会当日多次重试至成功或跨日——属预期，需在部署配置 Token。
- GitHub API 限流：有 Token 更稳；限流记 failed + 10 分钟重试。
- 2G2C：串行 + 限条数，避免并行抓取。
