from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.job import Job, JobRun
from datetime import datetime

router = APIRouter()

@router.get("")
async def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.id).all()
    result = []
    for j in jobs:
        result.append({
            "id": j.id, "name": j.name, "type": j.type,
            "target_id": j.target_id, "target_type": j.target_type,
            "schedule": j.schedule, "content": j.content,
            "enabled": bool(j.enabled), "status": j.status,
            "last_run": j.last_run, "next_run": j.next_run,
            "created_at": j.created_at
        })
    return {"code": 0, "data": result, "message": "success"}

@router.post("")
async def create_job(data: dict, db: Session = Depends(get_db)):
    try:
        job = Job(
            name=data.get("name"),
            type=data.get("type", "script"),
            target_id=data.get("target_id"),
            target_type=data.get("target_type", "server"),
            schedule=data.get("schedule", "* * * * *"),
            content=data.get("content", ""),
            enabled=1 if data.get("enabled", True) else 0,
            status="active"
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return {"code": 0, "data": {"id": job.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{job_id}")
async def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"code": 0, "data": {"id": job.id, "name": job.name}, "message": "success"}

@router.put("/{job_id}")
async def update_job(job_id: int, data: dict, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        for key, value in data.items():
            if key == "enabled":
                job.enabled = 1 if value else 0
            elif hasattr(job, key) and key not in ["id", "created_at"]:
                setattr(job, key, value)
        db.commit()
        return {"code": 0, "data": {"id": job.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{job_id}")
async def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"code": 0, "data": None, "message": "success"}

@router.post("/{job_id}/run")
async def run_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Create a job run record
    run = JobRun(job_id=job_id, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)
    # For now, just simulate success
    run.status = "success"
    run.start_time = datetime.utcnow()
    run.end_time = datetime.utcnow()
    run.duration = 0
    run.output = "Job executed successfully"
    job.last_run = datetime.utcnow()
    db.commit()
    return {"code": 0, "data": {"status": "started", "run_id": run.id}, "message": "Job started"}

@router.get("/{job_id}/history")
async def get_job_history(job_id: int, db: Session = Depends(get_db)):
    runs = db.query(JobRun).filter(JobRun.job_id == job_id).order_by(JobRun.start_time.desc()).limit(50).all()
    result = []
    for r in runs:
        result.append({
            "id": r.id, "job_id": r.job_id,
            "start_time": r.start_time, "end_time": r.end_time,
            "duration": r.duration, "status": r.status,
            "output": r.output, "error": r.error
        })
    return {"code": 0, "data": result, "message": "success"}
