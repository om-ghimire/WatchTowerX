from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import get_account_owner_id, require_roles
from app.models.user import User
from app.models.status_page import StatusPage
from app.models.maintenance_window import MaintenanceWindow, MaintenanceUpdate
from app.schemas.maintenance import (
    MaintenanceCreate, MaintenanceEdit, MaintenanceUpdateIn, MaintenanceOut, VALID_STATUSES,
)

router = APIRouter(prefix="/api/status-pages/{page_id}/maintenance", tags=["maintenance"])


async def _get_owned_page(db: AsyncSession, page_id: int, account_owner_id: int) -> StatusPage:
    result = await db.execute(
        select(StatusPage).where(StatusPage.id == page_id, StatusPage.user_id == account_owner_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Status page not found")
    return page


async def _get_maintenance(db: AsyncSession, page_id: int, maintenance_id: int) -> MaintenanceWindow:
    result = await db.execute(
        select(MaintenanceWindow)
        .options(selectinload(MaintenanceWindow.updates))
        .where(MaintenanceWindow.id == maintenance_id, MaintenanceWindow.status_page_id == page_id)
    )
    maintenance = result.scalar_one_or_none()
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance window not found")
    return maintenance


@router.get("", response_model=list[MaintenanceOut])
async def list_maintenance(
    page_id: int,
    current_user: User = Depends(require_roles("admin", "editor", "viewer")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    result = await db.execute(
        select(MaintenanceWindow)
        .options(selectinload(MaintenanceWindow.updates))
        .where(MaintenanceWindow.status_page_id == page_id)
        .order_by(MaintenanceWindow.scheduled_start.desc())
    )
    return [MaintenanceOut.from_orm_obj(m) for m in result.scalars().all()]


@router.post("", response_model=MaintenanceOut, status_code=201)
async def create_maintenance(
    page_id: int,
    maintenance_in: MaintenanceCreate,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    if maintenance_in.scheduled_end <= maintenance_in.scheduled_start:
        raise HTTPException(status_code=400, detail="scheduled_end must be after scheduled_start")

    maintenance = MaintenanceWindow(
        status_page_id=page_id,
        user_id=get_account_owner_id(current_user),
        title=maintenance_in.title,
        description=maintenance_in.description,
        affected_component_ids=",".join(str(i) for i in maintenance_in.affected_component_ids),
        scheduled_start=maintenance_in.scheduled_start,
        scheduled_end=maintenance_in.scheduled_end,
        status="upcoming",
    )
    db.add(maintenance)
    await db.flush()
    await db.refresh(maintenance, attribute_names=["updates"])
    return MaintenanceOut.from_orm_obj(maintenance)


@router.patch("/{maintenance_id}", response_model=MaintenanceOut)
async def edit_maintenance(
    page_id: int,
    maintenance_id: int,
    edit_in: MaintenanceEdit,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    maintenance = await _get_maintenance(db, page_id, maintenance_id)

    data = edit_in.model_dump(exclude_unset=True)
    if "affected_component_ids" in data:
        data["affected_component_ids"] = ",".join(str(i) for i in data["affected_component_ids"])
    for field, value in data.items():
        setattr(maintenance, field, value)
    await db.flush()
    await db.refresh(maintenance, attribute_names=["updates"])
    return MaintenanceOut.from_orm_obj(maintenance)


@router.post("/{maintenance_id}/updates", response_model=MaintenanceOut, status_code=201)
async def add_maintenance_update(
    page_id: int,
    maintenance_id: int,
    update_in: MaintenanceUpdateIn,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    if update_in.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {VALID_STATUSES}")

    maintenance = await _get_maintenance(db, page_id, maintenance_id)
    maintenance.status = update_in.status
    now = datetime.utcnow()
    if update_in.status == "in_progress" and not maintenance.actual_start:
        maintenance.actual_start = now
    if update_in.status in {"completed", "cancelled"} and not maintenance.actual_end:
        maintenance.actual_end = now
    db.add(MaintenanceUpdate(maintenance_id=maintenance.id, message=update_in.message))
    await db.flush()
    await db.refresh(maintenance, attribute_names=["updates"])
    return MaintenanceOut.from_orm_obj(maintenance)


@router.delete("/{maintenance_id}", status_code=204)
async def delete_maintenance(
    page_id: int,
    maintenance_id: int,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    maintenance = await _get_maintenance(db, page_id, maintenance_id)
    await db.delete(maintenance)
