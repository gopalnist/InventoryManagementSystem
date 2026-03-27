#!/usr/bin/env bash
# Build ims-deploy-bundle.tar.gz for Linux amd64 (Docker/Podman load + compose).
# Run from repository root, or: ./scripts/build-linux-podman-bundle.sh
#
# - Always builds --no-cache (clean export every time)
# - Removes any existing tar.gz before creating the new one
# - Default PLATFORM=linux/amd64
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PLATFORM="${PLATFORM:-linux/amd64}"
OUT="${ROOT}/ims-deploy-bundle.tar.gz"
TMP="${TMPDIR:-/tmp}/ims-deploy-bundle"

echo "=== Clean build for ${PLATFORM} ==="

# Remove existing bundle if present
if [[ -f "$OUT" ]]; then
  echo "Removing existing $OUT ..."
  rm -f "$OUT"
fi
rm -rf "$TMP"
mkdir -p "$TMP/scripts"

echo "Building report-service for ${PLATFORM} (no cache)..."
podman build --platform "${PLATFORM}" --no-cache \
  -f "${ROOT}/Dockerfile.report-service" \
  -t ims-report-service:latest \
  "${ROOT}"

echo "Building frontend for ${PLATFORM} (no cache)..."
podman build --platform "${PLATFORM}" --no-cache \
  -f "${ROOT}/Dockerfile.frontend" \
  -t ims-frontend:latest \
  "${ROOT}"

echo "Pulling postgres:16-alpine for ${PLATFORM}..."
podman pull --platform "${PLATFORM}" docker.io/library/postgres:16-alpine

echo "Saving images to tar..."
podman save -m -o "$TMP/ims-images.tar" \
  ims-frontend:latest \
  ims-report-service:latest \
  docker.io/library/postgres:16-alpine

cp docker-compose.yml "$TMP/"
cp scripts/setup_reports_db.sql "$TMP/scripts/"

( cd "$(dirname "$TMP")" && tar -czf "$OUT" "$(basename "$TMP")" )
rm -rf "$TMP"

echo ""
echo "=== Done ==="
echo "Bundle: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Platform: ${PLATFORM}"
echo ""
echo "On target Linux machine:"
echo "  tar -xzf ims-deploy-bundle.tar.gz"
echo "  cd ims-deploy-bundle/"
echo "  docker load -i ims-images.tar"
echo "  docker tag localhost/ims-frontend:latest ims-frontend:latest"
echo "  docker tag localhost/ims-report-service:latest ims-report-service:latest"
echo "  docker compose up -d"
