from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_account_owner_id, require_roles
from app.models.user import User
from app.models.monitor import Monitor
from app.models.audit_log import AuditLog
from app.schemas.monitor import (
    MonitorCreate, MonitorUpdate, MonitorOut, GroupConfig, RequestConfig, RetryConfig,
    NotificationConfig, CheckSettings, AdvancedConfig, OrganizationConfig,
)
from app.services import monitor_service, group_service

router = APIRouter(prefix="/api/groups", tags=["groups"])


class GroupCreateIn(BaseModel):
    name: str
    description: str | None = None
    parent_group_id: int | None = None
    group_config: GroupConfig = Field(default_factory=GroupConfig)


class GroupUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    parent_group_id: int | None = None
    group_config: GroupConfig | None = None


class AddChildIn(BaseModel):
    monitor_id: int


class ReorderIn(BaseModel):
    ordered_monitor_ids: list[int]


class GroupOut(MonitorOut):
    summary: dict


async def _audit(db: AsyncSession, user_id: int, action: str, entity_id: int, detail: dict | None = None):
    db.add(AuditLog(user_id=user_id, action=action, entity_type="group", entity_id=entity_id, detail=detail or {}))
    await db.flush()


async def _get_owned_group(db: AsyncSession, group_id: int, account_owner_id: int) -> Monitor:
    result = await db.execute(
        select(Monitor).where(
            Monitor.id == group_id, Monitor.user_id == account_owner_id, Monitor.monitor_type == "group"
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


async def _to_group_out(db: AsyncSession, group: Monitor, use_cache: bool = True) -> GroupOut:
    summary = await group_service.get_group_summary(db, group, use_cache=use_cache)
    return GroupOut(**MonitorOut.model_validate(group).model_dump(), summary=summary)


@router.get("", response_model=list[GroupOut])
async def list_groups(
    current_user: User = Depends(require_roles("admin", "editor", "viewer")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    result = await db.execute(
        select(Monitor)
        .where(Monitor.user_id == account_owner_id, Monitor.monitor_type == "group")
        .order_by(Monitor.display_order, Monitor.id)
    )
    groups = result.scalars().all()
    return [await _to_group_out(db, g) for g in groups]


@router.post("", response_model=GroupOut, status_code=201)
async def create_group(
    group_in: GroupCreateIn,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    if group_in.parent_group_id is not None:
        try:
            await group_service.validate_parent_assignment(db, account_owner_id, None, group_in.parent_group_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    monitor_in = MonitorCreate(
        name=group_in.name,
        monitor_type="group",
        target="",
        parent_group_id=group_in.parent_group_id,
        request_config=RequestConfig(), retry_config=RetryConfig(), notification_config=NotificationConfig(),
        check_settings=CheckSettings(), advanced_config=AdvancedConfig(),
        organization_config=OrganizationConfig(description=group_in.description),
        group_config=group_in.group_config,
    )
    group = await monitor_service.create_monitor(db, account_owner_id, monitor_in)
    await _audit(db, account_owner_id, "group_created", group.id, {"name": group.name})
    if group.parent_group_id is not None:
        await group_service.invalidate_group_cache(db, group.parent_group_id)
    return await _to_group_out(db, group, use_cache=False)


@router.patch("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: int,
    update_in: GroupUpdateIn,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    group = await _get_owned_group(db, group_id, account_owner_id)

    old_parent_group_id = group.parent_group_id
    if update_in.parent_group_id is not None and update_in.parent_group_id != old_parent_group_id:
        try:
            await group_service.validate_parent_assignment(db, account_owner_id, group.id, update_in.parent_group_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    monitor_update = MonitorUpdate()
    if update_in.name is not None:
        monitor_update.name = update_in.name
    if update_in.parent_group_id is not None:
        monitor_update.parent_group_id = update_in.parent_group_id
    if update_in.group_config is not None:
        monitor_update.group_config = update_in.group_config
    if update_in.description is not None:
        existing_org = group.organization_config or {}
        monitor_update.organization_config = OrganizationConfig(
            tags=existing_org.get("tags", []), project=existing_org.get("project"), description=update_in.description,
        )

    group = await monitor_service.update_monitor(db, group, monitor_update)
    await _audit(db, account_owner_id, "group_updated", group.id, update_in.model_dump(exclude_unset=True))

    if old_parent_group_id is not None:
        await group_service.invalidate_group_cache(db, old_parent_group_id)
    await group_service.invalidate_group_cache(db, group.id)
    if group.parent_group_id is not None:
        await group_service.invalidate_group_cache(db, group.parent_group_id)

    return await _to_group_out(db, group, use_cache=False)


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    group = await _get_owned_group(db, group_id, account_owner_id)

    # Orphan children rather than cascade-deleting monitors.
    children_result = await db.execute(select(Monitor).where(Monitor.parent_group_id == group.id))
    for child in children_result.scalars().all():
        child.parent_group_id = None
    await db.flush()

    parent_group_id = group.parent_group_id
    await monitor_service.delete_monitor(db, group)
    await _audit(db, account_owner_id, "group_deleted", group_id, {"name": group.name})
    if parent_group_id is not None:
        await group_service.invalidate_group_cache(db, parent_group_id)


@router.get("/{group_id}/children", response_model=list[MonitorOut])
async def list_children(
    group_id: int,
    current_user: User = Depends(require_roles("admin", "editor", "viewer")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    await _get_owned_group(db, group_id, account_owner_id)
    result = await db.execute(
        select(Monitor)
        .where(Monitor.parent_group_id == group_id)
        .order_by(Monitor.display_order, Monitor.id)
    )
    return result.scalars().all()


@router.post("/{group_id}/children", response_model=MonitorOut, status_code=201)
async def add_child(
    group_id: int,
    add_in: AddChildIn,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    await _get_owned_group(db, group_id, account_owner_id)

    monitor = await monitor_service.get_monitor(db, add_in.monitor_id, account_owner_id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    try:
        await group_service.validate_parent_assignment(db, account_owner_id, monitor.id, group_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    old_parent_group_id = monitor.parent_group_id
    monitor.parent_group_id = group_id
    await db.flush()
    await db.refresh(monitor)

    await _audit(db, account_owner_id, "child_added", group_id, {"monitor_id": monitor.id})
    if old_parent_group_id is not None:
        await group_service.invalidate_group_cache(db, old_parent_group_id)
    await group_service.invalidate_group_cache(db, group_id)

    return monitor


@router.delete("/{group_id}/children/{monitor_id}", status_code=204)
async def remove_child(
    group_id: int,
    monitor_id: int,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    await _get_owned_group(db, group_id, account_owner_id)
    monitor = await monitor_service.get_monitor(db, monitor_id, account_owner_id)
    if not monitor or monitor.parent_group_id != group_id:
        raise HTTPException(status_code=404, detail="Monitor is not a child of this group")

    monitor.parent_group_id = None
    await db.flush()
    await _audit(db, account_owner_id, "child_removed", group_id, {"monitor_id": monitor.id})
    await group_service.invalidate_group_cache(db, group_id)


@router.patch("/{group_id}/children/reorder", response_model=list[MonitorOut])
async def reorder_children(
    group_id: int,
    reorder_in: ReorderIn,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    await _get_owned_group(db, group_id, account_owner_id)

    result = await db.execute(select(Monitor).where(Monitor.parent_group_id == group_id))
    children_by_id = {m.id: m for m in result.scalars().all()}

    for order, monitor_id in enumerate(reorder_in.ordered_monitor_ids):
        child = children_by_id.get(monitor_id)
        if child:
            child.display_order = order
    await db.flush()

    await group_service.invalidate_group_cache(db, group_id)
    ordered = sorted(children_by_id.values(), key=lambda m: m.display_order)
    return ordered
