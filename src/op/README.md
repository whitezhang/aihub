# Ops

部署与 Nginx 配置放此目录（对齐 eduhub）。

## 本机开发

- **看网站（推荐）**：`npm run dev:web` → [http://127.0.0.1:5172/](http://127.0.0.1:5172/)（需同时 `npm run dev` 起 API）
- API 开发：`npm run dev`（默认 `127.0.0.1:8082`，`--watch`）
- API 启动/重启：`npm start` / `npm run restart`（先清端口再启动）
- 单端口预览：先 `npm run build`，再 `npm start`，打开 [http://127.0.0.1:8082/](http://127.0.0.1:8082/)（托管仓根 `output/`）

说明：`8082` 本质是 API；未 build 时访问 `/` 会看到说明页。`npm restart` **不会**启动前端开发服务。

## 数据隔离（本地 vs 线上）

- 本地默认：`AIHUB_ENV=local` → `src/rd/server/db/local.sqlite`
- 线上：`AIHUB_ENV=production` + **必须**设置独立 `DB_PATH`（禁止 `local.sqlite`）
- 参考 `.env.example`；前沿抓取设计见 `docs/ingest-frontier-design.md`

## 生产部署（ai.jsoner.cn）

| 项 | 路径 / 值 |
|---|---|
| git 工作树 | `/root/deployaihub` |
| Nginx 站点根 | `/www/wwwroot/ai.jsoner.cn/` |
| API 端口 | `8082`（blog 8080 / eduhub 8081） |
| systemd | `aihub-api.service` |
| 生产库 | `DB_PATH=/var/lib/aihub/prod.sqlite` |

### 首次上机

```bash
# 1) clone（目录名按约定）
git clone <repo-url> /root/deployaihub
cd /root/deployaihub

# 2) 生产 .env（含 PH 密钥等；不入库）
# systemd 已设 AIHUB_ENV/DB_PATH；.env 只放密钥与 ingest 覆盖
# 切勿在服务器 .env 写 AIHUB_ENV=local（EnvironmentFile 会覆盖 unit）
cp .env.example .env
# 编辑 PRODUCTHUNT_* / GITHUB_TOKEN 等；删掉或改正 AIHUB_ENV/DB_PATH

# 3) 建库目录
mkdir -p /var/lib/aihub
chown root:root /var/lib/aihub

# 4) systemd
cp src/op/aihub-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now aihub-api

# 5) nginx：把 nginx-api-snippet.conf 并入 ai.jsoner.cn 的 server {}
nginx -t && nginx -s reload
```

### 日常发布

本机：

```bash
npm run build
git add output && git commit -m "build: refresh client output" && git push
```

服务器：

```bash
cd /root/deployaihub
bash src/op/deploy.sh
# 仅静态：SKIP_SERVER=1 bash src/op/deploy.sh
# 仅 API： SKIP_CLIENT=1 bash src/op/deploy.sh
```

约束：`deploy.sh` 只 `git fetch` + `reset --hard`，**不要** `git clean`（保留 `.env` / 运行时数据）。服务器上只跑 `npm ci --omit=dev`，禁止完整前端 build。
