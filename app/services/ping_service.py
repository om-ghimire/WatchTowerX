import time
import httpx
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.check_result import CheckResult
from app.services.monitor_service import update_monitor_status


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
    Ping a URL, save the result, and update the monitor's last known status.
    """
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
    return check
