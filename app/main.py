import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.session import init_db
from app.services.scheduler import start_scheduler, stop_scheduler
from app.api.routes import auth, monitors, results
from app.api.routes import alert_channels, status_pages
from app.api.routes import status_page_components, incidents, maintenance
from app.api.routes import groups

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="WatchTowerX API",
    description="Website uptime & performance monitoring",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(monitors.router)
app.include_router(results.router)
app.include_router(alert_channels.router)
app.include_router(status_pages.router)
app.include_router(status_page_components.router)
app.include_router(incidents.router)
app.include_router(maintenance.router)
app.include_router(groups.router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "WatchTowerX"}
