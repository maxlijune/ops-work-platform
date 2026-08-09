from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.server import Server
from app.core.encryption import encrypt, decrypt

router = APIRouter()

@router.get("")
async def list_servers(db: Session = Depends(get_db)):
    servers = db.query(Server).order_by(Server.id).all()
    result = []
    for s in servers:
        d = {
            "id": s.id, "name": s.name, "ip": s.ip, "os_type": s.os_type,
            "ssh_port": s.ssh_port, "ssh_username": s.ssh_username,
            "tags": s.tags, "status": s.status,
            "cpu_usage": s.cpu_usage, "memory_usage": s.memory_usage,
            "disk_usage": s.disk_usage, "load_average": s.load_average,
            "created_at": s.created_at, "updated_at": s.updated_at
        }
        result.append(d)
    return {"code": 0, "data": result, "message": "success"}

@router.post("")
async def create_server(data: dict, db: Session = Depends(get_db)):
    try:
        server = Server(
            name=data.get("name"),
            ip=data.get("ip"),
            os_type=data.get("os_type", "Linux"),
            ssh_port=data.get("ssh_port", 22),
            ssh_username=data.get("ssh_username"),
            ssh_password_enc=encrypt(data.get("ssh_password", "")),
            ssh_key_enc=encrypt(data.get("ssh_key", "")) if data.get("ssh_key") else None,
            tags=data.get("tags", ""),
            status=data.get("status", "active")
        )
        db.add(server)
        db.commit()
        db.refresh(server)
        return {"code": 0, "data": {"id": server.id, "name": server.name}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{server_id}")
async def get_server(server_id: int, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    result = {
        "id": server.id, "name": server.name, "ip": server.ip,
        "os_type": server.os_type, "ssh_port": server.ssh_port,
        "ssh_username": server.ssh_username,
        "tags": server.tags, "status": server.status,
        "cpu_usage": server.cpu_usage, "memory_usage": server.memory_usage,
        "disk_usage": server.disk_usage, "load_average": server.load_average,
        "created_at": server.created_at, "updated_at": server.updated_at
    }
    return {"code": 0, "data": result, "message": "success"}

@router.put("/{server_id}")
async def update_server(server_id: int, data: dict, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    try:
        for key, value in data.items():
            if key == "ssh_password" and value:
                server.ssh_password_enc = encrypt(value)
            elif key == "ssh_key" and value:
                server.ssh_key_enc = encrypt(value)
            elif hasattr(server, key) and key not in ["id", "created_at"]:
                setattr(server, key, value)
        db.commit()
        db.refresh(server)
        return {"code": 0, "data": {"id": server.id}, "message": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{server_id}")
async def delete_server(server_id: int, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    db.delete(server)
    db.commit()
    return {"code": 0, "data": None, "message": "success"}

@router.post("/{server_id}/test-connection")
async def test_connection(server_id: int, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    try:
        import paramiko
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        password = decrypt(server.ssh_password_enc)
        client.connect(
            hostname=server.ip,
            port=server.ssh_port or 22,
            username=server.ssh_username,
            password=password,
            timeout=5
        )
        client.close()
        return {"code": 0, "data": {"status": "ok"}, "message": "Connection successful"}
    except Exception as e:
        return {"code": 1, "data": None, "message": f"Connection failed: {str(e)}"}

@router.post("/{server_id}/collect")
async def collect_metrics(server_id: int, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    try:
        import paramiko
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        password = decrypt(server.ssh_password_enc)
        client.connect(
            hostname=server.ip,
            port=server.ssh_port or 22,
            username=server.ssh_username,
            password=password,
            timeout=10
        )
        # Collect CPU
        stdin, stdout, stderr = client.exec_command("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'.' -f1")
        cpu = int(float(stdout.read().decode().strip() or 0))
        
        # Collect Memory
        stdin, stdout, stderr = client.exec_command("free | grep Mem | awk '{printf \"%.0f\", $3/$2 * 100}'")
        memory = int(float(stdout.read().decode().strip() or 0))
        
        # Collect Disk
        stdin, stdout, stderr = client.exec_command("df -h / | tail -1 | awk '{gsub(/%/,\"\",$5); print $5}'")
        disk = int(float(stdout.read().decode().strip() or 0))
        
        # Collect Load
        stdin, stdout, stderr = client.exec_command("cat /proc/loadavg | awk '{print $1}'")
        load = stdout.read().decode().strip() or "0"
        
        client.close()
        
        server.cpu_usage = cpu
        server.memory_usage = memory
        server.disk_usage = disk
        server.load_average = load
        db.commit()
        
        return {"code": 0, "data": {"cpu": cpu, "memory": memory, "disk": disk, "load": load}, "message": "success"}
    except Exception as e:
        # Update status to error
        server.status = "error"
        db.commit()
        return {"code": 1, "data": None, "message": f"Collection failed: {str(e)}"}

@router.get("/{server_id}/crontab")
async def get_crontab(server_id: int, db: Session = Depends(get_db)):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    try:
        import paramiko
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        password = decrypt(server.ssh_password_enc)
        client.connect(
            hostname=server.ip,
            port=server.ssh_port or 22,
            username=server.ssh_username,
            password=password,
            timeout=10
        )
        stdin, stdout, stderr = client.exec_command("crontab -l")
        output = stdout.read().decode().strip()
        client.close()
        
        crontab_lines = []
        for line in output.split("\n"):
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split()
                if len(parts) >= 6:
                    crontab_lines.append({
                        "schedule": " ".join(parts[0:5]),
                        "command": " ".join(parts[5:]),
                        "user": server.ssh_username
                    })
        return {"code": 0, "data": crontab_lines, "message": "success"}
    except Exception as e:
        return {"code": 1, "data": [], "message": f"Failed: {str(e)}"}
