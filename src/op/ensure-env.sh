#!/bin/bash
# 校验 src/op/conf/<env>.env（权威配置；systemd 直接读 production.env）。
# 用法：ensure-env.sh production | test
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AIHUB_SRC="${AIHUB_SRC:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_NAME="${1:-}"

if [[ -z "$ENV_NAME" ]]; then
  echo "usage: $0 production|test"
  exit 1
fi
if [[ "$ENV_NAME" != "production" && "$ENV_NAME" != "test" ]]; then
  echo "error: env must be production or test (got: $ENV_NAME)"
  exit 1
fi

CONF="$AIHUB_SRC/src/op/conf/${ENV_NAME}.env"
EXAMPLE="$AIHUB_SRC/src/op/conf/${ENV_NAME}.env.example"

if [[ ! -f "$CONF" ]]; then
  echo "error: missing $CONF"
  echo "  copy: cp $EXAMPLE $CONF"
  echo "  then fill PRODUCTHUNT_* (and production DB_PATH)"
  exit 1
fi

env_get() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$CONF" | tail -n1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi
  echo "${line#*=}"
}

require_nonempty() {
  local key="$1"
  local val
  val="$(env_get "$key")"
  if [[ -z "$val" ]]; then
    echo "error: $CONF missing or empty: $key"
    exit 1
  fi
}

echo "==> [env] using $CONF"

if [[ "$ENV_NAME" == "production" ]]; then
  require_nonempty AIHUB_ENV
  require_nonempty PORT
  require_nonempty DB_PATH
  if [[ "$(env_get AIHUB_ENV)" != "production" ]]; then
    echo "error: production conf must set AIHUB_ENV=production"
    exit 1
  fi
  if [[ "$(env_get DB_PATH)" == *local.sqlite* ]]; then
    echo "error: production DB_PATH must not be local.sqlite"
    exit 1
  fi
else
  require_nonempty AIHUB_ENV
  if [[ "$(env_get AIHUB_ENV)" == "production" ]]; then
    echo "error: test conf must not set AIHUB_ENV=production"
    exit 1
  fi
fi

ph_token="$(env_get PRODUCTHUNT_API_TOKEN)"
ph_key="$(env_get PRODUCTHUNT_API_KEY)"
ph_secret="$(env_get PRODUCTHUNT_API_SECRET)"
if [[ -z "$ph_token" && ( -z "$ph_key" || -z "$ph_secret" ) ]]; then
  echo "error: $CONF needs PRODUCTHUNT_API_TOKEN or PRODUCTHUNT_API_KEY+PRODUCTHUNT_API_SECRET"
  exit 1
fi

echo "==> [env] ok ($ENV_NAME)"
