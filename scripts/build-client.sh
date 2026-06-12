#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 v1.2.0"
  exit 1
fi

VERSION="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source .env if it exists (for REGISTRY_URL override)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

REGISTRY_URL="${REGISTRY_URL:-localhost:5050}"
IMAGE="$REGISTRY_URL/sync-agent"

echo "Building sync-agent:$VERSION from $PROJECT_DIR..."
docker build \
  --build-arg VERSION="$VERSION" \
  -f "$PROJECT_DIR/sync/Dockerfile" \
  -t "$IMAGE:$VERSION" \
  -t "$IMAGE:latest" \
  "$PROJECT_DIR"

echo "Pushing $IMAGE:$VERSION..."
docker push "$IMAGE:$VERSION"

echo "Pushing $IMAGE:latest..."
docker push "$IMAGE:latest"

echo "Done. Image $IMAGE:$VERSION and $IMAGE:latest pushed to $REGISTRY_URL"
