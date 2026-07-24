from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_account_owner_id, require_roles
from app.models.user import User
from app.models.status_page import StatusPage
from app.models.status_page_component import StatusPageComponent
from app.schemas.status_page_component import ComponentCreate, ComponentUpdate, ComponentOut, VALID_STATUSES

router = APIRouter(prefix="/api/status-pages/{page_id}/components", tags=["status-page-components"])


async def _get_owned_page(db: AsyncSession, page_id: int, account_owner_id: int) -> StatusPage:
    result = await db.execute(
        select(StatusPage).where(StatusPage.id == page_id, StatusPage.user_id == account_owner_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Status page not found")
    return page


@router.get("", response_model=list[ComponentOut])
async def list_components(
    page_id: int,
    current_user: User = Depends(require_roles("admin", "editor", "viewer")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    result = await db.execute(
        select(StatusPageComponent)
        .where(StatusPageComponent.status_page_id == page_id)
        .order_by(StatusPageComponent.display_order, StatusPageComponent.id)
    )
    return result.scalars().all()


@router.post("", response_model=ComponentOut, status_code=201)
async def create_component(
    page_id: int,
    component_in: ComponentCreate,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    if component_in.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_STATUSES)}")
    component = StatusPageComponent(status_page_id=page_id, **component_in.model_dump())
    db.add(component)
    await db.flush()
    await db.refresh(component)
    return component


@router.patch("/{component_id}", response_model=ComponentOut)
async def update_component(
    page_id: int,
    component_id: int,
    update_in: ComponentUpdate,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    result = await db.execute(
        select(StatusPageComponent).where(
            StatusPageComponent.id == component_id, StatusPageComponent.status_page_id == page_id
        )
    )
    component = result.scalar_one_or_none()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    data = update_in.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_STATUSES)}")
    for field, value in data.items():
        setattr(component, field, value)
    await db.flush()
    await db.refresh(component)
    return component


@router.delete("/{component_id}", status_code=204)
async def delete_component(
    page_id: int,
    component_id: int,
    current_user: User = Depends(require_roles("admin", "editor")),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_page(db, page_id, get_account_owner_id(current_user))
    result = await db.execute(
        select(StatusPageComponent).where(
            StatusPageComponent.id == component_id, StatusPageComponent.status_page_id == page_id
        )
    )
    component = result.scalar_one_or_none()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    await db.delete(component)
