#!/bin/bash
# Ops Platform Unified Start Script

echo "========================================"
echo "  运维工作平台 (Ops Work Platform)"
echo "========================================"
echo ""

# Get the base directory
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Start backend
echo "[1/2] Starting backend..."
cd "$BASE_DIR/backend"
python -m app.main &
BACKEND_PID=$!
cd "$BASE_DIR"

# Wait for backend
sleep 3

# Start frontend
echo "[2/2] Starting frontend..."
cd "$BASE_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run dev &
FRONTEND_PID=$!
cd "$BASE_DIR"

echo ""
echo "========================================"
echo "  平台已启动！"
echo "========================================"
echo ""
echo "  前端页面: http://localhost:5173"
echo "  后端API:  http://localhost:8000"
echo "  API文档:  http://localhost:8000/docs"
echo ""
echo "  后端 PID:  $BACKEND_PID"
echo "  前端 PID:  $FRONTEND_PID"
echo ""
echo "  停止平台:  kill $BACKEND_PID $FRONTEND_PID"
echo "  或使用:   ./stop.sh"
echo "========================================"

# Open browser if possible
sleep 1
if command -v xdg-open > /dev/null 2>&1; then
    xdg-open http://localhost:5173 2>/dev/null &
fi

# Wait for both processes
wait
