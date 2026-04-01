from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class AlertChannel(Base):
    __tablename__ = "alert_channels"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    monitor_id: Mapped[int] = mapped_column(ForeignKey("monitors.id"), nullable=True, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel_type: Mapped[str] = mapped_column(String(50), default="teams")   # teams | slack | custom
    webhook_url: Mapped[str] = mapped_column(Text, nullable=False)

    # Alert trigger config
    alert_on_immediate: Mapped[bool] = mapped_column(Boolean, default=False)
    retry_count: Mapped[int] = mapped_column(Integer, default=3)             # N consecutive failures before alert

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    monitor: Mapped["Monitor"] = relationship("Monitor", backref="alert_channels")  # noqa
