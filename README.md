# WatchTowerX 🔔

Website uptime & performance monitor — Phase 1 (Core Engine).

## Features (Phase 1)
- JWT auth (register / login)
- Add, update, delete monitored URLs
- Background ping scheduler (every 1, 3, or 5 minutes)
- Stores uptime status, HTTP status code, and response time
- Per-monitor stats: uptime %, avg/min/max response time
- Full check history per monitor

---

## Tech Stack
| Layer | Tech |
|---|---|
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL 16 (async via asyncpg) |
| ORM | SQLAlchemy 2.0 (async) |
| Scheduler | APScheduler 3 |
| Auth | JWT via python-jose + passlib |
| Cache | Redis (rate limiting, sessions) |
| HTTP checks | httpx (async) |

---

## Project Structure

```
WatchTowerX/
├── app/
│   ├── main.py                  # FastAPI app, lifespan hooks
│   ├── api/routes/
│   │   ├── auth.py              # POST /api/auth/register, /login
│   │   ├── monitors.py          # CRUD /api/monitors
│   │   └── results.py           # GET /api/monitors/{id}/results & /stats
│   ├── core/
│   │   ├── config.py            # Settings from .env
│   │   └── security.py          # JWT helpers, password hashing
│   ├── db/
│   │   └── session.py           # Async engine, Base, get_db
│   ├── models/
│   │   ├── user.py
│   │   ├── monitor.py
│   │   └── check_result.py
│   ├── schemas/                 # Pydantic request/response schemas
│   └── services/
│       ├── user_service.py
│       ├── monitor_service.py
│       ├── ping_service.py      # Core ping engine ← start here
│       └── scheduler.py        # APScheduler integration
├── tests/
│   └── test_ping_service.py
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

## Quick Start

### 1. Clone & configure
```bash
cp .env.example .env
# Edit .env — at minimum change SECRET_KEY
```

### 2. Start with Docker (recommended)
```bash
docker-compose up --build
```
API will be live at **http://localhost:8000**
Interactive docs at **http://localhost:8000/docs**

### 3. Or run locally (no Docker)

```bash
# Start PostgreSQL and Redis first, then:
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |

### Monitors
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/monitors/` | List all your monitors |
| POST | `/api/monitors/` | Add a new URL to monitor |
| GET | `/api/monitors/{id}` | Get one monitor |
| PATCH | `/api/monitors/{id}` | Update name / interval / active |
| DELETE | `/api/monitors/{id}` | Remove monitor |

### Results
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/monitors/{id}/results` | Check history (last 100) |
| GET | `/api/monitors/{id}/stats?hours=24` | Uptime % + response time stats |

---

## Example: Add a Monitor

```bash
# 1. Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "secret123"}'

# 2. Login
curl -X POST http://localhost:8000/api/auth/login \
  -F "username=you@example.com" -F "password=secret123"
# → { "access_token": "eyJ...", "token_type": "bearer" }

# 3. Add a monitor
curl -X POST http://localhost:8000/api/monitors/ \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"name": "My Site", "url": "https://example.com", "interval_minutes": 1}'

# 4. Check stats after a few minutes
curl http://localhost:8000/api/monitors/1/stats \
  -H "Authorization: Bearer eyJ..."
```

---

## Running Tests
```bash
pip install pytest pytest-asyncio
pytest tests/ -v
```

---

## Next: Phase 2 — React Dashboard
- Uptime status badges (green / red)
- Response time chart (Recharts)
- Incident history log
- Live refresh with React Query
