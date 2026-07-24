from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Integer, cast
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import get_account_owner_id, get_current_user, require_roles
from app.models.user import User
from app.models.status_page import StatusPage
from app.models.monitor import Monitor
from app.models.check_result import CheckResult
from app.models.status_page_component import StatusPageComponent
from app.models.incident import Incident
from app.models.maintenance_window import MaintenanceWindow
from app.schemas.status_page import StatusPageCreate, StatusPageUpdate, StatusPageOut
from app.schemas.incident import IncidentOut
from app.schemas.maintenance import MaintenanceOut

router = APIRouter(tags=["status-pages"])


# ── Private (auth required) ───────────────────────────────────────────────────

@router.get("/api/status-pages", response_model=list[StatusPageOut])
async def list_status_pages(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    result = await db.execute(select(StatusPage).where(StatusPage.user_id == account_owner_id))
    pages = result.scalars().all()
    return [StatusPageOut.from_orm_obj(p) for p in pages]


@router.post("/api/status-pages", response_model=StatusPageOut, status_code=201)
async def create_status_page(
    page_in: StatusPageCreate,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(StatusPage).where(StatusPage.slug == page_in.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slug already taken")
    page = StatusPage(
        user_id=get_account_owner_id(current_user),
        slug=page_in.slug,
        title=page_in.title,
        description=page_in.description,
        is_public=page_in.is_public,
        monitor_ids=",".join(str(i) for i in page_in.monitor_ids),
    )
    db.add(page)
    await db.flush()
    await db.refresh(page)
    return StatusPageOut.from_orm_obj(page)


@router.patch("/api/status-pages/{page_id}", response_model=StatusPageOut)
async def update_status_page(
    page_id: int,
    update_in: StatusPageUpdate,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    result = await db.execute(
        select(StatusPage).where(StatusPage.id == page_id, StatusPage.user_id == account_owner_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Status page not found")
    for field, value in update_in.model_dump(exclude_unset=True).items():
        if field == "monitor_ids":
            setattr(page, field, ",".join(str(i) for i in value))
        else:
            setattr(page, field, value)
    await db.flush()
    await db.refresh(page)
    return StatusPageOut.from_orm_obj(page)


@router.delete("/api/status-pages/{page_id}", status_code=204)
async def delete_status_page(
    page_id: int,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    result = await db.execute(
        select(StatusPage).where(StatusPage.id == page_id, StatusPage.user_id == account_owner_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Status page not found")
    await db.delete(page)


# ── Public (no auth) ──────────────────────────────────────────────────────────

@router.get("/status/{slug}")
@router.get("/api/status/{slug}")
async def get_public_status_page(slug: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns all data needed to render the status page."""
    result = await db.execute(
        select(StatusPage).where(StatusPage.slug == slug, StatusPage.is_public == True)  # noqa
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Status page not found")

    monitor_ids = [int(i) for i in page.monitor_ids.split(",") if i.strip()] if page.monitor_ids else []

    monitors_result = await db.execute(
        select(Monitor).where(Monitor.id.in_(monitor_ids), Monitor.is_active == True)  # noqa
    )
    monitors = monitors_result.scalars().all()

    since_90d = datetime.utcnow() - timedelta(days=90)
    since_24h = datetime.utcnow() - timedelta(hours=24)

    monitors_data = []
    for m in monitors:
        # 90-day daily uptime buckets — aggregated in SQL (not fetched row-by-row
        # and scanned 90x in Python) so this stays cheap as check history grows.
        day_expr = func.date_trunc("day", CheckResult.checked_at)
        daily_result = await db.execute(
            select(
                day_expr.label("day"),
                func.count(CheckResult.id).label("total"),
                func.sum(cast(CheckResult.is_up, Integer)).label("up_count"),
            )
            .where(CheckResult.monitor_id == m.id, CheckResult.checked_at >= since_90d)
            .group_by(day_expr)
        )
        by_day = {row.day.date(): (row.up_count or 0, row.total) for row in daily_result}

        buckets = []
        for day_offset in range(89, -1, -1):
            day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=day_offset)
            stats = by_day.get(day_start.date())
            if not stats:
                buckets.append(None)
            else:
                up_count, total = stats
                buckets.append(round(up_count / total * 100, 1) if total else None)

        # 24h stats
        stats_result = await db.execute(
            select(
                func.count(CheckResult.id).label("total"),
                func.sum(cast(CheckResult.is_up, Integer)).label("up_count"),
                func.avg(CheckResult.response_time_ms).label("avg_ms"),
            ).where(CheckResult.monitor_id == m.id, CheckResult.checked_at >= since_24h)
        )
        row = stats_result.one()
        total = row.total or 0
        up_count = row.up_count or 0
        uptime_24h = round((up_count / total) * 100, 2) if total else None

        # Recent incidents (last 5 down events)
        incidents_result = await db.execute(
            select(CheckResult)
            .where(CheckResult.monitor_id == m.id, CheckResult.is_up == False)  # noqa
            .order_by(CheckResult.checked_at.desc())
            .limit(5)
        )
        incidents = [
            {"checked_at": str(r.checked_at), "error": r.error, "status_code": r.status_code}
            for r in incidents_result.scalars().all()
        ]

        monitors_data.append({
            "id": m.id,
            "name": m.name,
            "url": m.url,
            "is_up": m.is_up,
            "last_checked_at": str(m.last_checked_at) if m.last_checked_at else None,
            "uptime_24h": uptime_24h,
            "avg_response_ms": round(row.avg_ms, 1) if row.avg_ms else None,
            "daily_buckets": buckets,
            "recent_incidents": incidents,
        })

    all_up = all(m["is_up"] for m in monitors_data if m["is_up"] is not None)
    any_down = any(m["is_up"] is False for m in monitors_data)
    overall = "operational" if all_up else ("degraded" if any_down else "unknown")

    components_result = await db.execute(
        select(StatusPageComponent)
        .where(StatusPageComponent.status_page_id == page.id)
        .order_by(StatusPageComponent.display_order, StatusPageComponent.id)
    )
    components = components_result.scalars().all()

    incidents_result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.updates))
        .where(Incident.status_page_id == page.id)
        .order_by(Incident.started_at.desc())
        .limit(15)
    )
    incidents = [IncidentOut.from_orm_obj(i) for i in incidents_result.scalars().all()]

    maintenance_result = await db.execute(
        select(MaintenanceWindow)
        .options(selectinload(MaintenanceWindow.updates))
        .where(MaintenanceWindow.status_page_id == page.id)
        .order_by(MaintenanceWindow.scheduled_start.desc())
        .limit(15)
    )
    maintenance = [MaintenanceOut.from_orm_obj(m) for m in maintenance_result.scalars().all()]

    return {
        "page": StatusPageOut.from_orm_obj(page),
        "overall_status": overall,
        "monitors": monitors_data,
        "components": [
            {
                "id": c.id, "name": c.name, "description": c.description,
                "status": c.status, "display_order": c.display_order,
            }
            for c in components
        ],
        "incidents": [i.model_dump(mode="json") for i in incidents],
        "maintenance": [m.model_dump(mode="json") for m in maintenance],
        "generated_at": str(datetime.utcnow()),
    }
