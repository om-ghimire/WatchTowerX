from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    status_page_id: Mapped[int] = mapped_column(ForeignKey("status_pages.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="upcoming")  # upcoming|in_progress|completed|cancelled
    affected_component_ids: Mapped[str] = mapped_column(Text, default="")  # comma-separated

    scheduled_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    actual_start: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    actual_end: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    updates: Mapped[list["MaintenanceUpdate"]] = relationship(
        "MaintenanceUpdate", back_populates="maintenance", cascade="all, delete-orphan",
        order_by="MaintenanceUpdate.created_at",
    )


class MaintenanceUpdate(Base):
    __tablename__ = "maintenance_updates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    maintenance_id: Mapped[int] = mapped_column(ForeignKey("maintenance_windows.id"), nullable=False, index=True)

    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    maintenance: Mapped["MaintenanceWindow"] = relationship("MaintenanceWindow", back_populates="updates")
