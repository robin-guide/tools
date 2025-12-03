# 🐦 Robin Tools

AI-powered creative tools that run locally on your machine. No cloud uploads, no subscriptions.

![Open Source](https://img.shields.io/badge/Open%20Source-Local%20First-green) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![FastAPI](https://img.shields.io/badge/FastAPI-Python-blue)

## 🚀 Quick Start (No Terminal Required!)

### macOS Users

1. **[Download Robin Tools for macOS](https://github.com/robin-guide/tools/releases/latest/download/Robin-Tools-macOS.zip)**
2. Unzip the file
3. Double-click **"Robin Tools.app"**
4. That's it! The app handles everything automatically.

> **Note:** On first launch, the app will download dependencies (~5GB for the ML model). This takes a few minutes.

### Or Use the Web Interface

Visit **[upscaler-rho.vercel.app](https://upscaler-rho.vercel.app)** and follow the guided setup.

---

## 🛠️ Available Tools

### 🖼️ Image Upscaler
AI-powered image upscaling with real-time progress. Uses Stable Diffusion x4 Upscaler for ML-enhanced results.

**Features:**
- **AI-Powered Upscaling** - Real-time progress streaming
- **Multi-Device Support** - NVIDIA CUDA, Apple Silicon (MPS), and CPU
- **Compare Mode** - Side-by-side before/after comparison
- **Adjustable Parameters** - Scale (2×-4×), Enhancement, Creativity

### 🔜 Background Remover
*Coming soon*

### 🔜 Colorizer
*Coming soon*

---

## 💻 Manual Setup (For Developers)

### Prerequisites
- Python 3.10+
- Node.js 18+ (if running frontend locally)
- GPU recommended (NVIDIA CUDA or Apple Silicon MPS)

### Option 1: One-Liner Setup

```bash
curl -fsSL https://raw.githubusercontent.com/robin-guide/tools/main/scripts/setup.sh | bash
```

### Option 2: Step by Step

```bash
# Clone
git clone https://github.com/robin-guide/tools.git
cd tools

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start backend
python main.py
```

Then open [upscaler-rho.vercel.app/upscaler](https://upscaler-rho.vercel.app/upscaler)

---

## 📚 API Reference

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health and ML model status |
| `/upscale` | POST | Upscale image (non-streaming) |
| `/upscale/stream` | POST | Upscale with SSE progress streaming |

### Upscale Parameters

```typescript
{
  image: File,           // Image file to upscale
  scale: 2 | 3 | 4,      // Output scale factor
  denoise: 0.0 - 1.0,    // Enhancement strength
  creativity: 0.0 - 1.0, // AI reimagining level
  use_ml: boolean        // Use ML or force Lanczos
}
```

---

## 🔧 Hardware Requirements

| Device | Performance | Notes |
|--------|-------------|-------|
| NVIDIA GPU (8GB+ VRAM) | Best | Full float16 support |
| Apple Silicon (M1/M2/M3) | Good | Float32, optimized for MPS |
| CPU | Slow | Falls back to Lanczos only |

---

## 🏗️ Architecture

```
┌─────────────────┐                      ┌─────────────────┐
│   Robin Tools   │     SSE Stream       │  FastAPI Server │
│   (Next.js)     │ ◄──────────────────► │  (Python)       │
│                 │                      │                 │
│  • Tool gallery │                      │  • ML inference │
│  • Real-time UI │                      │  • Device detect│
│  • Compare view │                      │  • Progress SSE │
└─────────────────┘                      └─────────────────┘
        │                                        │
        │ Hosted on Vercel                       │ Runs locally
        │ (no data leaves your machine)          │ on your GPU
```

---

## 📂 Project Structure

```
robin-tools/
├── src/app/
│   ├── page.tsx              # Tools gallery
│   └── upscaler/page.tsx     # Upscaler tool
├── backend/
│   ├── main.py               # FastAPI server
│   └── requirements.txt
├── launcher/
│   └── macos/                # macOS app bundle
└── scripts/
    └── setup.sh              # One-liner installer
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

---

## 📜 License

MIT

---

## 🙏 Credits

- [Stable Diffusion x4 Upscaler](https://huggingface.co/stabilityai/stable-diffusion-x4-upscaler) by Stability AI
- Built by [Robin](https://robin.guide)
