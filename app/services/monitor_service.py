from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.monitor import Monitor
from app.schemas.monitor import MonitorCreate, MonitorUpdate


def _url_for_monitor_type(monitor_type: str, target: str) -> str:
    if monitor_type == "https":
        return target if target.startswith("https://") else f"https://{target}"
    if monitor_type == "http":
        return target if target.startswith("http://") else f"http://{target}"
    return target


def interval_seconds_for_monitor(monitor: Monitor) -> int:
    check_settings = monitor.check_settings or {}
    interval_seconds = int(check_settings.get("interval_seconds") or (monitor.interval_minutes * 60))
    return max(interval_seconds, 10)


def _normalize_payload(monitor_in: MonitorCreate | MonitorUpdate) -> dict:
    payload = monitor_in.model_dump(exclude_unset=True)

    if "name" in payload and isinstance(payload["name"], str):
        payload["name"] = payload["name"].strip()
    if "target" in payload and isinstance(payload["target"], str):
        payload["target"] = payload["target"].strip()

    if "monitor_type" in payload and "target" in payload:
        payload["url"] = _url_for_monitor_type(payload["monitor_type"], payload["target"])
    elif "monitor_type" in payload:
        payload["url"] = _url_for_monitor_type(payload["monitor_type"], payload.get("target", ""))
    elif "target" in payload:
        # Keep existing protocol semantics for updates that change target only.
        payload["url"] = payload["target"]

    if "check_settings" in payload:
        interval_seconds = int(payload["check_settings"].get("interval_seconds") or 60)
        payload["interval_minutes"] = max(1, round(interval_seconds / 60))

    return payload


async def get_monitors_for_user(db: AsyncSession, user_id: int) -> list[Monitor]:
    result = await db.execute(
        select(Monitor).where(Monitor.user_id == user_id).order_by(Monitor.created_at.desc())
    )
    return result.scalars().all()


async def get_monitor(db: AsyncSession, monitor_id: int, user_id: int) -> Optional[Monitor]:
    result = await db.execute(
        select(Monitor).where(Monitor.id == monitor_id, Monitor.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_all_active_monitors(db: AsyncSession) -> list[Monitor]:
    """Used by the scheduler to fetch all active monitors."""
    result = await db.execute(select(Monitor).where(Monitor.is_active == True))  # noqa: E712
    return result.scalars().all()


async def create_monitor(db: AsyncSession, user_id: int, monitor_in: MonitorCreate) -> Monitor:
    payload = _normalize_payload(monitor_in)
    monitor = Monitor(
        user_id=user_id,
        name=payload["name"],
        monitor_type=payload["monitor_type"],
        target=payload["target"],
        port=payload.get("port"),
        url=payload.get("url") or payload["target"],
        interval_minutes=payload.get("interval_minutes", 1),
        request_config=payload.get("request_config", {}),
        retry_config=payload.get("retry_config", {}),
        notification_config=payload.get("notification_config", {}),
        check_settings=payload.get("check_settings", {}),
        advanced_config=payload.get("advanced_config", {}),
        organization_config=payload.get("organization_config", {}),
    )
    db.add(monitor)
    await db.flush()
    await db.refresh(monitor)
    return monitor


async def update_monitor(
    db: AsyncSession, monitor: Monitor, update_in: MonitorUpdate
) -> Monitor:
    payload = _normalize_payload(update_in)
    if "monitor_type" in payload and "target" not in payload:
        payload["url"] = _url_for_monitor_type(payload["monitor_type"], monitor.target)
    if "target" in payload and "monitor_type" not in payload:
        payload["url"] = _url_for_monitor_type(monitor.monitor_type, payload["target"])
    for field, value in payload.items():
        setattr(monitor, field, value)
    await db.flush()
    await db.refresh(monitor)
    return monitor


async def delete_monitor(db: AsyncSession, monitor: Monitor) -> None:
    await db.delete(monitor)
    await db.flush()


async def update_monitor_status(
    db: AsyncSession, monitor_id: int, is_up: bool
) -> None:
    result = await db.execute(select(Monitor).where(Monitor.id == monitor_id))
    monitor = result.scalar_one_or_none()
    if monitor:
        monitor.is_up = is_up
        monitor.last_checked_at = datetime.utcnow()
        await db.flush()
