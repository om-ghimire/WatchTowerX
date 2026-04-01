from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Monitor(Base):
    __tablename__ = "monitors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    monitor_type: Mapped[str] = mapped_column(String(20), default="http", nullable=False)
    target: Mapped[str] = mapped_column(String(2048), nullable=False)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    interval_minutes: Mapped[int] = mapped_column(Integer, default=5)  # 1, 3, or 5

    # Per-monitor independent configuration payloads.
    request_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    retry_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    notification_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    check_settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    advanced_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    organization_config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_up: Mapped[bool] = mapped_column(Boolean, nullable=True)         # last known status

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_checked_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    last_failure_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_notification_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    owner: Mapped["User"] = relationship("User", back_populates="monitors")  # noqa
    check_results: Mapped[list["CheckResult"]] = relationship(  # noqa
        "CheckResult", back_populates="monitor", cascade="all, delete-orphan"
    )
