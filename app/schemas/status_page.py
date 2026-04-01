from typing import Optional
from pydantic import BaseModel


class StatusPageCreate(BaseModel):
    slug: str
    title: str = "System Status"
    description: Optional[str] = None
    is_public: bool = True
    monitor_ids: list[int] = []


class StatusPageUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    monitor_ids: Optional[list[int]] = None


class StatusPageOut(BaseModel):
    id: int
    slug: str
    title: str
    description: Optional[str]
    is_public: bool
    monitor_ids: list[int]

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj):
        ids = [int(i) for i in obj.monitor_ids.split(",") if i.strip()] if obj.monitor_ids else []
        return cls(
            id=obj.id, slug=obj.slug, title=obj.title,
            description=obj.description, is_public=obj.is_public,
            monitor_ids=ids,
        )
