# AiHub

## Project Overview

AiHub 是 AI 编程导航站：记录 AI 领域热点项目、资讯与事件，并呈现一些好玩的 AI 项目。

**Stack**

- 前端：Vue 3 + Vue Router + Pinia + Vite；UI 为 Element Plus；做题编辑器用 Monaco
- 后端：单进程 Node（≥22，ESM，`node:http`），不使用 Express
- 数据：SQLite（`node:sqlite`）
- 评测：本机串行 `spawn` g++ / Python，不并行
- 部署：Nginx 托管静态资源；`/api` 反代本机 API（线上端口 `8082`）；服务器 2G2C，构建在本地完成；线上仅允许轻量 `npm ci --omit=dev`，禁止线上重编译/完整 build

## Commands

| Target | 作用 | 命令 |
|--------|------|------|
| `make verify` | 日常快速验证 | lint + typecheck + test-critical |
| `make verify-full` | 合并前完整验证 | lint + typecheck + test-full |
| `make lint` | 静态检查 | `npm run lint` |
| `make typecheck` | 类型检查 | `npm run typecheck` |
| `make test-critical` | 关键路径测试 | `npx vitest run src/qa/critical` |
| `make test-full` | 全量测试 | `npx vitest run` |

## Architecture

```
docs/                 # 文档
src/
  op/                 # 部署脚本与运维相关
  rd/                 # 研发代码（前端 + Node API）
    server/
      db/
        migrations/   # SQLite schema / migration
        # 本地库文件由 DB_PATH 指定，勿提交生产库
  qa/                 # 测试代码
    critical/         # test-critical 用例目录
```

- **前端**：UI、路由、Pinia、调用 `/api`；禁止直连 SQLite
- **后端（Node API）**：业务逻辑、SQLite 访问、串行评测；不托管静态主站（由 Nginx）
- **Nginx**：静态托管 + `/api` → `127.0.0.1:8082`
- **SQLite**：仅后端经 `node:sqlite` 访问；路径由环境变量 `DB_PATH` 控制；本地默认建议 `src/rd/server/db/local.sqlite`（gitignore）

## Constraints

1. 过程中有不明确处必须与负责人确认，不得擅自主张；尤其是领域设计相关决策。
2. 目录职责固定：`docs/` 文档；`src/op/` 部署；`src/rd/` 研发；`src/qa/` 测试。
3. 业务逻辑只在 Node API；前端禁止直连数据库。
4. SQLite 仅后端访问；migration 在 `src/rd/server/db/migrations/`；生产库文件不入库。
5. 评测必须本机串行，禁止并行 spawn；线上不做完整前端 build，仅可 `npm ci --omit=dev`。
