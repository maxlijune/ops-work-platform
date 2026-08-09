#!/bin/bash
# Ops Platform Backend Start Script

cd "$(dirname "$0")"

echo "Starting Ops Platform Backend..."
echo "Data directory: $(pwd)/data"

# Check if data directory exists
mkdir -p data

# Start the backend server
python -m app.main &
BACKEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Backend API: http://localhost:8000"
echo "Swagger UI: http://localhost:8000/docs"

# Wait for backend to start
sleep 2

# Check if backend started successfully
if curl -s http://localhost:8000/api/v1/health > /dev/null 2>&1; then
    echo "Backend started successfully!"
else
    echo "Warning: Backend health check failed, but process is running..."
fi

echo ""
echo "To stop the backend, run: kill $BACKEND_PID"
echo "Or use the stop.sh script."
