import logging
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.alert_channel import AlertChannel
from app.models.check_result import CheckResult

logger = logging.getLogger(__name__)


async def send_teams_alert(webhook_url: str, monitor_name: str, monitor_url: str, error: str | None, status_code: int | None, response_time_ms: float | None):
    """Send an Adaptive Card alert to a Teams (or compatible) webhook."""
    status_text = f"HTTP {status_code}" if status_code else (error or "No response")
    color = "FF4D6A"

    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": color,
        "summary": f"🔴 {monitor_name} is DOWN",
        "sections": [{
            "activityTitle": f"🔴 **{monitor_name}** is DOWN",
            "activitySubtitle": monitor_url,
            "facts": [
                {"name": "Status",        "value": status_text},
                {"name": "Response time", "value": f"{round(response_time_ms, 1)}ms" if response_time_ms else "n/a"},
                {"name": "Error",         "value": error or "—"},
            ],
            "markdown": True,
        }],
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json=payload)
            resp.raise_for_status()
            logger.info(f"Alert sent to Teams webhook for {monitor_name}")
    except Exception as e:
        logger.error(f"Failed to send Teams alert for {monitor_name}: {e}")


async def send_recovery_alert(webhook_url: str, monitor_name: str, monitor_url: str, response_time_ms: float | None):
    """Send a recovery (back UP) notification."""
    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "00F5A0",
        "summary": f"✅ {monitor_name} recovered",
        "sections": [{
            "activityTitle": f"✅ **{monitor_name}** is back UP",
            "activitySubtitle": monitor_url,
            "facts": [
                {"name": "Response time", "value": f"{round(response_time_ms, 1)}ms" if response_time_ms else "n/a"},
            ],
            "markdown": True,
        }],
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json=payload)
            resp.raise_for_status()
            logger.info(f"Recovery alert sent for {monitor_name}")
    except Exception as e:
        logger.error(f"Failed to send recovery alert for {monitor_name}: {e}")


async def get_consecutive_failures(db: AsyncSession, monitor_id: int, n: int) -> int:
    """Count how many of the last N results are failures (to support retry logic)."""
    result = await db.execute(
        select(CheckResult)
        .where(CheckResult.monitor_id == monitor_id)
        .order_by(CheckResult.checked_at.desc())
        .limit(n)
    )
    results = result.scalars().all()
    count = 0
    for r in results:
        if not r.is_up:
            count += 1
        else:
            break
    return count


async def maybe_send_alerts(
    db: AsyncSession,
    monitor_id: int,
    monitor_name: str,
    monitor_url: str,
    is_up: bool,
    was_up: bool | None,
    status_code: int | None,
    error: str | None,
    response_time_ms: float | None,
):
    """
    Check all active alert channels for this monitor and fire if conditions are met.
    - immediate: fire on first failure
    - retry_count N: fire only after N consecutive failures
    Also sends recovery alert when site comes back up.
    """
    result = await db.execute(
        select(AlertChannel).where(
            AlertChannel.monitor_id == monitor_id,
            AlertChannel.is_active == True,  # noqa
        )
    )
    channels = result.scalars().all()
    if not channels:
        return

    if not is_up:
        consecutive = await get_consecutive_failures(db, monitor_id, 10)
        for ch in channels:
            should_alert = False
            if ch.alert_on_immediate and consecutive == 1:
                should_alert = True
            elif not ch.alert_on_immediate and consecutive == ch.retry_count:
                should_alert = True

            if should_alert:
                await send_teams_alert(
                    ch.webhook_url, monitor_name, monitor_url,
                    error, status_code, response_time_ms
                )
    elif is_up and was_up is False:
        # Recovery — was down, now up
        for ch in channels:
            await send_recovery_alert(ch.webhook_url, monitor_name, monitor_url, response_time_ms)
