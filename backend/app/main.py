from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.routers import server, database, alert, job, sql_note, plan_task, settings, cockpit
import os

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="运维工作平台 (Ops Work Platform)",
    description="A local operations management platform",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(server.router, prefix="/api/v1/servers", tags=["Servers"])
app.include_router(database.router, prefix="/api/v1/databases", tags=["Databases"])
app.include_router(alert.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(job.router, prefix="/api/v1/jobs", tags=["Jobs"])
app.include_router(sql_note.router, prefix="/api/v1/sql-notes", tags=["SQL Notes"])
app.include_router(plan_task.router, prefix="/api/v1/plan-tasks", tags=["Plan Tasks"])
app.include_router(settings.router, prefix="/api/v1/settings", tags=["Settings"])
app.include_router(cockpit.router, prefix="/api/v1/cockpit", tags=["Cockpit"])

@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "service": "ops-platform"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
