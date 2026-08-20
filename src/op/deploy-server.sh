#!/bin/bash
# Server：npm ci --omit=dev + systemctl restart。禁止线上完整前端 build。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AIHUB_SRC="${AIHUB_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
API_SERVICE="${API_SERVICE:-aihub-api}"
API_PORT="${API_PORT:-8082}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${API_PORT}/api/health}"

echo "==> [server] npm ci"
cd "$AIHUB_SRC"
if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found (need Node >= 22)"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm not found"
  exit 1
fi
npm ci --omit=dev

if ! command -v systemctl >/dev/null 2>&1; then
  echo "error: systemctl not found"
  exit 1
fi
if ! systemctl cat "$API_SERVICE" &>/dev/null; then
  echo "error: systemd unit $API_SERVICE 未安装。在服务器执行一次："
  echo "  cp $AIHUB_SRC/src/op/aihub-api.service /etc/systemd/system/"
  echo "  systemctl daemon-reload && systemctl enable --now $API_SERVICE"
  echo "  nginx 增加 /api/ 反代，见 $AIHUB_SRC/src/op/nginx-api-snippet.conf"
  exit 1
fi

echo "==> [server] restart $API_SERVICE"
systemctl restart "$API_SERVICE"
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "$HEALTH_URL" >/dev/null; then
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" -ne 1 ]]; then
  echo "error: health check failed"
  systemctl --no-pager --full status "$API_SERVICE" || true
  exit 1
fi
echo "==> [server] done"
