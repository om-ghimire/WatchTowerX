from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.alert_channel import AlertChannel
from app.schemas.alert_channel import AlertChannelCreate, AlertChannelUpdate, AlertChannelOut

router = APIRouter(prefix="/api/alert-channels", tags=["alerts"])


@router.get("/", response_model=list[AlertChannelOut])
async def list_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AlertChannel).where(AlertChannel.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/", response_model=AlertChannelOut, status_code=201)
async def create_channel(
    ch_in: AlertChannelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ch = AlertChannel(
        user_id=current_user.id,
        name=ch_in.name,
        channel_type=ch_in.channel_type,
        webhook_url=str(ch_in.webhook_url),
        monitor_id=ch_in.monitor_id,
        alert_on_immediate=ch_in.alert_on_immediate,
        retry_count=ch_in.retry_count,
    )
    db.add(ch)
    await db.flush()
    await db.refresh(ch)
    return ch


@router.patch("/{ch_id}", response_model=AlertChannelOut)
async def update_channel(
    ch_id: int,
    update_in: AlertChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AlertChannel).where(AlertChannel.id == ch_id, AlertChannel.user_id == current_user.id)
    )
    ch = result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Alert channel not found")
    for field, value in update_in.model_dump(exclude_unset=True).items():
        if field == "webhook_url" and value:
            value = str(value)
        setattr(ch, field, value)
    await db.flush()
    await db.refresh(ch)
    return ch


@router.delete("/{ch_id}", status_code=204)
async def delete_channel(
    ch_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AlertChannel).where(AlertChannel.id == ch_id, AlertChannel.user_id == current_user.id)
    )
    ch = result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Alert channel not found")
    await db.delete(ch)


@router.post("/{ch_id}/test", status_code=200)
async def test_channel(
    ch_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test ping to the webhook."""
    result = await db.execute(
        select(AlertChannel).where(AlertChannel.id == ch_id, AlertChannel.user_id == current_user.id)
    )
    ch = result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Alert channel not found")
    from app.services.alert_service import send_teams_alert
    await send_teams_alert(
        ch.webhook_url,
        monitor_name="Test Monitor",
        monitor_url="https://WatchTowerX.test",
        error="This is a test alert from WatchTowerX",
        status_code=None,
        response_time_ms=None,
    )
    return {"message": "Test alert sent"}
