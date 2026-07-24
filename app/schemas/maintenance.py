from datetime import datetime
from typing import Optional
from pydantic import BaseModel

VALID_STATUSES = ["upcoming", "in_progress", "completed", "cancelled"]


class MaintenanceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    affected_component_ids: list[int] = []
    scheduled_start: datetime
    scheduled_end: datetime


class MaintenanceEdit(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    affected_component_ids: Optional[list[int]] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None


class MaintenanceUpdateIn(BaseModel):
    status: str
    message: str


class MaintenanceUpdateOut(BaseModel):
    id: int
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MaintenanceOut(BaseModel):
    id: int
    status_page_id: int
    title: str
    description: Optional[str]
    status: str
    affected_component_ids: list[int]
    scheduled_start: datetime
    scheduled_end: datetime
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    created_at: datetime
    updates: list[MaintenanceUpdateOut] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj):
        ids = [int(i) for i in obj.affected_component_ids.split(",") if i.strip()] if obj.affected_component_ids else []
        return cls(
            id=obj.id, status_page_id=obj.status_page_id, title=obj.title,
            description=obj.description, status=obj.status, affected_component_ids=ids,
            scheduled_start=obj.scheduled_start, scheduled_end=obj.scheduled_end,
            actual_start=obj.actual_start, actual_end=obj.actual_end, created_at=obj.created_at,
            updates=[MaintenanceUpdateOut.model_validate(u) for u in obj.updates],
        )
