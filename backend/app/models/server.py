from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    ip = Column(String(50), nullable=False)
    os_type = Column(String(50), default="Linux")
    ssh_port = Column(Integer, default=22)
    ssh_username = Column(String(100))
    ssh_password_enc = Column(Text)
    ssh_key_enc = Column(Text, nullable=True)
    tags = Column(String(255), default="")
    status = Column(String(20), default="active")
    cpu_usage = Column(Integer, default=0)
    memory_usage = Column(Integer, default=0)
    disk_usage = Column(Integer, default=0)
    load_average = Column(String(50), default="0")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
