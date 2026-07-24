from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    status_page_id: Mapped[int] = mapped_column(ForeignKey("status_pages.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="investigating")  # investigating|identified|monitoring|resolved
    severity: Mapped[str] = mapped_column(String(20), default="minor")  # minor|major|critical
    affected_component_ids: Mapped[str] = mapped_column(Text, default="")  # comma-separated

    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    updates: Mapped[list["IncidentUpdate"]] = relationship(
        "IncidentUpdate", back_populates="incident", cascade="all, delete-orphan",
        order_by="IncidentUpdate.created_at",
    )


class IncidentUpdate(Base):
    __tablename__ = "incident_updates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False)  # status snapshot at this update
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    incident: Mapped["Incident"] = relationship("Incident", back_populates="updates")
