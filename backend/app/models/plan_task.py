from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base

class PlanTask(Base):
    __tablename__ = "plan_tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="todo")  # todo, in_progress, done
    priority = Column(Integer, default=2)  # 1=Low, 2=Medium, 3=High
    due_date = Column(String(50), nullable=True)
    progress = Column(Integer, default=0)
    assignee = Column(String(100), default="")
    plan_type = Column(String(20), default="ops")  # ops, data
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
