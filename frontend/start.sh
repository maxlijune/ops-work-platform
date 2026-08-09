#!/bin/bash
# Ops Platform Frontend Start Script

cd "$(dirname "$0")"

echo "Starting Ops Platform Frontend..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the frontend dev server
npm run dev &
FRONTEND_PID=$!

echo "Frontend PID: $FRONTEND_PID"
echo "Frontend URL: http://localhost:5173"

sleep 2
echo ""
echo "To stop the frontend, run: kill $FRONTEND_PID"
