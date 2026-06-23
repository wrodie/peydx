#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version>" >> /var/log/peydx-update.log
  exit 1
fi

VERSION="$1"
ENV_FILE="/opt/peydx/.env"
COMPOSE_FILE="/opt/peydx/docker-compose.client.yaml"
LOG_FILE="/var/log/peydx-update.log"

exec >> "$LOG_FILE" 2>&1
echo "[$(date -Iseconds)] Update requested: version=$VERSION"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $COMPOSE_FILE not found"
  exit 1
fi

sed -i "s/^CLIENT_VERSION=.*/CLIENT_VERSION=$VERSION/" "$ENV_FILE"
echo "Updated CLIENT_VERSION to $VERSION in $ENV_FILE"

echo "Pulling $VERSION..."
if ! docker compose -f "$COMPOSE_FILE" pull sync-agent; then
  echo "ERROR: docker compose pull failed. Existing container NOT restarted."
  exit 1
fi

echo "Stopping old sync-agent..."
docker compose -f "$COMPOSE_FILE" stop sync-agent || true
sleep 2

echo "Starting new sync-agent..."
docker compose -f "$COMPOSE_FILE" up -d sync-agent
echo "Update complete: sync-agent now running $VERSION"
