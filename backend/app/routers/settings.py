from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.settings import Setting, Doc, SystemLog

router = APIRouter()

@router.get("/global")
async def get_global_settings(db: Session = Depends(get_db)):
    settings = db.query(Setting).all()
    result = {}
    for s in settings:
        result[s.key] = s.value
    return {"code": 0, "data": result, "message": "success"}

@router.put("/global")
async def update_global_settings(data: dict, db: Session = Depends(get_db)):
    try:
        for key, value in data.items():
            setting = db.query(Setting).filter(Setting.key == key).first()
            if setting:
                setting.value = str(value)
            else:
                setting = Setting(key=key, value=str(value))
                db.add(setting)
        db.commit()
        return {"code": 0, "data": {}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/docs")
async def list_docs(db: Session = Depends(get_db)):
    docs = db.query(Doc).order_by(Doc.id).all()
    result = []
    for d in docs:
        result.append({
            "id": d.id, "title": d.title, "category": d.category,
            "content": d.content, "created_at": d.created_at, "updated_at": d.updated_at
        })
    return {"code": 0, "data": result, "message": "success"}

@router.post("/docs")
async def create_doc(data: dict, db: Session = Depends(get_db)):
    try:
        doc = Doc(
            title=data.get("title", "新文档"),
            category=data.get("category", "默认"),
            content=data.get("content", "")
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return {"code": 0, "data": {"id": doc.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/docs/{doc_id}")
async def get_doc(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Doc).filter(Doc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doc not found")
    return {"code": 0, "data": {
        "id": doc.id, "title": doc.title, "category": doc.category,
        "content": doc.content, "created_at": doc.created_at, "updated_at": doc.updated_at
    }, "message": "success"}

@router.put("/docs/{doc_id}")
async def update_doc(doc_id: int, data: dict, db: Session = Depends(get_db)):
    doc = db.query(Doc).filter(Doc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doc not found")
    try:
        for key, value in data.items():
            if hasattr(doc, key) and key not in ["id", "created_at"]:
                setattr(doc, key, value)
        db.commit()
        return {"code": 0, "data": {"id": doc.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/docs/{doc_id}")
async def delete_doc(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Doc).filter(Doc.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doc not found")
    db.delete(doc)
    db.commit()
    return {"code": 0, "data": None, "message": "success"}

@router.get("/logs")
async def get_system_logs(db: Session = Depends(get_db)):
    logs = db.query(SystemLog).order_by(SystemLog.time.desc()).limit(100).all()
    result = []
    for l in logs:
        result.append({"id": l.id, "time": l.time, "level": l.level, "message": l.message})
    return {"code": 0, "data": result, "message": "success"}

@router.post("/export")
async def export_data():
    return {"code": 0, "data": {"message": "Export would generate JSON file"}, "message": "success"}

@router.post("/backup-config")
async def save_backup_config(data: dict):
    return {"code": 0, "data": {}, "message": "success"}
