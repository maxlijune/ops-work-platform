from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.server import Server
from app.models.database import Database
from app.models.alert import Alert
from app.models.job import Job, JobRun
from sqlalchemy import func

router = APIRouter()

@router.get("/summary")
async def get_summary(db: Session = Depends(get_db)):
    servers = db.query(Server).all()
    databases = db.query(Database).all()
    jobs = db.query(Job).all()
    
    server_online = sum(1 for s in servers if s.status == 'active')
    db_online = sum(1 for d in databases if d.status == 'active')
    
    # Calculate job success rate for today
    total_runs = db.query(JobRun).filter(JobRun.status.in_(['success', 'failed'])).count()
    success_runs = db.query(JobRun).filter(JobRun.status == 'success').count()
    success_rate = round((success_runs / total_runs * 100) if total_runs > 0 else 0, 1)
    
    alert_count = db.query(Alert).filter(Alert.status == 'unresolved').count()
    
    return {
        "code": 0,
        "data": {
            "server_total": len(servers),
            "server_online": server_online,
            "database_total": len(databases),
            "database_online": db_online,
            "alert_count": alert_count,
            "job_success_rate": success_rate
        },
        "message": "success"
    }

@router.get("/alerts")
async def get_recent_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).filter(Alert.status == 'unresolved').order_by(Alert.created_at.desc()).limit(10).all()
    result = []
    for a in alerts:
        result.append({
            "id": a.id, "source_type": a.source_type, "source_id": a.source_id,
            "level": a.level, "message": a.message, "status": a.status,
            "created_at": a.created_at
        })
    return {"code": 0, "data": result, "message": "success"}

@router.get("/server-summary")
async def get_server_summary(db: Session = Depends(get_db)):
    servers = db.query(Server).order_by(Server.cpu_usage.desc().nullslast()).limit(5).all()
    result = []
    for s in servers:
        result.append({
            "id": s.id, "name": s.name, "status": s.status,
            "cpu_usage": s.cpu_usage, "memory_usage": s.memory_usage
        })
    return {"code": 0, "data": result, "message": "success"}

@router.get("/database-summary")
async def get_database_summary(db: Session = Depends(get_db)):
    dbs = db.query(Database).order_by(Database.active_connections.desc().nullslast()).limit(5).all()
    result = []
    for d in dbs:
        result.append({
            "id": d.id, "name": d.name, "status": d.status,
            "active_connections": d.active_connections, "slow_queries": d.slow_queries
        })
    return {"code": 0, "data": result, "message": "success"}

@router.get("/job-summary")
async def get_job_summary(db: Session = Depends(get_db)):
    total = db.query(Job).count()
    active = db.query(Job).filter(Job.enabled == 1).count()
    return {
        "code": 0,
        "data": {"total": total, "active": active},
        "message": "success"
    }
