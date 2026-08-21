# Ops

部署与 Nginx 配置放此目录（对齐 eduhub）。

## 环境配置（`src/op/conf/`）

| 文件 | 用途 |
|---|---|
| `conf/test.env.example` | 本地模板 |
| `conf/production.env.example` | 生产模板 |
| `conf/test.env` | 本地真实配置（入库）→ `npm start` / `npm run dev` |
| `conf/production.env` | 生产真实配置（入库）→ `deploy.sh`（默认 production） |

```bash
# 首次若还没有真实文件
cp src/op/conf/test.env.example src/op/conf/test.env
cp src/op/conf/production.env.example src/op/conf/production.env
# 编辑 PRODUCTHUNT_*；production 还须 DB_PATH=/var/lib/aihub/prod.sqlite
```

本地不挂 nginx：用测试配置直接起 API。生产部署：`bash src/op/deploy.sh`（默认 production），校验 `production.env`；systemd 直接读该文件。

## 本机开发

- **看网站（推荐）**：`npm run dev:web` → [http://127.0.0.1:5172/](http://127.0.0.1:5172/)（需同时 `npm run dev` 起 API）
- API 开发：`npm run dev`（默认 `127.0.0.1:8082`，`--watch`）
- API 启动/重启：`npm start` / `npm run restart`（先清端口再启动）
- 单端口预览：先 `npm run build`，再 `npm start`，打开 [http://127.0.0.1:8082/](http://127.0.0.1:8082/)（托管仓根 `output/`）

说明：`8082` 本质是 API；未 build 时访问 `/` 会看到说明页。`npm restart` **不会**启动前端开发服务。

## 数据隔离（本地 vs 线上）

- 本地：`src/op/conf/test.env` → `AIHUB_ENV=local` → 默认 `src/rd/server/db/local.sqlite`
- 线上：`src/op/conf/production.env` → `AIHUB_ENV=production` + `DB_PATH=/var/lib/aihub/prod.sqlite`
- 前沿抓取设计见 `docs/ingest-frontier-design.md`

## 生产部署（ai.jsoner.cn）

| 项 | 路径 / 值 |
|---|---|
| git 工作树 | `/root/deploy/aihub` |
| Nginx 站点根 | `/www/wwwroot/ai.jsoner.cn/` |
| API 端口 | `8082`（blog 8080 / eduhub 8081） |
| systemd | `aihub-api.service` |
| 生产库 | `DB_PATH=/var/lib/aihub/prod.sqlite` |
| 生产配置 | `src/op/conf/production.env`（systemd EnvironmentFile） |

### 首次上机

```bash
# 1) clone（目录名按约定）
git clone <repo-url> /root/deploy/aihub
cd /root/deploy/aihub

# 2) 生产配置已在仓内 src/op/conf/production.env（private 仓库入库）
#    若缺失：cp src/op/conf/production.env.example src/op/conf/production.env 并填密钥
#    不要写 AIHUB_ENV=local

# 3) 建库目录
mkdir -p /var/lib/aihub
chown root:root /var/lib/aihub

# 4) systemd
cp src/op/aihub-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now aihub-api

# 5) nginx：把 nginx-api-snippet.conf 并入 ai.jsoner.cn 的 server {}
nginx -t && nginx -s reload

# 6) 首次完整发布（含 ensure-env）
bash src/op/deploy.sh
```

### 日常发布

本机：

```bash
npm run build
git add output && git commit -m "build: refresh client output" && git push
```

服务器：

```bash
cd /root/deploy/aihub
bash src/op/deploy.sh
# 仅静态：SKIP_SERVER=1 bash src/op/deploy.sh
# 仅 API： SKIP_CLIENT=1 bash src/op/deploy.sh
```

约束：`deploy.sh` 只 `git fetch` + `reset --hard`，**不要** `git clean`（保留运行时 SQLite 等）。服务器上只跑 `npm ci --omit=dev`，禁止完整前端 build。缺 PH 凭证或 `AIHUB_ENV≠production` 时 deploy 会失败。
