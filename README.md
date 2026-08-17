# Budget App

A paper-and-envelope themed zero-based envelope budgeting web application with **Flask** (both containers), **SQLite**, and **vanilla JS** — fully self-contained, **no nginx/gunicorn**, and deployable as two independent containers.

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

- **Backend container** — Flask, API-only. No HTML or static files. Reads/writes SQLite from a mounted `./data` volume.
- **Frontend container** — Flask. Serves the static HTML/CSS/JS and reverse-proxies `/api/*` to the backend over the Docker network (via `requests`).

> Both containers run **pure Python** (Flask's built-in server). No nginx, no gunicorn — minimal and self-contained.

Because the frontend proxies `/api`, the browser talks to a **single origin** — so the page's `fetch('/api/...')` calls work unchanged with **no CORS** setup.

---

## Features

- **Zero-Based Budgeting:** Total Net Worth, Total Allocated, and Unassigned Dollars in real time.
- **Account Management:** Add, rename, and manage accounts.
- **Envelopes & Allocations:** goals tied to accounts, amounts, target dates, progress bars, filtering by account; deleting an allocation returns funds to Unassigned.
- **Transactions & Overspend Protection:** expenses, income, and transfers with automated balance recalc; filters for description/account/allocation/type; overspend warnings.
- **Reallocate Funds:** shift dollars between allocations or the unassigned pool.
- **Card ⇄ list views** for Allocations and Accounts.
- **Light & Dark** "paper & envelopes" themes with a sliding toggle (persisted in `localStorage`).

---

## Project Structure

```
Budget/
├── docker-compose.yml        # two-service orchestration
├── README.md
├── .gitignore
│
├── backend/
│   ├── Dockerfile            # backend image (python:3.11-slim)
│   ├── requirements.txt      # Flask only
│   ├── app.py                # Flask API (no HTML)
│   └── data/                 # SQLite budget.db (lives beside its service)
│
├── frontend/
│   ├── Dockerfile            # frontend image (python:3.11-slim)
│   ├── requirements.txt      # Flask + requests
│   ├── app.py                # static server + /api reverse-proxy
│   └── app/                  # index.html + static/ served by Flask
│
└── backups/                  # snapshots for rollback
```

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
