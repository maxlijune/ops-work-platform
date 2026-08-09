from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.database import Database as DBModel
from app.core.encryption import encrypt, decrypt

router = APIRouter()

@router.get("")
async def list_databases(db: Session = Depends(get_db)):
    dbs = db.query(DBModel).order_by(DBModel.id).all()
    result = []
    for d in dbs:
        result.append({
            "id": d.id, "name": d.name, "type": d.type,
            "host": d.host, "port": d.port, "db_name": d.db_name,
            "username": d.username, "server_id": d.server_id,
            "status": d.status, "active_connections": d.active_connections,
            "slow_queries": d.slow_queries, "total_size": d.total_size,
            "replication_delay": d.replication_delay,
            "created_at": d.created_at, "updated_at": d.updated_at
        })
    return {"code": 0, "data": result, "message": "success"}

@router.post("")
async def create_database(data: dict, db: Session = Depends(get_db)):
    try:
        db_obj = DBModel(
            name=data.get("name"),
            type=data.get("type", "MySQL"),
            host=data.get("host"),
            port=data.get("port", 3306),
            db_name=data.get("db_name"),
            username=data.get("username"),
            password_enc=encrypt(data.get("password", "")),
            server_id=data.get("server_id"),
            status=data.get("status", "active")
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return {"code": 0, "data": {"id": db_obj.id, "name": db_obj.name}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{db_id}")
async def get_database(db_id: int, db: Session = Depends(get_db)):
    db_obj = db.query(DBModel).filter(DBModel.id == db_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Database not found")
    result = {
        "id": db_obj.id, "name": db_obj.name, "type": db_obj.type,
        "host": db_obj.host, "port": db_obj.port, "db_name": db_obj.db_name,
        "username": db_obj.username, "server_id": db_obj.server_id,
        "status": db_obj.status, "active_connections": db_obj.active_connections,
        "slow_queries": db_obj.slow_queries, "total_size": db_obj.total_size,
        "replication_delay": db_obj.replication_delay,
        "created_at": db_obj.created_at, "updated_at": db_obj.updated_at
    }
    return {"code": 0, "data": result, "message": "success"}

@router.put("/{db_id}")
async def update_database(db_id: int, data: dict, db: Session = Depends(get_db)):
    db_obj = db.query(DBModel).filter(DBModel.id == db_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Database not found")
    try:
        for key, value in data.items():
            if key == "password" and value:
                db_obj.password_enc = encrypt(value)
            elif hasattr(db_obj, key) and key not in ["id", "created_at"]:
                setattr(db_obj, key, value)
        db.commit()
        db.refresh(db_obj)
        return {"code": 0, "data": {"id": db_obj.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{db_id}")
async def delete_database(db_id: int, db: Session = Depends(get_db)):
    db_obj = db.query(DBModel).filter(DBModel.id == db_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Database not found")
    db.delete(db_obj)
    db.commit()
    return {"code": 0, "data": None, "message": "success"}

@router.post("/{db_id}/test-connection")
async def test_connection(db_id: int, db: Session = Depends(get_db)):
    db_obj = db.query(DBModel).filter(DBModel.id == db_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Database not found")
    try:
        password = decrypt(db_obj.password_enc)
        if db_obj.type in ["MySQL", "MariaDB", "TDSQL"]:
            import pymysql
            conn = pymysql.connect(
                host=db_obj.host, port=db_obj.port or 3306,
                user=db_obj.username, password=password,
                database=db_obj.db_name, connect_timeout=5
            )
            conn.close()
        elif db_obj.type == "PostgreSQL":
            import psycopg2
            conn = psycopg2.connect(
                host=db_obj.host, port=db_obj.port or 5432,
                user=db_obj.username, password=password,
                dbname=db_obj.db_name, connect_timeout=5
            )
            conn.close()
        else:
            return {"code": 1, "data": None, "message": f"Connection test not supported for {db_obj.type}"}
        return {"code": 0, "data": {"status": "ok"}, "message": "Connection successful"}
    except Exception as e:
        return {"code": 1, "data": None, "message": f"Connection failed: {str(e)}"}

@router.post("/{db_id}/collect")
async def collect_metrics(db_id: int, db: Session = Depends(get_db)):
    db_obj = db.query(DBModel).filter(DBModel.id == db_id).first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Database not found")
    return {"code": 0, "data": {"status": "ok"}, "message": "Collection started"}

@router.get("/{db_id}/backup-history")
async def get_backup_history(db_id: int, db: Session = Depends(get_db)):
    return {"code": 0, "data": [], "message": "success"}
