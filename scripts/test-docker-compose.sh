#!/usr/bin/env bash
# Test Docker Compose: build, up, health-check report-service and frontend.
# Run from repo root: ./scripts/test-docker-compose.sh

set -e
cd "$(dirname "$0")/.."

echo "=== Building and starting services ==="
docker compose build report-service frontend
docker compose up -d postgres-reports report-service frontend

echo ""
echo "=== Waiting for report-service health (up to 45s) ==="
for i in $(seq 1 45); do
  if curl -sf http://localhost:8005/health >/dev/null 2>&1; then
    echo "report-service is healthy."
    break
  fi
  if [ "$i" -eq 45 ]; then
    echo "Timeout waiting for report-service. Logs:"
    docker compose logs report-service
    exit 1
  fi
  sleep 1
done

echo ""
echo "=== Waiting for frontend (up to 60s) ==="
for i in $(seq 1 60); do
  if curl -sf -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null | grep -q 200; then
    echo "frontend is responding."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timeout waiting for frontend. Logs:"
    docker compose logs frontend
    exit 1
  fi
  sleep 1
done

echo ""
echo "=== Report service health response ==="
curl -s http://localhost:8005/health | head -5

echo ""
echo "=== Report service main-dashboard (no auth header may 401/403; 200 = OK) ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Tenant-ID: 00000000-0000-0000-0000-000000000001" http://localhost:8005/api/v1/reports/main-dashboard 2>/dev/null || echo "000")
echo "HTTP $STATUS (200 = OK)"

echo ""
echo "=== Summary ==="
echo "  UI:        http://localhost:3001"
echo "  Reports:   http://localhost:8005/health"
echo "  Stop:      docker compose down"
