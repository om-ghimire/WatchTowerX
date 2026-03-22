from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CheckResultOut(BaseModel):
    id: int
    monitor_id: int
    is_up: bool
    status_code: Optional[int]
    response_time_ms: Optional[float]
    error: Optional[str]
    checked_at: datetime

    model_config = {"from_attributes": True}
