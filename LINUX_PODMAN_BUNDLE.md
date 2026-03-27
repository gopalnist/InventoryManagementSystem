# Inventory Management System — Linux Podman bundle

This bundle runs **PostgreSQL (reports DB)**, **report-service** (port 8005), and **frontend** (port 3001) using pre-built container images.

## Portable to another machine

The tarball is **not tied to one PC**: copy `ims-linux-podman-bundle-*.tar.gz` (USB, `scp`, artifact storage), extract on the target host, then `docker load` / `podman load` and `compose up`. Images use plain names (`ims-frontend:latest`, `ims-report-service:latest`), so **no private registry and no `localhost/...` registry pull** on the new machine.

**CPU architecture must match.** Images built on one architecture (e.g. `linux/amd64`) run on hosts with that architecture. On a different arch (e.g. ARM Graviton vs Intel server), rebuild the bundle on that arch or use a cross-platform build (`buildx` / `--platform`) when creating the images.

## Prerequisites (Linux)

- [Podman](https://podman.io/) 4.x+ and `podman-compose` **or** Docker Engine + Compose V2
- Ports **3001**, **8005**, **5433**, **5445** available (adjust in `docker-compose.podman-linux.yaml` if needed)

## Contents

| File | Purpose |
|------|---------|
| `ims-podman-images.tar` | Saved images: frontend, report-service, postgres:16-alpine |
| `docker-compose.podman-linux.yaml` | Stack definition (no source bind mounts) |
| `scripts/setup_reports_db.sql` | Initializes `ams_db` on first postgres-reports start |

## Install

1. Extract the archive:
   ```bash
   tar -xzf ims-linux-podman-bundle-*.tar.gz
   cd ims-linux-podman-bundle-*/
   ```

2. Load images:
   ```bash
   podman load -i ims-podman-images.tar
   ```
   (With Docker: `docker load -i ims-podman-images.tar`)

3. Confirm tags — bundle expects **`ims-frontend:latest`** and **`ims-report-service:latest`** (not `localhost/...`).
   If you still have old images named `localhost/inventorymanagementsystem_*`, retag:
   ```bash
   docker tag localhost/inventorymanagementsystem_frontend:latest ims-frontend:latest
   docker tag localhost/inventorymanagementsystem_report-service:latest ims-report-service:latest
   ```
   Or rebuild the bundle with `scripts/build-linux-podman-bundle.sh` after `podman compose build`.

4. Start the stack **from this directory** (so `./scripts/...` resolves):
   ```bash
   podman compose -f docker-compose.podman-linux.yaml up -d
   ```
   Or: `docker compose -f docker-compose.podman-linux.yaml up -d`

5. Wait for health (~30s), then verify:
   - Frontend: http://localhost:3001  
   - Report API docs: http://localhost:8005/docs  

## Troubleshooting

### `Error Get "http://localhost/v2/": ... connection refused`

Compose was resolving **`localhost/someimage`** as a **container registry** on port 80. This project’s Linux compose uses **`ims-frontend:latest`** and **`ims-report-service:latest`** instead. Update `docker-compose.podman-linux.yaml` from the latest repo, reload images (or re-tag as above), and run `docker compose ... up -d` again.

If you use the **main** `docker-compose.yml` only with `image: localhost/...` and no local registry, either run a registry on localhost or switch to **`build:`** / retagged image names.

## Notes

- **Architecture**: Run `./scripts/build-linux-podman-bundle.sh` from the repo root to build and pack **`linux/amd64`** images (default `PLATFORM=linux/amd64`), suitable for typical Intel/AMD Linux servers. Override with `PLATFORM=linux/arm64 ./scripts/build-linux-podman-bundle.sh` for ARM servers. Set `BUILD_NO_CACHE=1` for a clean rebuild.
- **Fresh DB**: Remove the `postgres_reports_data` volume if you need to re-run `setup_reports_db.sql` from scratch.
- **Master service / IMS DB**: This bundle does not include `master-service`; only the reports stack. Use the main `docker-compose.yml` from the full repository for the complete app.
