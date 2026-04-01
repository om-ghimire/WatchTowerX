import time
import httpx
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.check_result import CheckResult
from app.models.monitor import Monitor
from app.services.monitor_service import update_monitor_status
from app.services.alert_service import maybe_send_alerts


TIMEOUT_SECONDS = 10
MAX_REDIRECTS = 5


async def ping_url(url: str) -> dict:
    """
    Perform an HTTP GET on the given URL.
    Returns a dict with: is_up, status_code, response_time_ms, error.
    """
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(
            timeout=TIMEOUT_SECONDS,
            follow_redirects=True,
            max_redirects=MAX_REDIRECTS,
        ) as client:
            response = await client.get(url)
            elapsed_ms = (time.monotonic() - start) * 1000
            is_up = response.status_code < 500
            return {
                "is_up": is_up,
                "status_code": response.status_code,
                "response_time_ms": round(elapsed_ms, 2),
                "error": None,
            }
    except httpx.TimeoutException:
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "is_up": False,
            "status_code": None,
            "response_time_ms": round(elapsed_ms, 2),
            "error": "Request timed out",
        }
    except httpx.RequestError as e:
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "is_up": False,
            "status_code": None,
            "response_time_ms": round(elapsed_ms, 2),
            "error": str(e)[:512],
        }


async def run_check(db: AsyncSession, monitor_id: int, url: str) -> CheckResult:
    """
    Ping a URL, save the result, update monitor status, and fire alerts if needed.
    """
    # Capture previous status for recovery detection
    result = await db.execute(select(Monitor).where(Monitor.id == monitor_id))
    monitor = result.scalar_one_or_none()
    was_up = monitor.is_up if monitor else None

    result_data = await ping_url(url)

    check = CheckResult(
        monitor_id=monitor_id,
        is_up=result_data["is_up"],
        status_code=result_data["status_code"],
        response_time_ms=result_data["response_time_ms"],
        error=result_data["error"],
        checked_at=datetime.utcnow(),
    )
    db.add(check)
    await update_monitor_status(db, monitor_id, result_data["is_up"])
    await db.commit()

    # Fire alerts (errors are logged, never raised)
    if monitor:
        await maybe_send_alerts(
            db=db,
            monitor_id=monitor_id,
            monitor_name=monitor.name,
            monitor_url=url,
            is_up=result_data["is_up"],
            was_up=was_up,
            status_code=result_data["status_code"],
            error=result_data["error"],
            response_time_ms=result_data["response_time_ms"],
        )

    return check
