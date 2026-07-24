from types import SimpleNamespace
import pytest

from app.models.monitor import Monitor
from app.services import group_service


def _child(id, is_up):
    """Minimal stand-in for a Monitor — _status_for_policy only reads .id/.is_up."""
    return SimpleNamespace(id=id, is_up=is_up)


# ── Status policy tests (pure logic, no DB) ────────────────────────────────

def test_all_up_is_operational_regardless_of_policy():
    children = [_child(1, True), _child(2, True), _child(3, True)]
    for policy in group_service.VALID_POLICIES:
        status = group_service._status_for_policy(policy, {}, children, offline=0, down_ratio=0.0)
        assert status == group_service.STATUS_OPERATIONAL


def test_worst_status_wins_single_down_is_partial_outage():
    children = [_child(1, True), _child(2, True), _child(3, False)]
    status = group_service._status_for_policy("worst_status_wins", {}, children, offline=1, down_ratio=1 / 3)
    assert status == group_service.STATUS_PARTIAL_OUTAGE


def test_worst_status_wins_multiple_down_under_half_is_degraded():
    children = [_child(i, i > 2) for i in range(1, 6)]  # 2 down of 5 = 40%
    status = group_service._status_for_policy("worst_status_wins", {}, children, offline=2, down_ratio=0.4)
    assert status == group_service.STATUS_DEGRADED


def test_worst_status_wins_majority_down_is_major_outage():
    children = [_child(1, False), _child(2, False), _child(3, True)]
    status = group_service._status_for_policy("worst_status_wins", {}, children, offline=2, down_ratio=2 / 3)
    assert status == group_service.STATUS_MAJOR_OUTAGE


def test_any_down_policy_treats_single_failure_as_major_outage():
    children = [_child(1, True), _child(2, False)]
    status = group_service._status_for_policy("any_down", {}, children, offline=1, down_ratio=0.5)
    assert status == group_service.STATUS_MAJOR_OUTAGE


def test_majority_down_policy_ignores_minority_failures():
    children = [_child(1, True), _child(2, True), _child(3, False)]
    status = group_service._status_for_policy("majority_down", {}, children, offline=1, down_ratio=1 / 3)
    assert status == group_service.STATUS_OPERATIONAL


def test_majority_down_policy_trips_over_half():
    children = [_child(1, False), _child(2, False), _child(3, True)]
    status = group_service._status_for_policy("majority_down", {}, children, offline=2, down_ratio=2 / 3)
    assert status == group_service.STATUS_MAJOR_OUTAGE


def test_percentage_threshold_below_threshold_is_operational():
    children = [_child(i, i != 1) for i in range(1, 5)]  # 1 of 4 = 25% down
    status = group_service._status_for_policy(
        "percentage_threshold", {"percentage_threshold": 50}, children, offline=1, down_ratio=0.25
    )
    assert status == group_service.STATUS_OPERATIONAL


def test_percentage_threshold_at_or_above_threshold_is_major_outage():
    children = [_child(i, i != 1) for i in range(1, 5)]  # 1 of 4 = 25% down
    status = group_service._status_for_policy(
        "percentage_threshold", {"percentage_threshold": 25}, children, offline=1, down_ratio=0.25
    )
    assert status == group_service.STATUS_MAJOR_OUTAGE


def test_custom_priority_critical_monitor_down_forces_major_outage():
    children = [_child(1, False), _child(2, True), _child(3, True)]
    status = group_service._status_for_policy(
        "custom_priority", {"critical_monitor_ids": [1]}, children, offline=1, down_ratio=1 / 3
    )
    assert status == group_service.STATUS_MAJOR_OUTAGE


def test_custom_priority_non_critical_down_falls_back_to_worst_status_wins():
    children = [_child(1, True), _child(2, False), _child(3, True)]
    status = group_service._status_for_policy(
        "custom_priority", {"critical_monitor_ids": [1]}, children, offline=1, down_ratio=1 / 3
    )
    # monitor 1 (critical) is up; monitor 2 (non-critical) down — falls back to
    # worst_status_wins, which treats a single failure as partial_outage.
    assert status == group_service.STATUS_PARTIAL_OUTAGE


# ── compute_group_summary edge cases (needs a DB for the children query) ──

@pytest.mark.asyncio
async def test_summary_with_no_children_is_unknown(db_session):
    group = Monitor(user_id=1, name="Empty Group", monitor_type="group", target="", url="group://internal")
    db_session.add(group)
    await db_session.flush()

    summary = await group_service.compute_group_summary(db_session, group)
    assert summary["status"] == group_service.STATUS_UNKNOWN
    assert summary["total"] == 0


@pytest.mark.asyncio
async def test_summary_with_all_children_paused_is_paused(db_session):
    group = Monitor(user_id=1, name="Paused Group", monitor_type="group", target="", url="group://internal")
    db_session.add(group)
    await db_session.flush()

    db_session.add_all([
        Monitor(user_id=1, name="A", monitor_type="http", target="a", url="http://a", is_active=False, parent_group_id=group.id),
        Monitor(user_id=1, name="B", monitor_type="http", target="b", url="http://b", is_active=False, parent_group_id=group.id),
    ])
    await db_session.flush()

    summary = await group_service.compute_group_summary(db_session, group)
    assert summary["status"] == group_service.STATUS_PAUSED
    assert summary["total"] == 2
    assert summary["paused"] == 2


# ── validate_parent_assignment: cycles, wrong type, ownership, max depth ──

@pytest.mark.asyncio
async def test_rejects_self_as_parent(db_session):
    with pytest.raises(ValueError, match="own parent"):
        await group_service.validate_parent_assignment(db_session, account_owner_id=1, monitor_id=5, parent_group_id=5)


@pytest.mark.asyncio
async def test_rejects_missing_parent(db_session):
    with pytest.raises(ValueError, match="not found"):
        await group_service.validate_parent_assignment(db_session, account_owner_id=1, monitor_id=None, parent_group_id=999)


@pytest.mark.asyncio
async def test_rejects_non_group_parent(db_session):
    leaf = Monitor(user_id=1, name="Leaf", monitor_type="http", target="x", url="http://x")
    db_session.add(leaf)
    await db_session.flush()

    with pytest.raises(ValueError, match="must be a group"):
        await group_service.validate_parent_assignment(db_session, account_owner_id=1, monitor_id=None, parent_group_id=leaf.id)


@pytest.mark.asyncio
async def test_rejects_parent_from_a_different_account(db_session):
    other_users_group = Monitor(user_id=2, name="Not Mine", monitor_type="group", target="", url="group://internal")
    db_session.add(other_users_group)
    await db_session.flush()

    with pytest.raises(ValueError, match="not found"):
        await group_service.validate_parent_assignment(db_session, account_owner_id=1, monitor_id=None, parent_group_id=other_users_group.id)


@pytest.mark.asyncio
async def test_allows_nesting_up_to_max_depth(db_session):
    g1 = Monitor(user_id=1, name="L1", monitor_type="group", target="", url="group://internal")
    db_session.add(g1)
    await db_session.flush()
    g2 = Monitor(user_id=1, name="L2", monitor_type="group", target="", url="group://internal", parent_group_id=g1.id)
    db_session.add(g2)
    await db_session.flush()

    # L3 under L2 is the MAX_GROUP_DEPTH-th level — should be allowed.
    await group_service.validate_parent_assignment(db_session, account_owner_id=1, monitor_id=None, parent_group_id=g2.id)


@pytest.mark.asyncio
async def test_rejects_nesting_beyond_max_depth(db_session):
    g1 = Monitor(user_id=1, name="L1", monitor_type="group", target="", url="group://internal")
    db_session.add(g1)
    await db_session.flush()
    g2 = Monitor(user_id=1, name="L2", monitor_type="group", target="", url="group://internal", parent_group_id=g1.id)
    db_session.add(g2)
    await db_session.flush()
    g3 = Monitor(user_id=1, name="L3", monitor_type="group", target="", url="group://internal", parent_group_id=g2.id)
    db_session.add(g3)
    await db_session.flush()

    # L4 under L3 would be a 4th group level — exceeds MAX_GROUP_DEPTH (3).
    with pytest.raises(ValueError, match="cannot exceed"):
        await group_service.validate_parent_assignment(db_session, account_owner_id=1, monitor_id=None, parent_group_id=g3.id)


@pytest.mark.asyncio
async def test_rejects_circular_reference(db_session):
    g1 = Monitor(user_id=1, name="L1", monitor_type="group", target="", url="group://internal")
    db_session.add(g1)
    await db_session.flush()
    g2 = Monitor(user_id=1, name="L2", monitor_type="group", target="", url="group://internal", parent_group_id=g1.id)
    db_session.add(g2)
    await db_session.flush()

    # Attempting to make L1 a child of its own descendant L2 must be rejected.
    with pytest.raises(ValueError, match="circular"):
        await group_service.validate_parent_assignment(db_session, account_owner_id=1, monitor_id=g1.id, parent_group_id=g2.id)
