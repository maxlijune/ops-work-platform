from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.alert import Alert
from datetime import datetime

router = APIRouter()

@router.get("")
async def list_alerts(
    db: Session = Depends(get_db),
    status: str = None,
    source_type: str = None,
    level: str = None
):
    query = db.query(Alert)
    if status:
        query = query.filter(Alert.status == status)
    if source_type:
        query = query.filter(Alert.source_type == source_type)
    if level:
        query = query.filter(Alert.level == level)
    alerts = query.order_by(Alert.created_at.desc()).all()
    result = []
    for a in alerts:
        result.append({
            "id": a.id, "source_type": a.source_type, "source_id": a.source_id,
            "level": a.level, "alert_type": a.alert_type,
            "message": a.message, "status": a.status,
            "resolved_at": a.resolved_at, "resolved_by": a.resolved_by,
            "created_at": a.created_at
        })
    return {"code": 0, "data": result, "message": "success"}

@router.post("")
async def create_alert(data: dict, db: Session = Depends(get_db)):
    try:
        alert = Alert(
            source_type=data.get("source_type"),
            source_id=data.get("source_id"),
            level=data.get("level", "warning"),
            alert_type=data.get("alert_type"),
            message=data.get("message"),
            status=data.get("status", "unresolved")
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return {"code": 0, "data": {"id": alert.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{alert_id}/resolve")
async def resolve_alert(alert_id: int, data: dict = None, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = (data or {}).get("resolved_by", "system")
    db.commit()
    return {"code": 0, "data": {"id": alert.id}, "message": "success"}
