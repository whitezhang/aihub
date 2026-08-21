# Decisions

记录架构、数据、API、部署等已确认决策。每条包含：日期、背景、决策、后果。

---

## 2026-08-20 — 生产部署路径与脚本（对齐 eduhub）

- **背景**：需在服务器发布 AiHub，路径与 eduhub/blog 错开。
- **决策**：
  1. git 工作树：`/root/deploy/aihub`；Nginx 站点根：`/www/wwwroot/ai.jsoner.cn/`；API：`8082`。
  2. 部署脚本：`src/op/deploy.sh` / `deploy-client.sh` / `deploy-server.sh`；systemd：`aihub-api.service`；nginx 片段：`nginx-api-snippet.conf`。
  3. 前端本机 `npm run build` → 仓根 `output/` 提交；服务器只 rsync + `npm ci --omit=dev`，禁止线上 Vite build；`deploy` 不做 `git clean`。
  4. 生产 `DB_PATH=/var/lib/aihub/prod.sqlite`；密钥用仓根 `.env`（`EnvironmentFile`），不入库。
- **后果**：发布流程与 eduhub 同形；端口与站点与 blog/eduhub 隔离。

## 2026-08-21 — 测试/生产配置放入 src/op/conf，部署绑定 production

- **背景**：PH 等密钥靠人工改仓根 `.env` 不标准；需一眼区分测试与生产，且不另开 `/var/lib/.../env` 路径；本地测试不挂 nginx。
- **决策**：
  1. 权威配置：`src/op/conf/test.env`（本地）与 `src/op/conf/production.env`（生产）；模板 `*.env.example` 与真实 `*.env` 均入库（remote 为 private）。
  2. 本地：`npm start` / `dev` 加载 `test.env`；不部署测试站、不挂 nginx。
  3. 线上：`bash src/op/deploy.sh`（默认 production）；`ensure-env.sh` 只校验 PH / `AIHUB_ENV` / `DB_PATH`；systemd `EnvironmentFile` 直接指向 `src/op/conf/production.env`。
  4. 废弃仓根 `.env` / `.env.example`，避免与 `conf/` 双源。
- **后果**：`git pull` / `deploy` 即可带上生产凭证；仓库权限等同密钥权限，协作者需可信。

## Template

```markdown
## YYYY-MM-DD — 标题

- **背景**：
- **决策**：
- **后果**：
```

---

## 2026-08-20 — Harness 初始化与核心边界

- **背景**：为 AiHub 建立 Harness Engineering 基础设施，并冻结前后端、SQLite、测试与部署边界。
- **决策**：
  1. 业务逻辑仅在 Node API；前端禁止直连数据库。
  2. SQLite migration 目录为 `src/rd/server/db/migrations/`；库路径由 `DB_PATH` 控制；本地默认建议 `src/rd/server/db/local.sqlite`（不入库）。
  3. 线上部署采用方案 B：允许 `npm ci --omit=dev`，禁止线上完整 build / 重编译。
  4. `test-critical` = `npm run test:critical`；`test-full` = `npm test`。
  5. 目录：`docs/` 文档；`src/op/` 部署；`src/rd/` 研发；`src/qa/` 测试。
- **后果**：后续实现与 Agent 改动须遵守上述边界；领域设计仍须一事一议确认。

## 2026-08-20 — 一期导航架构默认落地

- **背景**：PRD / 架构草案已齐，开始实现前需冻结目录与 API/数据默认提案。
- **决策**：
  1. 前端代码置于 `src/rd/web/`，后端置于 `src/rd/server/`。
  2. 列表 API：`GET /api/items`（`category` / `source` / `sort=heat|latest` / `tag` / 分页）；`frontier` 必须带 `source`。
  3. SQLite 表：`items`、`item_tags`、`sync_runs`；热度用 `heat_kind`（`star`|`upvote`）+ `heat_value`，不设综合热度分。
  4. 「最新」排序：`COALESCE(source_time, synced_at)`。
  5. GitHub 同步默认走公开 API 元数据（不做全量 clone）；Product Hunt / 品类来源 adapter 后续接入；同步与读路径模块分离、串行限速（ingest 后续迭代）。
- **后果**：研发按上述目录与契约实现；品类来源站点仍待产品确认。

## 2026-08-20 — 热点按日筛选与热度趋势

- **背景**：AI 前沿需按月/日查看历史榜单，并在条目右侧展示热度变化趋势（参考热点榜 UI）。
- **决策**：
  1. `GET /api/items` 对 `frontier` 支持 `day=YYYY-MM-DD`；响应带 `day`、`availableDays`、条目 `rank` 与 `trend[]`（截至所选日最近 14 个成功日的真实 heat）。
  2. 趋势粒度为**天**（与现有日快照一致）；不做按小时（无小时数据）。
  3. 前端热点页提供月份/日期筛选与右侧 sparkline。
- **后果**：历史越积趋势越完整；仅一日数据时曲线点很少属预期。

- **背景**：需每日抓取 GitHub / Product Hunt 热点，失败 10 分钟重试至当日成功，保留 180 天历史，且本地与线上数据不得互相覆盖。
- **决策**：
  1. 按 `INGEST_TZ`（默认 Asia/Shanghai）自然日；每源每日成功一次即停；失败则 `+INGEST_RETRY_MINUTES`（默认 10）重试。
  2. **冷启动**：该源库内无任何成功快照时，启动即抓（不等 `INGEST_DAILY_AT`）。
  3. 历史用 `frontier_days` + `frontier_day_items` 日快照；成功后投影到 `items`；保留 `INGEST_RETENTION_DAYS`（默认 180）天并级联删除。
  4. 进程内串行调度（方案 A）；列表读该源最近成功日快照。
  5. `AIHUB_ENV` + `DB_PATH` 强制分库：production 禁止 `local.sqlite`；测试用临时库且默认关闭 ingest。
  6. GitHub 抓取 `https://github.com/trending`；Product Hunt 用官方 GraphQL（API Key/Secret 或 Developer Token）拉取真实 `votesCount`，禁止伪造 upvote。
- **后果**：实现见 `docs/ingest-frontier-design.md`；密钥仅放环境变量 / `.env`（不入库）；聊天或日志中暴露过的密钥应轮换。
