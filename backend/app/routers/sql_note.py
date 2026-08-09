from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.sql_note import SQLNote

router = APIRouter()

@router.get("")
async def list_sql_notes(
    db: Session = Depends(get_db),
    db_type: str = None,
    search: str = None
):
    query = db.query(SQLNote).filter(SQLNote.is_current == True)
    if db_type:
        query = query.filter(SQLNote.db_type == db_type)
    notes = query.order_by(SQLNote.updated_at.desc()).all()
    result = []
    for n in notes:
        if search and search not in (n.title or "") and search not in (n.content or ""):
            continue
        result.append({
            "id": n.id, "title": n.title, "content": n.content,
            "db_type": n.db_type, "folder": n.folder, "tags": n.tags,
            "version": n.version, "created_at": n.created_at, "updated_at": n.updated_at
        })
    return {"code": 0, "data": result, "message": "success"}

@router.post("")
async def create_sql_note(data: dict, db: Session = Depends(get_db)):
    try:
        note = SQLNote(
            title=data.get("title", "新笔记"),
            content=data.get("content", ""),
            db_type=data.get("db_type", "通用"),
            folder=data.get("folder", "默认"),
            tags=data.get("tags", ""),
            version=1,
            is_current=True
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return {"code": 0, "data": {"id": note.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{note_id}")
async def get_sql_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(SQLNote).filter(SQLNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"code": 0, "data": {
        "id": note.id, "title": note.title, "content": note.content,
        "db_type": note.db_type, "folder": note.folder, "tags": note.tags,
        "version": note.version, "created_at": note.created_at, "updated_at": note.updated_at
    }, "message": "success"}

@router.put("/{note_id}")
async def update_sql_note(note_id: int, data: dict, db: Session = Depends(get_db)):
    note = db.query(SQLNote).filter(SQLNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    try:
        # Mark current version as not current
        note.is_current = False
        db.commit()
        
        # Create new version
        new_version = SQLNote(
            title=data.get("title", note.title),
            content=data.get("content", note.content),
            db_type=data.get("db_type", note.db_type),
            folder=data.get("folder", note.folder),
            tags=data.get("tags", note.tags),
            version=note.version + 1,
            is_current=True
        )
        db.add(new_version)
        db.commit()
        db.refresh(new_version)
        return {"code": 0, "data": {"id": new_version.id, "version": new_version.version}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{note_id}")
async def delete_sql_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(SQLNote).filter(SQLNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    # Delete all versions of this note
    db.query(SQLNote).filter(SQLNote.title == note.title).delete()
    db.commit()
    return {"code": 0, "data": None, "message": "success"}

@router.get("/{note_id}/versions")
async def get_note_versions(note_id: int, db: Session = Depends(get_db)):
    note = db.query(SQLNote).filter(SQLNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    versions = db.query(SQLNote).filter(SQLNote.title == note.title).order_by(SQLNote.version.desc()).all()
    result = []
    for v in versions:
        result.append({
            "id": v.id, "version": v.version, "content": v.content,
            "is_current": v.is_current, "created_at": v.created_at
        })
    return {"code": 0, "data": result, "message": "success"}

@router.post("/{note_id}/restore")
async def restore_version(note_id: int, data: dict, db: Session = Depends(get_db)):
    note = db.query(SQLNote).filter(SQLNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    target_version = data.get("version")
    version = db.query(SQLNote).filter(SQLNote.title == note.title, SQLNote.version == target_version).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    # Create new version with restored content
    note.is_current = False
    db.commit()
    restored = SQLNote(
        title=note.title, content=version.content,
        db_type=note.db_type, folder=note.folder, tags=note.tags,
        version=note.version + 1, is_current=True
    )
    db.add(restored)
    db.commit()
    return {"code": 0, "data": {"version": restored.version}, "message": "success"}

@router.get("/{note_id}/compare")
async def compare_versions(note_id: int, v1: int, v2: int, db: Session = Depends(get_db)):
    note = db.query(SQLNote).filter(SQLNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    ver1 = db.query(SQLNote).filter(SQLNote.title == note.title, SQLNote.version == v1).first()
    ver2 = db.query(SQLNote).filter(SQLNote.title == note.title, SQLNote.version == v2).first()
    return {"code": 0, "data": {"v1": ver1.content if ver1 else "", "v2": ver2.content if ver2 else ""}, "message": "success"}
