from datetime import datetime
from sqlalchemy import Integer, Boolean, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CheckResult(Base):
    __tablename__ = "check_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    monitor_id: Mapped[int] = mapped_column(ForeignKey("monitors.id"), nullable=False, index=True)

    is_up: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=True)       # HTTP status
    response_time_ms: Mapped[float] = mapped_column(Float, nullable=True)  # milliseconds
    error: Mapped[str] = mapped_column(String(512), nullable=True)         # error message if down
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    monitor: Mapped["Monitor"] = relationship("Monitor", back_populates="check_results")  # noqa
