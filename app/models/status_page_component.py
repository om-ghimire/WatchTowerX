from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class StatusPageComponent(Base):
    __tablename__ = "status_page_components"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    status_page_id: Mapped[int] = mapped_column(ForeignKey("status_pages.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="operational")  # operational|degraded|partial_outage|major_outage|maintenance
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
