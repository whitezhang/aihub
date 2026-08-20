#!/bin/bash
# 编排：静态 Client + Node API。禁止 git clean（保留 SQLite 与 .env）。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export AIHUB_SRC="${AIHUB_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
export WEB="${WEB:-/www/wwwroot/ai.jsoner.cn}"
SKIP_SERVER="${SKIP_SERVER:-0}"
SKIP_CLIENT="${SKIP_CLIENT:-0}"

echo "==> [deploy] sync $AIHUB_SRC"
cd "$AIHUB_SRC"
git fetch --all
# 禁止 git clean：runtime（SQLite）与本机 .env 都是仓外数据。
git reset --hard origin/main

if [[ "$SKIP_CLIENT" != "1" ]]; then
  bash "$SCRIPT_DIR/deploy-client.sh"
fi
if [[ "$SKIP_SERVER" != "1" ]]; then
  bash "$SCRIPT_DIR/deploy-server.sh"
fi
echo "Deploy done."
