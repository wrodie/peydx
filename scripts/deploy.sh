#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version>" >> /var/log/peydx-deploy.log 2>/dev/null
  exit 1
fi

VERSION="$1"
PROJECT_DIR="/opt/peydx"
LOG_FILE="/var/log/peydx-deploy.log"

exec >> "$LOG_FILE" 2>&1
echo "[$(date -Iseconds)] Deploy started: version=$VERSION"

cd "$PROJECT_DIR"

# Source .env for REGISTRY_URL and docker-compose env vars
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

REGISTRY_URL="${REGISTRY_URL:-localhost:5050}"
CLIENT_IMAGE="$REGISTRY_URL/sync-agent"

STATUS_FILE="/tmp/peydx-deploy-status"

report() {
  echo "$1" > "$STATUS_FILE"
}

trap 'report "done"' EXIT

report "checkout"

echo "Fetching tags..."
git fetch --tags

echo "Checking out $VERSION..."
git checkout "$VERSION"

report "building"

echo "Building client image $CLIENT_IMAGE:$VERSION..."
docker build \
  --build-arg VERSION="$VERSION" \
  -f "$PROJECT_DIR/sync/Dockerfile" \
  -t "$CLIENT_IMAGE:$VERSION" \
  -t "$CLIENT_IMAGE:latest" \
  "$PROJECT_DIR"

report "pushing"

echo "Pushing $CLIENT_IMAGE:$VERSION..."
docker push "$CLIENT_IMAGE:$VERSION"

echo "Pushing $CLIENT_IMAGE:latest..."
docker push "$CLIENT_IMAGE:latest"

report "rebuilding"

echo "Rebuilding server..."
COMPOSE_FLAGS="-f $PROJECT_DIR/docker-compose.yaml"
if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
  COMPOSE_FLAGS="$COMPOSE_FLAGS --profile cloudflared"
fi
docker compose $COMPOSE_FLAGS up -d --build

report "done"

echo "[$(date -Iseconds)] Deploy complete: version=$VERSION"
