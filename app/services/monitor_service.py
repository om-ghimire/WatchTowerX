from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.monitor import Monitor
from app.schemas.monitor import MonitorCreate, MonitorUpdate


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
    monitor = Monitor(
        user_id=user_id,
        name=monitor_in.name,
        url=str(monitor_in.url),
        interval_minutes=monitor_in.interval_minutes,
    )
    db.add(monitor)
    await db.flush()
    await db.refresh(monitor)
    return monitor


async def update_monitor(
    db: AsyncSession, monitor: Monitor, update_in: MonitorUpdate
) -> Monitor:
    for field, value in update_in.model_dump(exclude_unset=True).items():
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
