#!/bin/bash

# Build script for Robin Tools launchers
# Creates distributable zip files for each platform

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BUILD_DIR="$SCRIPT_DIR/dist"

echo "Building Robin Tools launchers..."
echo ""

# Clean previous builds
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Build macOS
echo "📦 Building macOS launcher..."
cd "$SCRIPT_DIR/macos"

# Create zip with the .app
zip -r "$BUILD_DIR/Robin-Tools-macOS.zip" "Robin Tools.app" -x "*.DS_Store"

# Also include the .command file as alternative
zip -j "$BUILD_DIR/Robin-Tools-macOS.zip" "Robin Tools.command"

echo "   ✓ Created Robin-Tools-macOS.zip"

echo ""
echo "✅ Build complete!"
echo ""
echo "Output files:"
ls -la "$BUILD_DIR"

