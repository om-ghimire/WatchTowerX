from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, HttpUrl


class MonitorCreate(BaseModel):
    name: str
    url: HttpUrl
    interval_minutes: Literal[1, 3, 5] = 5


class MonitorUpdate(BaseModel):
    name: Optional[str] = None
    interval_minutes: Optional[Literal[1, 3, 5]] = None
    is_active: Optional[bool] = None


class MonitorOut(BaseModel):
    id: int
    name: str
    url: str
    interval_minutes: int
    is_active: bool
    is_up: Optional[bool]
    last_checked_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}
