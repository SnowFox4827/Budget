# Budget App

A paper-and-envelope themed zero-based envelope budgeting web application with **Flask** (both containers), **SQLite**, and **vanilla JS (ES Modules)** — fully modular, self-contained, **no nginx/gunicorn**, and deployable as two independent containers.

---

## Architecture

The app is split into two containers:

```
                 ┌──────────────────────────────┐
 browser ──►     │  frontend (flask)  :80        │
                 │  · serves HTML/CSS/JS         │
                 │  · proxies /api/* ────────────┼──►  backend (flask) :5000
                 └──────────────────────────────┘     · /api/* endpoints
                                                      · SQLite in /app/data
```

- **Backend container** — Flask, API-only with modular blueprints and an application factory. Reads/writes SQLite from a mounted `./data` volume.
- **Frontend container** — Flask. Serves static HTML/CSS/ES Modules and reverse-proxies `/api/*` to the backend over the Docker network (via `requests`).

> Both containers run **pure Python** (Flask's built-in server). No nginx, no gunicorn — minimal, modular, and self-contained.

Because the frontend proxies `/api`, the browser talks to a **single origin** — so the page's `fetch('/api/...')` calls work seamlessly with **no CORS** setup.

---

## Features

- **Zero-Based Budgeting:** Total Net Worth, Total Allocated, and Unassigned Dollars in real time.
- **Account Management:** Add, rename, and manage accounts with both card and tabular views.
- **Envelopes & Allocations:** Goals tied to accounts, target amounts, target dates, progress bars, and filtering by account. Deleting an allocation returns funds to Unassigned Dollars.
- **Transactions & Overspend Protection:** Expenses, income, and transfers with automated balance recalculation and overspend shortfall resolution.
- **Reallocate Funds:** Shift dollars between allocations or the unassigned pool.
- **Compound Interest Calculator:** Dedicated "CI Calculator" tab with principal, rate, time, and compounding frequency; typeable interest rate, optional monthly contributions, compounding frequency, and instant math with final amount and interest earned, plus a year-by-year growth curve chart (Chart.js).
- **Mortgage Calculator:** Dedicated "Mortgage" tab with home value, down payment (auto-syncing $ / % ), loan term, interest rate, property tax, insurance, and HOA. Shows a monthly-payment and full-loan "adds up" breakdown, an "Affordability (25% rule)" check against your take-home pay, and Balance / Breakdown / Amortization views with a Chart.js balance-over-time curve.
- **Card ⇄ List Views** for Allocations and Accounts.
- **Light & Dark** "paper & envelopes" themes with a sliding toggle (persisted in `localStorage`).
- **Modular Codebase:** Decoupled backend blueprints and componentized ES frontend modules.

---

## Project Structure

```text
Budget/
├── docker-compose.yml        # Multi-service stack (backend, frontend, backup)
├── .env.example              # Sample environment configuration template
├── .env                      # Active environment variables (git-ignored)
├── Dockerfile.backup         # Lightweight Alpine backup sidecar
├── README.md
├── .gitignore
│
├── backend/
│   ├── Dockerfile            # backend image (python:3.11-slim)
│   ├── requirements.txt      # Flask
│   ├── app.py                # Server entry point (calls create_app)
│   ├── app/
│   │   ├── __init__.py       # Application factory & blueprint registration
│   │   ├── db.py             # SQLite connection & schema initialization
│   │   └── routes/           # Modular Flask Blueprints
│   │       ├── __init__.py
│   │       ├── accounts.py   # Account management endpoints
│   │       ├── allocations.py# Envelope allocation & transfer endpoints
│   │       ├── dashboard.py  # Summary, health check & metrics endpoints
│   │       ├── transactions.py# Transaction CRUD, overspend & reversal logic
│   │       └── backup.py     # Database backup & JSON export endpoints
│   └── data/                 # SQLite budget.db persistence volume
│
└── frontend/
    ├── Dockerfile            # frontend image (python:3.11-slim)
    ├── requirements.txt      # Flask + requests
    ├── app.py                # static server + /api reverse-proxy
    └── app/
        ├── index.html        # Single-page app UI shell
        └── static/
            ├── css/
            │   └── styles.css
            └── js/
                ├── api.js    # API communication client
                ├── main.js   # Main entry point & event wiring
                ├── modals.js # Modal & tab helpers
                ├── state.js  # Global state & SVG icons
                ├── theme.js  # Light/dark mode manager
                └── components/
                    ├── accounts.js     # Account cards & table views
                    ├── allocations.js  # Envelope cards, bars & transfers
                    ├── summary.js      # Cash summary & badge indicators
                    ├── transactions.js # Transaction log & filter logic
                    ├── backup.js       # Backup status & download handlers
                    ├── ci-calculator.js      # Compound interest calculator component
                    └── mortgage-calculator.js# Mortgage & affordability calculator component
│
├── scripts/
│   └── backup.py             # Automated dual-format backup runner
└── backups/                  # Rolling snapshots (auto-created)
```

---

## Environment Variables (`.env`)

All host-specific settings (ports, storage directories, OpenMediaVault / NAS paths, backup intervals) are configured in a `.env` file:

```dotenv
# Port on your host machine / browser
HOST_PORT=8080

# Port for direct external API access (Home Assistant, scripts, Postman)
BACKEND_PORT=5000

# Database storage path on host
DATA_DIR=./backend/data

# Backup destination path on host (local folder or OpenMediaVault pool)
BACKUP_HOST_DIR=/srv/dev-disk-by-uuid-YOUR-UUID/Backups/Budget

# Automated backup interval in hours (e.g. 24 = once daily)
BACKUP_INTERVAL_HOURS=24

# Number of days to keep backup snapshots before automatic deletion
RETENTION_DAYS=30
```

Docker Compose reads this `.env` file automatically upon `docker compose up`.

---

## Automated Backups & OpenMediaVault (OMV) Setup

The application features an automated backup sidecar that creates **dual-format snapshots** (safe SQLite `.db` binary + structured `.json` data dump + SHA-256 checksums) with automatic rolling retention.

### Snapshot Output Structure
```text
backups/
├── latest.json                     # Live readable JSON copy
└── snapshot_YYYYMMDD_HHMMSS/
    ├── budget.db                   # Safe online SQLite snapshot
    ├── data_export.json            # Human-readable, corruption-proof JSON
    └── checksum.sha256             # SHA-256 integrity verification
```

### Direct OpenMediaVault (OMV) / NAS Mapping
In `docker-compose.yml`, map the `backup-sidecar` container's `/backups` volume directly to your OMV storage pool:

```yaml
  backup-sidecar:
    build:
      context: .
      dockerfile: Dockerfile.backup
    container_name: budget-backup
    environment:
      - DB_PATH=/app/data/budget.db
      - BACKUP_DIR=/backups
      - RETENTION_DAYS=30
      - BACKUP_INTERVAL_HOURS=24
    volumes:
      - ./backend/data:/app/data:ro
      # Replace with your OMV shared folder path:
      - /srv/dev-disk-by-uuid-YOUR-UUID/Backups/Budget:/backups
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
```

### Manual Backup & Export via UI
Click the **Backup** button in the top navigation bar to:
- **Download JSON Export:** Formatted `.json` file for spreadsheets, auditing, and portability.
- **Download SQLite Database:** Live point-in-time `.db` snapshot for full binary restoration.
- **Trigger Instant Snapshot:** Creates an on-demand snapshot directly into your backups volume / NAS drive.

---

## Running

### With Docker (recommended)

```bash
docker compose up -d --build
```

Then open **http://localhost:8080**.

- Frontend is published on host port **8080** → container port **80**.
- To change it, edit `ports` in `docker-compose.yml` (e.g. `"9000:80"`).
- The frontend container gets `BACKEND_URL=http://backend:5000` automatically from compose.

### Running the backend directly (dev)

```bash
cd backend
pip install -r requirements.txt
python app.py            # serves /api/* on :5000
```

### Running the frontend directly (dev)

```bash
cd frontend
pip install -r requirements.txt
BACKEND_URL=http://localhost:5000 python app.py   # serves page + proxies /api on :80
```

> NOTE: Both apps are pure Flask. The dashboard HTML is served by the frontend container; the API lives in the backend container. For a full local run the backend still requires its `data/` directory (auto-created) for the SQLite DB.

---

## Health check

- Backend exposes `GET /api/health` → `{"status":"ok"}`.
- Frontend exposes `GET /api/health` → `{"status":"ok-frontend"}` (independent of the backend).
- Compose waits for the backend to be healthy before starting the frontend.

---

## License

Personal Homelab Use
