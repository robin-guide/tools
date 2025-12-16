# Upscaler - macOS Installer

AI-powered image upscaling on your Mac. Everything runs locally for privacy and speed.

---

## Quick Start

1. **Download** the latest `Upscaler-macOS.zip` from [Releases](https://github.com/robin-guide/tools/releases)
2. **Unzip** the file
3. **Right-click** `Upscaler.app` → select **"Open"** (first time only)
4. Wait for setup to complete — the app will open in your browser automatically

**That's it!** The app handles all the technical setup for you.

---

## First-Time Setup (Security)

macOS may block the app because it's not from the App Store. Here's how to allow it:

### Method 1: Right-Click to Open

1. **Right-click** (or Control-click) on `Upscaler.app`
2. Select **"Open"** from the menu
3. Click **"Open"** in the dialog that appears

This only needs to be done once.

### Method 2: System Settings

If Method 1 doesn't work:

1. Go to **System Settings** → **Privacy & Security**
2. Scroll down to the **Security** section
3. You'll see a message about "Upscaler" being blocked
4. Click **"Open Anyway"**
5. Enter your password if prompted

![Security Settings](https://support.apple.com/library/content/dam/edam/applecare/images/en_US/macos/sonoma/macos-sonoma-system-settings-privacy-security-open-anyway.png)

---

## Requirements

- **macOS 10.15** (Catalina) or later
- **Python 3.9+** - [Download Python](https://www.python.org/downloads/)
- **Git** - Usually pre-installed, or `brew install git`

### Apple Silicon (M1/M2/M3) Users

For best performance, install Python via Homebrew:

```bash
brew install python@3.11
```

This ensures you get native ARM64 Python instead of the x86 version running under Rosetta.

---

## What It Does

When you launch `Upscaler.app`, it automatically:

1. ✅ Checks for Python and Git (installs if needed)
2. ✅ Downloads/updates the backend code
3. ✅ Sets up a Python virtual environment
4. ✅ Installs required dependencies (~5-10 minutes first time)
5. ✅ Starts the backend server
6. ✅ Opens your browser to the Upscaler interface

**Note:** AI models (6-15GB) are downloaded separately when you first use AI upscaling. The app works without them, but AI enhancement requires a one-time download.

---

## Troubleshooting

### "Python not found"

Install Python from [python.org](https://www.python.org/downloads/) or via Homebrew:

```bash
brew install python@3.11
```

### "Architecture mismatch" errors

On Apple Silicon Macs, you may have x86 Python installed via Rosetta. Fix by installing native Python:

```bash
# Remove old installation
rm -rf ~/.upscaler

# Install native Python
brew install python@3.11

# Re-run Upscaler.app
```

### "Server failed to start"

1. Check if port 8000 is already in use:
   ```bash
   lsof -i:8000
   ```

2. Kill any existing process:
   ```bash
   lsof -ti:8000 | xargs kill -9
   ```

3. Try running again

### Backend shows "Lanczos only" (no AI)

This means AI models haven't been downloaded yet. You have two options:

**Option 1: Download via web interface (easiest)**
1. Open the Upscaler web app
2. You'll see a prompt to download models
3. Choose 3B (6.3GB) or 7B (15GB) model
4. Wait for download to complete

**Option 2: Download via API**
```bash
# 3B model (recommended for most users)
curl -X POST http://localhost:8000/download-models?model_size=3b

# 7B model (best quality, needs more RAM)
curl -X POST http://localhost:8000/download-models?model_size=7b
```

The app works fine without AI models—you'll just get basic Lanczos upscaling instead of AI enhancement.

---

## Manual Installation (Advanced)

If you prefer the command line:

```bash
# Clone the repo
git clone https://github.com/robin-guide/tools.git ~/.upscaler
cd ~/.upscaler/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python main.py
```

Then open: https://upscaler-rho.vercel.app/upscaler

---

## Uninstall

To completely remove Upscaler:

```bash
rm -rf ~/.upscaler
```

---

## Links

- **Web App**: https://upscaler-rho.vercel.app/upscaler
- **GitHub**: https://github.com/robin-guide/tools
- **Issues**: https://github.com/robin-guide/tools/issues





