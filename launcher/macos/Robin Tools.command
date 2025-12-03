#!/bin/bash

# Robin Tools Launcher for macOS
# Double-click this file to start Robin Tools

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
INSTALL_DIR="$HOME/.robin-tools"
REPO_URL="https://github.com/robin-guide/tools.git"
FRONTEND_URL="https://upscaler-rho.vercel.app/upscaler"
BACKEND_PORT=8000

# Clear screen and show banner
clear
echo ""
echo -e "${PURPLE}${BOLD}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║                                       ║"
echo "  ║          🐦 Robin Tools               ║"
echo "  ║                                       ║"
echo "  ║    AI-powered creative tools          ║"
echo "  ║    that run locally on your Mac       ║"
echo "  ║                                       ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Function to print status
status() {
    echo -e "  ${CYAN}▸${NC} $1"
}

success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

error() {
    echo -e "  ${RED}✗${NC} $1"
}

warning() {
    echo -e "  ${YELLOW}!${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if backend is running
backend_running() {
    curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1
}

# Function to wait for backend
wait_for_backend() {
    local max_attempts=60
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if backend_running; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# Function to open browser
open_browser() {
    sleep 2
    open "$FRONTEND_URL"
}

# Check if backend is already running
if backend_running; then
    success "Backend already running!"
    echo ""
    status "Opening Robin Tools in your browser..."
    open_browser
    echo ""
    success "Done! You can close this window."
    echo ""
    echo -e "  ${BOLD}Press any key to exit...${NC}"
    read -n 1
    exit 0
fi

# Step 1: Check for Python
echo -e "${BOLD}Checking requirements...${NC}"
echo ""

if command_exists python3; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    success "Python $PYTHON_VERSION found"
else
    error "Python 3 not found"
    echo ""
    echo -e "  ${YELLOW}Python is required to run Robin Tools.${NC}"
    echo ""
    echo "  To install Python:"
    echo "    1. Visit https://www.python.org/downloads/"
    echo "    2. Download Python 3.10 or newer"
    echo "    3. Run the installer"
    echo "    4. Re-run this launcher"
    echo ""
    echo -e "  Or install via Homebrew: ${CYAN}brew install python${NC}"
    echo ""
    echo -e "  ${BOLD}Press any key to exit...${NC}"
    read -n 1
    exit 1
fi

# Check for Git
if command_exists git; then
    success "Git found"
else
    error "Git not found"
    echo ""
    echo -e "  ${YELLOW}Git is required to download Robin Tools.${NC}"
    echo ""
    echo "  To install Git:"
    echo "    • Install Xcode Command Line Tools: ${CYAN}xcode-select --install${NC}"
    echo "    • Or install via Homebrew: ${CYAN}brew install git${NC}"
    echo ""
    echo -e "  ${BOLD}Press any key to exit...${NC}"
    read -n 1
    exit 1
fi

echo ""

# Step 2: Download or update the code
echo -e "${BOLD}Setting up Robin Tools...${NC}"
echo ""

if [ -d "$INSTALL_DIR" ]; then
    status "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin main --quiet 2>/dev/null || true
    success "Updated to latest version"
else
    status "Downloading Robin Tools..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" --quiet
    success "Downloaded successfully"
fi

cd "$INSTALL_DIR/backend"

echo ""

# Step 3: Set up Python environment
echo -e "${BOLD}Setting up Python environment...${NC}"
echo ""

if [ ! -d "venv" ]; then
    status "Creating virtual environment..."
    python3 -m venv venv
    success "Virtual environment created"
fi

source venv/bin/activate

status "Checking dependencies..."
pip install --quiet --upgrade pip

# Check if requirements are already installed
if pip show diffusers >/dev/null 2>&1; then
    success "Dependencies already installed"
else
    echo ""
    warning "Installing dependencies (this may take a few minutes on first run)..."
    echo ""
    pip install --quiet -r requirements.txt
    success "Dependencies installed"
fi

echo ""

# Step 4: Start the backend
echo -e "${BOLD}Starting AI backend...${NC}"
echo ""

status "Launching backend server..."

# Start backend in background
python main.py &
BACKEND_PID=$!

# Wait for backend to be ready
status "Waiting for backend to initialize..."

if wait_for_backend; then
    success "Backend is running!"
else
    error "Backend failed to start"
    echo ""
    echo "  Check the error messages above for details."
    echo ""
    echo -e "  ${BOLD}Press any key to exit...${NC}"
    read -n 1
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""

# Step 5: Open browser
echo -e "${BOLD}Opening Robin Tools...${NC}"
echo ""

status "Opening in your default browser..."
open_browser
success "Browser opened!"

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}✓${NC} ${BOLD}Robin Tools is running!${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC} $FRONTEND_URL"
echo -e "  ${CYAN}Backend:${NC}  http://localhost:$BACKEND_PORT"
echo ""
echo -e "  ${YELLOW}Keep this window open while using Robin Tools.${NC}"
echo -e "  ${YELLOW}Close this window or press Ctrl+C to stop.${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""

# Keep running until user closes
trap "kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID

