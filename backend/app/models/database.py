from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class Database(Base):
    __tablename__ = "databases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    type = Column(String(50), nullable=False)
    host = Column(String(100), nullable=False)
    port = Column(Integer, nullable=False)
    db_name = Column(String(100))
    username = Column(String(100))
    password_enc = Column(Text)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)
    status = Column(String(20), default="active")
    active_connections = Column(Integer, default=0)
    slow_queries = Column(Integer, default=0)
    total_size = Column(Integer, default=0)
    replication_delay = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
