from datetime import datetime
from typing import Optional
from pydantic import BaseModel

VALID_STATUSES = {"operational", "degraded", "partial_outage", "major_outage", "maintenance"}


class ComponentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "operational"
    display_order: int = 0


class ComponentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    display_order: Optional[int] = None


class ComponentOut(BaseModel):
    id: int
    status_page_id: int
    name: str
    description: Optional[str]
    status: str
    display_order: int
    created_at: datetime

    model_config = {"from_attributes": True}
