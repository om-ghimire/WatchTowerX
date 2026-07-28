from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_account_owner_id, get_current_user, require_roles
from app.models.user import User
from app.schemas.monitor import MonitorCreate, MonitorUpdate, MonitorOut
from app.services import monitor_service, group_service
from app.services.ping_service import run_check
from app.services.scheduler import schedule_monitor, unschedule_monitor

router = APIRouter(prefix="/api/monitors", tags=["monitors"])


@router.get("/", response_model=list[MonitorOut])
async def list_monitors(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await monitor_service.get_monitors_for_user(db, get_account_owner_id(current_user))


@router.post("/", response_model=MonitorOut, status_code=201)
async def create_monitor(
    monitor_in: MonitorCreate,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    if monitor_in.parent_group_id is not None:
        try:
            await group_service.validate_parent_assignment(db, account_owner_id, None, monitor_in.parent_group_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    monitor = await monitor_service.create_monitor(db, account_owner_id, monitor_in)

    if monitor.monitor_type != "group":
        # Commit now — run_check opens its own separate DB session (so it doesn't hold
        # a pooled connection during the outbound network check) and can't see this
        # row until it's actually committed, not just flushed.
        await db.commit()
        # Register with scheduler immediately
        schedule_monitor(monitor.id, monitor_service.interval_seconds_for_monitor(monitor))
        # Run one immediate validation so users don't wait for the first interval.
        await run_check(monitor.id)
        # run_check wrote through a separate session — this session's identity map
        # still holds the pre-check copy (expire_on_commit=False), so force a reload.
        # Must await the reload explicitly: AsyncSession can't lazy-load an expired
        # attribute on bare access (raises MissingGreenlet).
        await db.refresh(monitor)

    if monitor.parent_group_id is not None:
        await group_service.invalidate_for_monitor_change(db, monitor)

    refreshed = await monitor_service.get_monitor(db, monitor.id, account_owner_id)
    return refreshed or monitor


@router.get("/{monitor_id}", response_model=MonitorOut)
async def get_monitor(
    monitor_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    monitor = await monitor_service.get_monitor(db, monitor_id, get_account_owner_id(current_user))
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return monitor


@router.patch("/{monitor_id}", response_model=MonitorOut)
async def update_monitor(
    monitor_id: int,
    update_in: MonitorUpdate,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    monitor = await monitor_service.get_monitor(db, monitor_id, account_owner_id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    old_parent_group_id = monitor.parent_group_id
    if update_in.parent_group_id is not None and update_in.parent_group_id != old_parent_group_id:
        try:
            await group_service.validate_parent_assignment(db, account_owner_id, monitor.id, update_in.parent_group_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    monitor = await monitor_service.update_monitor(db, monitor, update_in)

    if monitor.monitor_type != "group":
        # Re-schedule using monitor-specific check settings.
        if monitor.is_active:
            schedule_monitor(monitor.id, monitor_service.interval_seconds_for_monitor(monitor))
        else:
            unschedule_monitor(monitor.id)
    else:
        unschedule_monitor(monitor.id)

  
    if old_parent_group_id is not None:
        await group_service.invalidate_group_cache(db, old_parent_group_id)
    if monitor.parent_group_id is not None:
        await group_service.invalidate_group_cache(db, monitor.parent_group_id)

    return monitor


@router.delete("/{monitor_id}", status_code=204)
async def delete_monitor(
    monitor_id: int,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    monitor = await monitor_service.get_monitor(db, monitor_id, get_account_owner_id(current_user))
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")
    unschedule_monitor(monitor.id)
    parent_group_id = monitor.parent_group_id
    await monitor_service.delete_monitor(db, monitor)
    if parent_group_id is not None:
        await group_service.invalidate_group_cache(db, parent_group_id)
