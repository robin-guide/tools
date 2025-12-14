#!/bin/bash

# AI Upscaler Backend Setup Script
# Run with: curl -fsSL https://raw.githubusercontent.com/robin-guide/tools/main/scripts/setup.sh | bash

set -e

echo ""
echo "🖼️  AI Upscaler Backend Setup"
echo "=============================="
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "   Install from: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "✓ Python $PYTHON_VERSION found"

# Check for Git
if ! command -v git &> /dev/null; then
    echo "❌ Git is required but not installed."
    exit 1
fi
echo "✓ Git found"

# Create directory
INSTALL_DIR="$HOME/ai-upscaler"
if [ -d "$INSTALL_DIR" ]; then
    echo ""
    echo "📁 Found existing installation at $INSTALL_DIR"
    read -p "   Update and restart? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$INSTALL_DIR"
        git pull origin main 2>/dev/null || true
    else
        exit 0
    fi
else
    echo ""
    echo "📥 Cloning repository..."
    git clone --depth 1 https://github.com/robin-guide/tools.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Setup backend
echo ""
echo "🐍 Setting up Python environment..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate

echo "📦 Installing dependencies (this may take a moment)..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "=============================="
echo ""
echo "🚀 Starting backend server..."
echo "   The ML model (~5GB) will download on first run."
echo ""
echo "   Press Ctrl+C to stop the server."
echo ""
echo "=============================="
echo ""

# Start the server
python main.py








