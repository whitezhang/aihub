#!/bin/bash
# 编排：静态 Client + Node API。禁止 git clean（保留 SQLite 等运行时数据）。
# 用法：bash src/op/deploy.sh [production]
# 默认 production；本地测试用 npm start + src/op/conf/test.env，不走本脚本。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export AIHUB_SRC="${AIHUB_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
export WEB="${WEB:-/www/wwwroot/ai.jsoner.cn}"
SKIP_SERVER="${SKIP_SERVER:-0}"
SKIP_CLIENT="${SKIP_CLIENT:-0}"
DEPLOY_ENV="${1:-production}"

if [[ "$DEPLOY_ENV" != "production" ]]; then
  echo "error: server deploy only supports 'production' (got: $DEPLOY_ENV)"
  echo "  local test: npm start — loads src/op/conf/test.env"
  exit 1
fi

echo "==> [deploy] env=$DEPLOY_ENV sync $AIHUB_SRC"
cd "$AIHUB_SRC"
git fetch --all
# 禁止 git clean：保留 SQLite 等运行时数据；conf/*.env 随仓库更新。
git reset --hard origin/main

bash "$SCRIPT_DIR/ensure-env.sh" production

if [[ "$SKIP_CLIENT" != "1" ]]; then
  bash "$SCRIPT_DIR/deploy-client.sh"
fi
if [[ "$SKIP_SERVER" != "1" ]]; then
  bash "$SCRIPT_DIR/deploy-server.sh"
fi
echo "Deploy done (env=production)."
