from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.monitor import MonitorCreate, MonitorUpdate, MonitorOut
from app.services import monitor_service
from app.services.scheduler import schedule_monitor, unschedule_monitor

router = APIRouter(prefix="/api/monitors", tags=["monitors"])


@router.get("/", response_model=list[MonitorOut])
async def list_monitors(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await monitor_service.get_monitors_for_user(db, current_user.id)


@router.post("/", response_model=MonitorOut, status_code=201)
async def create_monitor(
    monitor_in: MonitorCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    monitor = await monitor_service.create_monitor(db, current_user.id, monitor_in)
    # Register with scheduler immediately
    schedule_monitor(monitor.id, monitor.url, monitor.interval_minutes)
    return monitor


@router.get("/{monitor_id}", response_model=MonitorOut)
async def get_monitor(
    monitor_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    monitor = await monitor_service.get_monitor(db, monitor_id, current_user.id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return monitor


@router.patch("/{monitor_id}", response_model=MonitorOut)
async def update_monitor(
    monitor_id: int,
    update_in: MonitorUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    monitor = await monitor_service.get_monitor(db, monitor_id, current_user.id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    monitor = await monitor_service.update_monitor(db, monitor, update_in)
    # Re-schedule if interval or active status changed
    if monitor.is_active:
        schedule_monitor(monitor.id, monitor.url, monitor.interval_minutes)
    else:
        unschedule_monitor(monitor.id)
    return monitor


@router.delete("/{monitor_id}", status_code=204)
async def delete_monitor(
    monitor_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    monitor = await monitor_service.get_monitor(db, monitor_id, current_user.id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    unschedule_monitor(monitor.id)
    await monitor_service.delete_monitor(db, monitor)
