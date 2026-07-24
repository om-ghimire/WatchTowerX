from datetime import datetime
from sqlalchemy import String, DateTime, Integer, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    action: Mapped[str] = mapped_column(String(50), nullable=False)          # group_created|group_updated|group_deleted|child_added|child_removed
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)     # e.g. "group"
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
