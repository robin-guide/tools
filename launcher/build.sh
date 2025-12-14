#!/bin/bash

# Build script for Upscaler launcher
# Creates distributable zip files for macOS

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BUILD_DIR="$SCRIPT_DIR/dist"

echo "Building Upscaler launcher..."
echo ""

# Clean previous builds
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Build macOS
echo "📦 Building macOS launcher..."
cd "$SCRIPT_DIR/macos"

# Make launcher executable
chmod +x "Upscaler.app/Contents/MacOS/launcher"
chmod +x "Upscaler.app/Contents/Resources/run.sh"

# Create zip with the .app
zip -r "$BUILD_DIR/Upscaler-macOS.zip" "Upscaler.app" -x "*.DS_Store"

echo "   ✓ Created Upscaler-macOS.zip"

echo ""
echo "✅ Build complete!"
echo ""
echo "Output files:"
ls -la "$BUILD_DIR"
