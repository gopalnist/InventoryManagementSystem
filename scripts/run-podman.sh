#!/usr/bin/env bash
# Run the stack with Podman (same as Docker). Uses docker-compose.yml.
# Run from repo root: ./scripts/run-podman.sh [up -d | down | build ...]
# Example: ./scripts/run-podman.sh up -d --build

set -e
cd "$(dirname "$0")/.."

if ! command -v podman &>/dev/null; then
  echo "podman not found. Install Podman or use Docker (docker compose ...)."
  exit 1
fi

if podman compose version &>/dev/null; then
  podman compose "$@"
else
  echo "Using podman-compose (pip install podman-compose if missing)."
  podman-compose -f docker-compose.yml "$@"
fi
