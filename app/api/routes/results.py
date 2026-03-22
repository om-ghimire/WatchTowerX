from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Integer, cast

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.check_result import CheckResult
from app.schemas.check_result import CheckResultOut
from app.services.monitor_service import get_monitor

router = APIRouter(prefix="/api/monitors", tags=["results"])


@router.get("/{monitor_id}/results", response_model=list[CheckResultOut])
async def get_results(
    monitor_id: int,
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    monitor = await get_monitor(db, monitor_id, current_user.id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    result = await db.execute(
        select(CheckResult)
        .where(CheckResult.monitor_id == monitor_id)
        .order_by(CheckResult.checked_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{monitor_id}/stats")
async def get_stats(
    monitor_id: int,
    hours: int = Query(default=24, le=168),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return uptime % and avg/min/max response time for the last N hours."""
    monitor = await get_monitor(db, monitor_id, current_user.id)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    since = datetime.utcnow() - timedelta(hours=hours)

    result = await db.execute(
        select(
            func.count(CheckResult.id).label("total"),
            func.sum(cast(CheckResult.is_up, Integer)).label("up_count"),
            func.avg(CheckResult.response_time_ms).label("avg_response_ms"),
            func.min(CheckResult.response_time_ms).label("min_response_ms"),
            func.max(CheckResult.response_time_ms).label("max_response_ms"),
        ).where(
            CheckResult.monitor_id == monitor_id,
            CheckResult.checked_at >= since,
        )
    )
    row = result.one()
    total = row.total or 0
    up_count = row.up_count or 0
    uptime_pct = round((up_count / total) * 100, 2) if total else None

    return {
        "monitor_id": monitor_id,
        "period_hours": hours,
        "total_checks": total,
        "uptime_percent": uptime_pct,
        "avg_response_ms": round(row.avg_response_ms, 2) if row.avg_response_ms else None,
        "min_response_ms": round(row.min_response_ms, 2) if row.min_response_ms else None,
        "max_response_ms": round(row.max_response_ms, 2) if row.max_response_ms else None,
    }
