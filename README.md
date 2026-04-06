# WatchTowerX 🔔

Website uptime & performance monitor — full-stack monorepo.

```
WatchTowerX/
├── app/                        # Python / FastAPI backend
│   ├── api/routes/             #   auth, monitors, results
│   ├── core/                   #   config, JWT security
│   ├── db/                     #   async SQLAlchemy session
│   ├── models/                 #   User, Monitor, CheckResult
│   ├── schemas/                #   Pydantic schemas
│   └── services/               #   ping engine, scheduler, CRUD
├── frontend/                   # React / Vite frontend
│   └── src/
│       ├── components/         #   ui, dashboard, monitors
│       ├── hooks/              #   useAutoRefresh
│       ├── lib/                #   axios client, auth context
│       └── pages/              #   Auth, Dashboard, Monitors, Incidents
├── tests/                      # Backend unit tests
├── docker-compose.yml          # All 4 services in one command
├── Dockerfile                  # Backend image
├── requirements.txt
└── .env.example
```

## Stack

| Layer      | Tech                              |
|------------|-----------------------------------|
| Backend    | Python 3.12 + FastAPI             |
| Database   | PostgreSQL 16 (asyncpg)           |
| Scheduler  | APScheduler                       |
| Cache      | Redis                             |
| Frontend   | React 18 + Vite                   |
| Charts     | Recharts                          |
| Auth       | JWT (python-jose + passlib)       |

## Quick Start

```bash
# 1. Configure environment
cp .env.example .env          # edit SECRET_KEY at minimum

# 2. Start everything
docker-compose up --build

# 3. Open in browser
# Dashboard  → http://localhost:5173
# API docs   → http://localhost:8000/docs
```

All 4 services start together: PostgreSQL, Redis, FastAPI backend, React frontend.

## Running without Docker

```bash
# Terminal 1 — Backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| POST   | /api/auth/register                | Create account           |
| POST   | /api/auth/login                   | Get JWT token            |
| GET    | /api/monitors/                    | List monitors            |
| POST   | /api/monitors/                    | Add monitor              |
| PATCH  | /api/monitors/{id}                | Update monitor           |
| DELETE | /api/monitors/{id}                | Remove monitor           |
| GET    | /api/monitors/{id}/results        | Check history            |
| GET    | /api/monitors/{id}/stats?hours=24 | Uptime % + response time |


