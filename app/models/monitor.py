from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Monitor(Base):
    __tablename__ = "monitors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    interval_minutes: Mapped[int] = mapped_column(Integer, default=5)  # 1, 3, or 5
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_up: Mapped[bool] = mapped_column(Boolean, nullable=True)         # last known status

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_checked_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    owner: Mapped["User"] = relationship("User", back_populates="monitors")  # noqa
    check_results: Mapped[list["CheckResult"]] = relationship(  # noqa
        "CheckResult", back_populates="monitor", cascade="all, delete-orphan"
    )
