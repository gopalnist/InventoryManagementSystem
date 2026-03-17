# How to Run the Application (UI + Servers)

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend services)
- **PostgreSQL** (for report service and optional master/inventory DBs)

---

## 1. Database (Reports)

Create a database and run the full setup script:

```bash
# Example: create DB and run setup (adjust user/password/db name as needed)
psql -U postgres -c "CREATE DATABASE ams_db;"
psql -U postgres -d ams_db -f scripts/setup_reports_db.sql
```

Or use your existing DB and run only:

```bash
psql "postgresql://USER:PASSWORD@HOST:PORT/DATABASE" -f scripts/setup_reports_db.sql
```

Set env vars for the report service (or use a `.env` in project root):

```bash
export DB_HOST=localhost
export DB_PORT=5441
export DB_NAME=ams_db
export DB_USER=postgres
export DB_PASSWORD=mypassword
```

---

## 2. Report Service (port 8005) – required for Reports / Main Dashboard

From the **project root** (so `shared` module is found):

```bash
cd /path/to/InventoryManagementSystem
export PYTHONPATH="${PWD}"

# Optional: set DB env if not using .env
export DB_HOST=localhost DB_PORT=5441 DB_NAME=ams_db DB_USER=postgres DB_PASSWORD=mypassword

python -m uvicorn services.report-service.app.main:app --host 0.0.0.0 --port 8005 --reload
```

Or with a venv:

```bash
cd /path/to/InventoryManagementSystem
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install fastapi uvicorn pandas openpyxl psycopg2-binary pydantic-settings

export PYTHONPATH="${PWD}"
python -m uvicorn services.report-service.app.main:app --host 0.0.0.0 --port 8005 --reload
```

---

## 3. Master Service (port 8001) – required for IMS (Products, Parties, etc.)

From the **project root**:

```bash
export PYTHONPATH="${PWD}"
python -m uvicorn services.master-service.app.main:app --host 0.0.0.0 --port 8001 --reload
```

(Ensure Master Service DB is created and migrated; see README or `services/master-service/app/db/`.)

---

## 4. Frontend (UI) – port 3001

```bash
cd frontend
npm install
npm run dev
```

Then open: **http://localhost:3001**

The Vite dev server proxies API calls to:

- `http://localhost:8005` – Report service (`/api/v1/reports`)
- `http://localhost:8001` – Master service (other `/api` routes)
- Ports 8002, 8003, 8004 for Sales, AMS, Inventory if you run those services.

---

## 5. Docker (optional)

Run **all** `docker compose` commands from the **project root**. The compose file uses `Dockerfile.report-service` and `Dockerfile.frontend` in the project root so the build works on any machine.

```bash
cd /path/to/InventoryManagementSystem
docker compose build report-service frontend
docker compose up -d
```

---

## Running on a different machine

1. **Get the code** (clone or pull latest):
   ```bash
   git clone <repo-url> InventoryManagementSystem
   cd InventoryManagementSystem
   # or: cd InventoryManagementSystem && git pull
   ```

2. **Use a normal folder** – not inside Trash or a path with special characters.

3. **Always run from the project root** (the directory that contains `docker-compose.yml`):
   ```bash
   cd /path/to/InventoryManagementSystem
   docker compose up -d --build
   ```

4. **If build fails with "Dockerfile not found"** – ensure you have the latest code. The repo should contain these files at the **root** (next to `docker-compose.yml`):
   - `Dockerfile.report-service`
   - `Dockerfile.frontend`
   If they are missing, pull the latest changes or copy them from the repo.

---

## Quick summary

| What              | Command (from project root) |
|-------------------|-----------------------------|
| **Report service** | `PYTHONPATH=${PWD} python -m uvicorn services.report-service.app.main:app --host 0.0.0.0 --port 8005 --reload` |
| **Master service** | `PYTHONPATH=${PWD} python -m uvicorn services.master-service.app.main:app --host 0.0.0.0 --port 8001 --reload` |
| **Frontend (UI)**  | `cd frontend && npm install && npm run dev` → http://localhost:3001 |

Run the Report Service + Frontend for **Reports and Main Dashboard**. Add Master Service (and its DB) for full IMS (Products, Parties, etc.).
