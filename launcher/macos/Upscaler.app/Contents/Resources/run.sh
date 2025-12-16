#!/bin/bash

# ============================================================
#  Upscaler - AI Image Upscaling
#  https://upscaler-rho.vercel.app
# ============================================================

set -e

INSTALL_DIR="$HOME/.upscaler"
REPO_URL="https://github.com/robin-guide/tools.git"
BACKEND_PORT=8000
FRONTEND_URL="https://upscaler-rho.vercel.app/upscaler"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Print header
clear
echo ""
echo -e "${CYAN}  ╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║        ${BOLD}🔍 Upscaler${NC}${CYAN}                    ║${NC}"
echo -e "${CYAN}  ║        ${NC}AI Image Enhancement${CYAN}            ║${NC}"
echo -e "${CYAN}  ╚═══════════════════════════════════════╝${NC}"
echo ""

# Helper functions
print_step() {
    echo -e "  ${BLUE}▸${NC} $1"
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}!${NC} $1"
}

# Error handler
handle_error() {
    echo ""
    print_error "Something went wrong!"
    echo ""
    echo -e "  ${YELLOW}Common fixes:${NC}"
    echo "  1. Make sure you have Python 3.9+ installed"
    echo "  2. Check your internet connection"
    echo "  3. Try running again"
    echo ""
    echo -e "  ${CYAN}Need help?${NC} Check the README or open an issue:"
    echo "  https://github.com/robin-guide/tools"
    echo ""
    echo "Press any key to close..."
    read -n 1
    exit 1
}

trap handle_error ERR

# ============================================================
# Check requirements
# ============================================================
echo -e "${BOLD}Checking requirements...${NC}"
echo ""

# Find the best Python - prefer native ARM64 on Apple Silicon
find_python() {
    local arch=$(uname -m)
    
    # Check for Homebrew Python first (usually native)
    if [ -x "/opt/homebrew/bin/python3" ]; then
        echo "/opt/homebrew/bin/python3"
        return
    fi
    
    # Check for python3 in PATH
    if command -v python3 &> /dev/null; then
        local py_path=$(which python3)
        # On Apple Silicon, verify it's native
        if [ "$arch" = "arm64" ]; then
            local py_arch=$(file "$py_path" 2>/dev/null | grep -o 'arm64\|x86_64' | head -1)
            if [ "$py_arch" = "arm64" ]; then
                echo "$py_path"
                return
            fi
            # Try to find a native version
            if [ -x "/usr/local/bin/python3" ]; then
                echo "/usr/local/bin/python3"
                return
            fi
        fi
        echo "$py_path"
        return
    fi
    
    # Fallback to python
    if command -v python &> /dev/null; then
        echo "python"
        return
    fi
    
    return 1
}

PYTHON_CMD=$(find_python)

if [ -z "$PYTHON_CMD" ]; then
    print_error "Python not found!"
    echo ""
    echo "  Please install Python 3.9 or later:"
    echo "  ${CYAN}https://www.python.org/downloads/${NC}"
    echo ""
    echo "  Or install via Homebrew:"
    echo "  ${CYAN}brew install python@3.11${NC}"
    echo ""
    echo "Press any key to close..."
    read -n 1
    exit 1
fi

# Get Python version
PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | cut -d' ' -f2)
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

# Check minimum version (3.9)
if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 9 ]); then
    print_error "Python $PYTHON_VERSION is too old (need 3.9+)"
    echo ""
    echo "  Please upgrade Python:"
    echo "  ${CYAN}brew install python@3.11${NC}"
    echo ""
    echo "Press any key to close..."
    read -n 1
    exit 1
fi

# Show Python path for debugging
print_success "Python $PYTHON_VERSION found"
echo -e "    ${CYAN}($PYTHON_CMD)${NC}"

# Check architecture on Apple Silicon
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    PY_ARCH=$(file "$PYTHON_CMD" 2>/dev/null | grep -o 'arm64\|x86_64' | head -1)
    if [ "$PY_ARCH" = "x86_64" ]; then
        print_warning "Python is running in x86 mode (Rosetta)"
        echo -e "    For best performance, install native ARM64 Python:"
        echo -e "    ${CYAN}brew install python@3.11${NC}"
    else
        print_success "Native Apple Silicon detected"
    fi
fi

# Check for git
if command -v git &> /dev/null; then
    print_success "Git found"
else
    print_error "Git not found!"
    echo ""
    echo "  Please install Git:"
    echo "  ${CYAN}brew install git${NC}"
    echo ""
    echo "Press any key to close..."
    read -n 1
    exit 1
fi

echo ""

# ============================================================
# Setup installation
# ============================================================
echo -e "${BOLD}Setting up Upscaler...${NC}"
echo ""

if [ -d "$INSTALL_DIR" ]; then
    print_step "Updating existing installation..."
    cd "$INSTALL_DIR"
    git fetch origin main --quiet 2>/dev/null || true
    git reset --hard origin/main --quiet 2>/dev/null || true
    print_success "Updated"
else
    print_step "Downloading Upscaler..."
    git clone --quiet "$REPO_URL" "$INSTALL_DIR" 2>/dev/null
    cd "$INSTALL_DIR"
    print_success "Downloaded"
fi

echo ""

# ============================================================
# Setup Python environment
# ============================================================
echo -e "${BOLD}Setting up Python environment...${NC}"
echo ""

cd "$INSTALL_DIR/backend"

# Always recreate venv to ensure correct architecture
if [ -d "venv" ]; then
    # Check if existing venv has wrong architecture
    if [ -f "venv/bin/python" ]; then
        VENV_ARCH=$(file "venv/bin/python" 2>/dev/null | grep -o 'arm64\|x86_64' | head -1)
        if [ "$ARCH" = "arm64" ] && [ "$VENV_ARCH" = "x86_64" ]; then
            print_step "Removing incompatible environment..."
            rm -rf venv
        fi
    fi
fi

if [ ! -d "venv" ]; then
    print_step "Creating virtual environment..."
    "$PYTHON_CMD" -m venv venv
    print_success "Environment created"
fi

# Activate and install
source venv/bin/activate

print_step "Installing dependencies (this may take a few minutes)..."
pip install --upgrade pip --quiet 2>/dev/null
pip install -r requirements.txt --quiet 2>/dev/null
print_success "Dependencies ready"

echo ""

# ============================================================
# Start backend
# ============================================================
echo -e "${BOLD}Starting backend server...${NC}"
echo ""

# Kill any existing server
lsof -ti:$BACKEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

print_step "Launching server..."
python main.py &
BACKEND_PID=$!

# Wait for server to start
print_step "Waiting for server..."
MAX_WAIT=30
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    print_error "Server failed to start"
    echo ""
    echo "  Check the error messages above for details."
    echo ""
    echo "Press any key to close..."
    read -n 1
    exit 1
fi

print_success "Server running on port $BACKEND_PORT"

# Check ML status
HEALTH=$(curl -s "http://localhost:$BACKEND_PORT/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"model_loaded":true'; then
    print_success "AI model loaded and ready!"
elif echo "$HEALTH" | grep -q '"model_loading":true'; then
    print_step "AI model is loading in background..."
else
    print_warning "Running in basic mode (no AI)"
fi

echo ""

# ============================================================
# Open browser
# ============================================================
echo -e "${BOLD}Opening Upscaler...${NC}"
echo ""

print_step "Opening browser..."
sleep 1
open "$FRONTEND_URL"
print_success "Ready!"

echo ""
echo -e "  ${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "  ${GREEN}║  ✨ Upscaler is running!              ║${NC}"
echo -e "  ${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC} $FRONTEND_URL"
echo -e "  ${CYAN}Backend:${NC}  http://localhost:$BACKEND_PORT"
echo ""
echo -e "  ${YELLOW}Keep this window open while using Upscaler.${NC}"
echo -e "  ${YELLOW}Close this window or press Ctrl+C to stop.${NC}"
echo ""

# Wait for user to close
wait $BACKEND_PID 2>/dev/null || true





