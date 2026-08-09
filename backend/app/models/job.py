from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    type = Column(String(50))  # script, sql
    target_id = Column(Integer)
    target_type = Column(String(50), default="server")  # server, database
    schedule = Column(String(100))
    content = Column(Text)
    enabled = Column(Integer, default=1)
    status = Column(String(20), default="active")
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class JobRun(Base):
    __tablename__ = "job_runs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    start_time = Column(DateTime, server_default=func.now())
    end_time = Column(DateTime, nullable=True)
    duration = Column(Integer, default=0)
    status = Column(String(20), default="running")  # running, success, failed
    output = Column(Text, default="")
    error = Column(Text, default="")
