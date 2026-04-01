from typing import Optional, Literal
from pydantic import BaseModel, HttpUrl


class AlertChannelCreate(BaseModel):
    name: str
    channel_type: Literal["teams", "slack", "custom"] = "teams"
    webhook_url: HttpUrl
    monitor_id: Optional[int] = None
    alert_on_immediate: bool = False
    retry_count: int = 3


class AlertChannelUpdate(BaseModel):
    name: Optional[str] = None
    webhook_url: Optional[HttpUrl] = None
    monitor_id: Optional[int] = None
    alert_on_immediate: Optional[bool] = None
    retry_count: Optional[int] = None
    is_active: Optional[bool] = None


class AlertChannelOut(BaseModel):
    id: int
    name: str
    channel_type: str
    webhook_url: str
    monitor_id: Optional[int]
    alert_on_immediate: bool
    retry_count: int
    is_active: bool

    model_config = {"from_attributes": True}
