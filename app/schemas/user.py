from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr

UserRole = Literal["admin", "editor", "viewer"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    role: UserRole
    account_owner_id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: UserRole = "viewer"


class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
