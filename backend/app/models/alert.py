from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), nullable=False, index=True)
    source_id = Column(Integer, nullable=False, index=True)
    level = Column(String(20), nullable=False)  # info, warning, critical
    alert_type = Column(String(50))
    message = Column(Text)
    status = Column(String(20), default="unresolved")  # unresolved, resolved, ignored
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
