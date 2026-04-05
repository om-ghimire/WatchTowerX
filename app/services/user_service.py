from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.schemas.user import UserCreate, UserRole
from app.core.security import hash_password


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    user_in: UserCreate,
    role: UserRole = "admin",
    account_owner_id: Optional[int] = None,
) -> User:
    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=role,
        account_owner_id=account_owner_id,
    )
    db.add(user)
    await db.flush()

    # Personal workspaces use self as the account owner.
    if account_owner_id is None:
        user.account_owner_id = user.id
        await db.flush()

    await db.refresh(user)
    return user


async def get_users_for_account(db: AsyncSession, account_owner_id: int) -> list[User]:
    result = await db.execute(
        select(User)
        .where(User.account_owner_id == account_owner_id)
        .order_by(User.created_at.asc())
    )
    return result.scalars().all()
