#!/bin/bash

# Qwen Upscaler - Start Script
# Starts both frontend and backend servers

set -e

echo "🚀 Starting Qwen Upscaler..."
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.10+"
    exit 1
fi

# Check if Node is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Start backend
echo "📦 Starting Python backend..."
cd backend

# Create venv if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Start backend in background
python main.py &
BACKEND_PID=$!
cd ..

echo "✅ Backend starting on http://localhost:8000"
echo ""

# Wait for backend to be ready
echo "⏳ Waiting for backend..."
sleep 3

# Start frontend
echo "🎨 Starting Next.js frontend..."

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Frontend starting on http://localhost:3000"
echo ""
echo "═══════════════════════════════════════════"
echo "🖼️  Qwen Upscaler is ready!"
echo "   Open http://localhost:3000 in your browser"
echo ""
echo "   Press Ctrl+C to stop both servers"
echo "═══════════════════════════════════════════"

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait











