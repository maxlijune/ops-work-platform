from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.plan_task import PlanTask

router = APIRouter()

@router.get("")
async def list_plan_tasks(
    db: Session = Depends(get_db),
    plan_type: str = None,
    status: str = None,
    priority: int = None
):
    query = db.query(PlanTask)
    if plan_type:
        query = query.filter(PlanTask.plan_type == plan_type)
    if status:
        query = query.filter(PlanTask.status == status)
    if priority:
        query = query.filter(PlanTask.priority == priority)
    tasks = query.order_by(PlanTask.id).all()
    result = []
    for t in tasks:
        result.append({
            "id": t.id, "title": t.title, "description": t.description,
            "status": t.status, "priority": t.priority,
            "due_date": t.due_date, "progress": t.progress,
            "assignee": t.assignee, "plan_type": t.plan_type,
            "created_at": t.created_at, "updated_at": t.updated_at
        })
    return {"code": 0, "data": result, "message": "success"}

@router.post("")
async def create_plan_task(data: dict, db: Session = Depends(get_db)):
    try:
        task = PlanTask(
            title=data.get("title"),
            description=data.get("description", ""),
            status=data.get("status", "todo"),
            priority=data.get("priority", 2),
            due_date=data.get("due_date"),
            progress=data.get("progress", 0),
            assignee=data.get("assignee", ""),
            plan_type=data.get("plan_type", "ops")
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return {"code": 0, "data": {"id": task.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{task_id}")
async def get_plan_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(PlanTask).filter(PlanTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"code": 0, "data": {
        "id": task.id, "title": task.title, "description": task.description,
        "status": task.status, "priority": task.priority,
        "due_date": task.due_date, "progress": task.progress,
        "assignee": task.assignee, "plan_type": task.plan_type
    }, "message": "success"}

@router.put("/{task_id}")
async def update_plan_task(task_id: int, data: dict, db: Session = Depends(get_db)):
    task = db.query(PlanTask).filter(PlanTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    try:
        for key, value in data.items():
            if hasattr(task, key) and key not in ["id", "created_at"]:
                setattr(task, key, value)
        db.commit()
        return {"code": 0, "data": {"id": task.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{task_id}")
async def delete_plan_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(PlanTask).filter(PlanTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"code": 0, "data": None, "message": "success"}
