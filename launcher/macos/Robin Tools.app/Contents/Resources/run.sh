#!/bin/bash

# Robin Tools Launcher for macOS

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# Configuration
INSTALL_DIR="$HOME/.robin-tools"
REPO_URL="https://github.com/robin-guide/tools.git"
FRONTEND_URL="https://upscaler-rho.vercel.app/upscaler"
BACKEND_PORT=8000

clear
echo ""
echo -e "${PURPLE}${BOLD}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║          🐦 Robin Tools               ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"
echo ""

status() { echo -e "  ${CYAN}▸${NC} $1"; }
success() { echo -e "  ${GREEN}✓${NC} $1"; }
error() { echo -e "  ${RED}✗${NC} $1"; }

# Check if backend already running
if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    success "Backend already running!"
    echo ""
    status "Opening browser..."
    open "$FRONTEND_URL"
    echo ""
    echo -e "  ${GREEN}Done!${NC} You can close this window."
    echo ""
    read -p "  Press Enter to exit..."
    exit 0
fi

# Check Python
echo -e "${BOLD}Checking requirements...${NC}"
echo ""
if command -v python3 &> /dev/null; then
    success "Python $(python3 --version 2>&1 | awk '{print $2}') found"
else
    error "Python 3 not found!"
    echo ""
    echo "  Please install Python from: https://www.python.org/downloads/"
    echo ""
    read -p "  Press Enter to exit..."
    exit 1
fi

if command -v git &> /dev/null; then
    success "Git found"
else
    error "Git not found!"
    echo ""
    echo "  Please run: xcode-select --install"
    echo ""
    read -p "  Press Enter to exit..."
    exit 1
fi

echo ""
echo -e "${BOLD}Setting up Robin Tools...${NC}"
echo ""

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
    status "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin main --quiet 2>/dev/null || true
    success "Updated"
else
    status "Downloading Robin Tools..."
    if git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" --quiet; then
        success "Downloaded"
    else
        error "Failed to download. Check your internet connection."
        read -p "  Press Enter to exit..."
        exit 1
    fi
fi

cd "$INSTALL_DIR/backend"

echo ""
echo -e "${BOLD}Setting up Python environment...${NC}"
echo ""

if [ ! -d "venv" ]; then
    status "Creating virtual environment..."
    python3 -m venv venv
    success "Created"
fi

source venv/bin/activate

status "Installing dependencies..."
pip install --quiet --upgrade pip

if pip show diffusers >/dev/null 2>&1; then
    success "Dependencies ready"
else
    echo ""
    echo -e "  ${YELLOW}Installing packages (this takes a few minutes on first run)...${NC}"
    echo ""
    if pip install -r requirements.txt; then
        success "Dependencies installed"
    else
        error "Failed to install dependencies"
        read -p "  Press Enter to exit..."
        exit 1
    fi
fi

echo ""
echo -e "${BOLD}Starting backend server...${NC}"
echo ""

status "Launching..."
python main.py &
BACKEND_PID=$!

status "Waiting for server to start..."
for i in {1..60}; do
    if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    success "Backend running!"
    echo ""
    status "Opening browser..."
    open "$FRONTEND_URL"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${GREEN}✓${NC} ${BOLD}Robin Tools is running!${NC}"
    echo ""
    echo -e "  ${YELLOW}Keep this window open while using the app.${NC}"
    echo -e "  ${YELLOW}Press Ctrl+C or close this window to stop.${NC}"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    wait $BACKEND_PID
else
    error "Failed to start backend"
    echo ""
    echo "  Check the error messages above."
    kill $BACKEND_PID 2>/dev/null
    read -p "  Press Enter to exit..."
    exit 1
fi

