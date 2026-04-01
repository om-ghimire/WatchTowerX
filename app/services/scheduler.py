import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.db.session import AsyncSessionLocal
from app.services.ping_service import run_check
from app.services.monitor_service import get_all_active_monitors, interval_seconds_for_monitor

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def make_job_id(monitor_id: int) -> str:
    return f"monitor_{monitor_id}"


async def _check_monitor(monitor_id: int):
    async with AsyncSessionLocal() as db:
        try:
            result = await run_check(db, monitor_id)
            status = "UP" if result.is_up else "DOWN"
            logger.info(
                f"[monitor {monitor_id}] {result.monitor_url} → {status} "
                f"({result.response_time_ms}ms, HTTP {result.status_code})"
            )
        except Exception as e:
            logger.error(f"[monitor {monitor_id}] check failed: {e}")


def schedule_monitor(monitor_id: int, interval_seconds: int):
    """Add or replace a monitor's scheduled job."""
    job_id = make_job_id(monitor_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    scheduler.add_job(
        _check_monitor,
        trigger=IntervalTrigger(seconds=max(interval_seconds, 10)),
        args=[monitor_id],
        id=job_id,
        replace_existing=True,
        max_instances=1,
    )
    logger.info(f"Scheduled monitor {monitor_id} every {interval_seconds}s")


def unschedule_monitor(monitor_id: int):
    """Remove a monitor's scheduled job."""
    job_id = make_job_id(monitor_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"Unscheduled monitor {monitor_id}")


async def load_all_monitors():
    """On startup, load all active monitors from DB and schedule them."""
    async with AsyncSessionLocal() as db:
        monitors = await get_all_active_monitors(db)
        for m in monitors:
            schedule_monitor(m.id, interval_seconds_for_monitor(m))
    logger.info(f"Loaded {len(monitors)} monitors from DB")


def start_scheduler():
    scheduler.start()
    asyncio.ensure_future(load_all_monitors())
    logger.info("Scheduler started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
