#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Deploy IMS on any machine — one command, no source code needed.
#
# Prerequisites: Docker installed, internet access to ghcr.io
#
# First time:   ./deploy.sh setup
# Update:       ./deploy.sh update
# Status:       ./deploy.sh status
# Stop:         ./deploy.sh stop
# Logs:         ./deploy.sh logs
# =============================================================================

GHCR_USER="${GHCR_USER:-gopalnist}"
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/ims-deploy}"
COMPOSE_FILE="docker-compose.prod.yml"
REPO_RAW="https://raw.githubusercontent.com/${GHCR_USER}/InventoryManagementSystem/main"

print_header() {
    echo ""
    echo "============================================="
    echo "  IMS Deploy — $1"
    echo "============================================="
    echo ""
}

cmd_setup() {
    print_header "First-time Setup"

    mkdir -p "$DEPLOY_DIR/scripts"
    cd "$DEPLOY_DIR"

    echo "[1/4] Downloading compose file and DB init script..."
    curl -sfL "${REPO_RAW}/docker-compose.prod.yml" -o docker-compose.prod.yml
    curl -sfL "${REPO_RAW}/scripts/setup_reports_db.sql" -o scripts/setup_reports_db.sql
    echo "  Downloaded."

    echo ""
    echo "[2/4] Logging in to GitHub Container Registry..."
    echo "  You need a GitHub Personal Access Token (classic) with 'read:packages' scope."
    echo "  Create one at: https://github.com/settings/tokens/new"
    echo ""
    read -rp "  GitHub username [$GHCR_USER]: " input_user
    GHCR_USER="${input_user:-$GHCR_USER}"
    read -rsp "  GitHub PAT (hidden): " ghcr_token
    echo ""
    echo "$ghcr_token" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
    echo "  Logged in to ghcr.io."

    echo ""
    echo "[3/4] Pulling Docker images..."
    docker compose -f "$COMPOSE_FILE" pull
    echo "  Images pulled."

    echo ""
    echo "[4/4] Starting all services..."
    docker compose -f "$COMPOSE_FILE" up -d
    sleep 5

    print_header "Setup Complete"
    echo "  Frontend:       http://localhost:3001"
    echo "  Report Service: http://localhost:8005/docs"
    echo "  Postgres:       localhost:5433 / localhost:5445"
    echo ""
    echo "  Watchtower is running — it will auto-pull new images"
    echo "  every 2 minutes. Just push code to GitHub and wait!"
    echo ""
    echo "  Useful commands:"
    echo "    cd $DEPLOY_DIR"
    echo "    ./deploy.sh update   # manually pull latest"
    echo "    ./deploy.sh status   # check containers"
    echo "    ./deploy.sh logs     # view logs"
    echo "    ./deploy.sh stop     # stop everything"
    echo "============================================="
}

cmd_update() {
    print_header "Updating to Latest"
    cd "$DEPLOY_DIR"
    docker compose -f "$COMPOSE_FILE" pull
    docker compose -f "$COMPOSE_FILE" up -d
    docker image prune -f
    echo ""
    echo "  Updated and running."
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

cmd_status() {
    print_header "Status"
    cd "$DEPLOY_DIR"
    docker compose -f "$COMPOSE_FILE" ps
}

cmd_logs() {
    cd "$DEPLOY_DIR"
    docker compose -f "$COMPOSE_FILE" logs -f --tail=50
}

cmd_stop() {
    print_header "Stopping"
    cd "$DEPLOY_DIR"
    docker compose -f "$COMPOSE_FILE" down
    echo "  All containers stopped."
}

# ---- Main ----
case "${1:-help}" in
    setup)  cmd_setup ;;
    update) cmd_update ;;
    status) cmd_status ;;
    logs)   cmd_logs ;;
    stop)   cmd_stop ;;
    *)
        echo "Usage: $0 {setup|update|status|logs|stop}"
        echo ""
        echo "  setup   First-time setup (download, login, pull, start)"
        echo "  update  Pull latest images and restart"
        echo "  status  Show running containers"
        echo "  logs    Tail container logs"
        echo "  stop    Stop all containers"
        ;;
esac
