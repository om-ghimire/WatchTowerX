from datetime import datetime
from typing import Optional
from pydantic import BaseModel

VALID_STATUSES = ["investigating", "identified", "monitoring", "resolved"]
VALID_SEVERITIES = {"minor", "major", "critical"}


class IncidentCreate(BaseModel):
    title: str
    severity: str = "minor"
    affected_component_ids: list[int] = []
    message: Optional[str] = None  # initial timeline update


class IncidentUpdateIn(BaseModel):
    status: str
    message: str


class IncidentUpdateOut(BaseModel):
    id: int
    status: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class IncidentOut(BaseModel):
    id: int
    status_page_id: int
    title: str
    status: str
    severity: str
    affected_component_ids: list[int]
    started_at: datetime
    resolved_at: Optional[datetime]
    created_at: datetime
    updates: list[IncidentUpdateOut] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj):
        ids = [int(i) for i in obj.affected_component_ids.split(",") if i.strip()] if obj.affected_component_ids else []
        return cls(
            id=obj.id, status_page_id=obj.status_page_id, title=obj.title,
            status=obj.status, severity=obj.severity, affected_component_ids=ids,
            started_at=obj.started_at, resolved_at=obj.resolved_at, created_at=obj.created_at,
            updates=[IncidentUpdateOut.model_validate(u) for u in obj.updates],
        )
