from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.user import StaffCreate, StaffUpdate, UserCreate, UserOut, Token
from app.services.user_service import create_user, get_user_by_email, get_user_by_id, get_users_for_account
from app.core.security import (
    create_access_token,
    get_account_owner_id,
    get_current_user,
    require_roles,
    verify_password,
)
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = await create_user(db, user_in)
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is inactive")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/staff", response_model=list[UserOut])
async def list_staff(
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    account_owner_id = get_account_owner_id(current_user)
    return await get_users_for_account(db, account_owner_id)


@router.post("/staff", response_model=UserOut, status_code=201)
async def create_staff(
    staff_in: StaffCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    existing = await get_user_by_email(db, staff_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    account_owner_id = get_account_owner_id(current_user)
    user = await create_user(
        db,
        UserCreate(
            email=staff_in.email,
            password=staff_in.password,
            full_name=staff_in.full_name,
        ),
        role=staff_in.role,
        account_owner_id=account_owner_id,
    )
    return user


@router.patch("/staff/{user_id}", response_model=UserOut)
async def update_staff(
    user_id: int,
    update_in: StaffUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    target_user = await get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    account_owner_id = get_account_owner_id(current_user)
    if target_user.account_owner_id != account_owner_id:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.id == current_user.id and update_in.role and update_in.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot remove your own admin role")

    for field, value in update_in.model_dump(exclude_unset=True).items():
        setattr(target_user, field, value)

    await db.flush()
    await db.refresh(target_user)
    return target_user


@router.delete("/staff/{user_id}", status_code=204)
async def delete_staff(
    user_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    target_user = await get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    account_owner_id = get_account_owner_id(current_user)
    if target_user.account_owner_id != account_owner_id:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.id == account_owner_id:
        raise HTTPException(status_code=400, detail="Workspace owner cannot be deleted")

    await db.delete(target_user)
