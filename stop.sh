#!/bin/bash
# Ops Platform Stop Script

echo "Stopping Ops Platform..."

# Kill backend
if [ -f /workspace/backend/data/app.db ]; then
    pkill -f "python -m app.main" 2>/dev/null
    echo "Backend stopped."
fi

# Kill frontend
pkill -f "vite" 2>/dev/null
echo "Frontend stopped."

echo "All services stopped."
