from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import get_account_owner_id, require_roles
from app.models.user import User
from app.models.status_page import StatusPage
from app.models.incident import Incident, IncidentUpdate
from app.schemas.incident import IncidentCreate, IncidentUpdateIn, IncidentOut, VALID_STATUSES, VALID_SEVERITIES

router = APIRouter(prefix="/api/status-pages/{page_id}/incidents", tags=["incidents"])


async def _get_owned_page(db: AsyncSession, page_id: int, account_owner_id: int) -> StatusPage:
    result = await db.execute(
        select(StatusPage).where(StatusPage.id == page_id, StatusPage.user_id == account_owner_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Status page not found")
    return page


async def _get_incident(db: AsyncSession, page_id: int, incident_id: int) -> Incident:
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.updates))
        .where(Incident.id == incident_id, Incident.status_page_id == page_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.get("", response_model=list[IncidentOut])
async def list_incidents(
    page_id: int,
    current_user: User = Depends(require_roles("admin", "editor", "viewer")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.updates))
        .where(Incident.status_page_id == page_id)
        .order_by(Incident.started_at.desc())
    )
    return [IncidentOut.from_orm_obj(i) for i in result.scalars().all()]


@router.post("", response_model=IncidentOut, status_code=201)
async def create_incident(
    page_id: int,
    incident_in: IncidentCreate,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    if incident_in.severity not in VALID_SEVERITIES:
        raise HTTPException(status_code=400, detail=f"severity must be one of {sorted(VALID_SEVERITIES)}")

    incident = Incident(
        status_page_id=page_id,
        user_id=get_account_owner_id(current_user),
        title=incident_in.title,
        severity=incident_in.severity,
        affected_component_ids=",".join(str(i) for i in incident_in.affected_component_ids),
        status="investigating",
        started_at=datetime.utcnow(),
    )
    incident.updates = [IncidentUpdate(
        status="investigating",
        message=incident_in.message or f"We are investigating an issue affecting {incident_in.title}.",
    )]
    db.add(incident)
    await db.flush()
    await db.refresh(incident, attribute_names=["updates"])
    return IncidentOut.from_orm_obj(incident)


@router.post("/{incident_id}/updates", response_model=IncidentOut, status_code=201)
async def add_incident_update(
    page_id: int,
    incident_id: int,
    update_in: IncidentUpdateIn,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    if update_in.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {VALID_STATUSES}")

    incident = await _get_incident(db, page_id, incident_id)
    incident.status = update_in.status
    if update_in.status == "resolved" and not incident.resolved_at:
        incident.resolved_at = datetime.utcnow()
    db.add(IncidentUpdate(incident_id=incident.id, status=update_in.status, message=update_in.message))
    await db.flush()
    await db.refresh(incident, attribute_names=["updates"])
    return IncidentOut.from_orm_obj(incident)


@router.delete("/{incident_id}", status_code=204)
async def delete_incident(
    page_id: int,
    incident_id: int,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    incident = await _get_incident(db, page_id, incident_id)
    await db.delete(incident)
