import json
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Integer, cast

from app.models.monitor import Monitor
from app.models.check_result import CheckResult
from app.core.redis_client import get_redis

MAX_GROUP_DEPTH = 3
CACHE_TTL_SECONDS = 60

STATUS_OPERATIONAL = "operational"
STATUS_DEGRADED = "degraded"
STATUS_PARTIAL_OUTAGE = "partial_outage"
STATUS_MAJOR_OUTAGE = "major_outage"
STATUS_PAUSED = "paused"
STATUS_UNKNOWN = "unknown"

VALID_POLICIES = {"worst_status_wins", "any_down", "majority_down", "percentage_threshold", "custom_priority"}


async def validate_parent_assignment(
    db: AsyncSession, account_owner_id: int, monitor_id: int | None, parent_group_id: int | None
) -> None:
    """Raises ValueError on any invalid group assignment (missing/wrong-account/wrong-type/cycle/too-deep)."""
    if parent_group_id is None:
        return

    if parent_group_id == monitor_id:
        raise ValueError("A monitor cannot be its own parent group")

    result = await db.execute(
        select(Monitor).where(Monitor.id == parent_group_id, Monitor.user_id == account_owner_id)
    )
    parent = result.scalar_one_or_none()
    if not parent:
        raise ValueError("Parent group not found")
    if parent.monitor_type != "group":
        raise ValueError("Parent must be a group monitor")

    # Walk the parent's own ancestor chain to reject cycles and compute the parent's depth
    # (root group = depth 1). Attaching the new monitor under `parent` places it one level
    # deeper than `parent` itself, so the check happens once, after the walk finishes —
    # not per-iteration, which under-counts by exactly one against the final chain length.
    depth = 1
    current = parent
    visited = {parent.id}
    while current.parent_group_id is not None:
        if current.parent_group_id == monitor_id:
            raise ValueError("Assignment would create a circular group reference")
        if current.parent_group_id in visited:
            raise ValueError("Circular group reference detected in existing hierarchy")
        next_result = await db.execute(select(Monitor).where(Monitor.id == current.parent_group_id))
        current = next_result.scalar_one_or_none()
        if not current:
            break
        visited.add(current.id)
        depth += 1

    if depth + 1 > MAX_GROUP_DEPTH:
        raise ValueError(f"Group nesting cannot exceed {MAX_GROUP_DEPTH} levels")


def _status_for_policy(policy: str, policy_cfg: dict, active_children: list[Monitor], offline: int, down_ratio: float) -> str:
    if offline == 0:
        return STATUS_OPERATIONAL

    if policy == "any_down":
        return STATUS_MAJOR_OUTAGE

    if policy == "majority_down":
        return STATUS_MAJOR_OUTAGE if down_ratio > 0.5 else STATUS_OPERATIONAL

    if policy == "percentage_threshold":
        threshold = float(policy_cfg.get("percentage_threshold", 50)) / 100
        return STATUS_MAJOR_OUTAGE if down_ratio >= threshold else STATUS_OPERATIONAL

    if policy == "custom_priority":
        critical_ids = set(policy_cfg.get("critical_monitor_ids", []) or [])
        if any(c.id in critical_ids and c.is_up is False for c in active_children):
            return STATUS_MAJOR_OUTAGE
        # No critical monitor down — fall through to worst_status_wins for the rest.

    # worst_status_wins (default, and custom_priority's fallback)
    if down_ratio > 0.5:
        return STATUS_MAJOR_OUTAGE
    if offline == 1:
        return STATUS_PARTIAL_OUTAGE
    return STATUS_DEGRADED


async def compute_group_summary(db: AsyncSession, group: Monitor) -> dict:
    result = await db.execute(select(Monitor).where(Monitor.parent_group_id == group.id))
    children = result.scalars().all()
    total = len(children)

    if total == 0:
        return {"status": STATUS_UNKNOWN, "total": 0, "online": 0, "offline": 0, "paused": 0,
                "uptime_pct": None, "avg_latency_ms": None}

    active_children = [c for c in children if c.is_active]
    paused = total - len(active_children)
    if not active_children:
        return {"status": STATUS_PAUSED, "total": total, "online": 0, "offline": 0, "paused": paused,
                "uptime_pct": None, "avg_latency_ms": None}

    online = sum(1 for c in active_children if c.is_up is True)
    offline = sum(1 for c in active_children if c.is_up is False)
    down_ratio = offline / len(active_children)

    policy = (group.group_config or {}).get("health_policy", "worst_status_wins")
    policy_cfg = (group.group_config or {}).get("health_policy_config", {}) or {}
    status = _status_for_policy(policy, policy_cfg, active_children, offline, down_ratio)

    child_ids = [c.id for c in active_children]
    since_24h = datetime.utcnow() - timedelta(hours=24)
    stats_result = await db.execute(
        select(
            func.avg(cast(CheckResult.is_up, Integer)).label("up_ratio"),
            func.avg(CheckResult.response_time_ms).label("avg_ms"),
        ).where(CheckResult.monitor_id.in_(child_ids), CheckResult.checked_at >= since_24h)
    )
    row = stats_result.one()
    uptime_pct = round(float(row.up_ratio) * 100, 2) if row.up_ratio is not None else None
    avg_latency_ms = round(row.avg_ms, 1) if row.avg_ms is not None else None

    return {"status": status, "total": total, "online": online, "offline": offline, "paused": paused,
            "uptime_pct": uptime_pct, "avg_latency_ms": avg_latency_ms}


def _cache_key(group_id: int) -> str:
    return f"group_summary:{group_id}"


async def get_group_summary(db: AsyncSession, group: Monitor, use_cache: bool = True) -> dict:
    if use_cache:
        try:
            cached = await get_redis().get(_cache_key(group.id))
            if cached:
                return json.loads(cached)
        except Exception:
            pass  # Redis unavailable — compute live rather than fail the request.

    summary = await compute_group_summary(db, group)

    try:
        await get_redis().set(_cache_key(group.id), json.dumps(summary), ex=CACHE_TTL_SECONDS)
    except Exception:
        pass

    return summary


async def invalidate_group_cache(db: AsyncSession, group_id: int) -> None:
    """Invalidate this group's cached summary, then walk up invalidating ancestor groups too —
    a child status change can flip an ancestor's rolled-up status, not just the direct parent."""
    try:
        redis_client = get_redis()
    except Exception:
        return

    current_id = group_id
    seen: set[int] = set()
    while current_id is not None and current_id not in seen:
        seen.add(current_id)
        try:
            await redis_client.delete(_cache_key(current_id))
        except Exception:
            break
        result = await db.execute(select(Monitor.parent_group_id).where(Monitor.id == current_id))
        current_id = result.scalar_one_or_none()


async def invalidate_for_monitor_change(db: AsyncSession, monitor: Monitor) -> None:
    """Call after create/update/delete/status-change of any monitor that might affect a parent group."""
    if monitor.parent_group_id is not None:
        await invalidate_group_cache(db, monitor.parent_group_id)
