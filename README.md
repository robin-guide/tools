# 🖼️ AI Image Upscaler

A local AI-powered image upscaler with real-time progress streaming. Uses Stable Diffusion x4 Upscaler for ML-enhanced results with Lanczos fallback.

![MPS · ML Ready](https://img.shields.io/badge/MPS-ML%20Ready-green) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![FastAPI](https://img.shields.io/badge/FastAPI-Python-blue)

## Features

- **AI-Powered Upscaling** - Stable Diffusion x4 Upscaler with real-time progress
- **Multi-Device Support** - CUDA, Apple Silicon (MPS), and CPU fallback
- **Real-time Streaming** - Server-Sent Events for live progress updates
- **Compare Mode** - Side-by-side before/after comparison with slider
- **Adjustable Parameters**:
  - **Scale** - 2×, 3×, or 4× output size
  - **Enhance** - Controls inference steps and guidance (quality)
  - **Creativity** - Controls noise level (how much AI reimagines)

## Tech Stack

### Frontend
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Framer Motion

### Backend
- FastAPI (Python)
- Stable Diffusion x4 Upscaler (Hugging Face Diffusers)
- Server-Sent Events for streaming

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- GPU recommended (NVIDIA CUDA or Apple Silicon MPS)

### 1. Clone & Install Frontend

```bash
cd upscaler
npm install
```

### 2. Set Up Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run Both Services

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python main.py
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health and ML model status |
| `/upscale` | POST | Upscale image (non-streaming) |
| `/upscale/stream` | POST | Upscale with SSE progress streaming |
| `/load-model` | POST | Manually trigger ML model loading |

### Upscale Parameters

```typescript
{
  image: File,           // Image file to upscale
  scale: 2 | 3 | 4,      // Output scale factor
  denoise: 0.0 - 1.0,    // Enhancement strength (steps + guidance)
  creativity: 0.0 - 1.0, // AI reimagining level (noise_level)
  use_ml: boolean        // Use ML or force Lanczos
}
```

## Hardware Requirements

| Device | Performance | Notes |
|--------|-------------|-------|
| NVIDIA GPU (8GB+ VRAM) | Best | Full float16, preview images |
| Apple Silicon (M1/M2/M3) | Good | Float32, no previews (memory) |
| CPU | Slow | Falls back to Lanczos only |

## Architecture

```
┌─────────────────┐     SSE Stream      ┌─────────────────┐
│   Next.js UI    │ ◄─────────────────► │  FastAPI Server │
│                 │                      │                 │
│ - Drop zone     │     /upscale/stream  │ - SD Upscaler   │
│ - Progress bar  │                      │ - Lanczos       │
│ - Compare view  │                      │ - Device detect │
└─────────────────┘                      └─────────────────┘
```

## Configuration

### Environment Variables

**Frontend** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Backend** uses auto-detection for device/dtype.

## Development

### Project Structure

```
upscaler/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main UI
│   │   └── globals.css       # Styles
│   ├── components/
│   │   ├── ImageViewer.tsx   # Image display & compare
│   │   └── ...
│   ├── hooks/
│   │   └── useUpscaler.ts    # API hook with SSE
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── backend/
│   ├── main.py               # FastAPI server
│   └── requirements.txt      # Python deps
└── README.md
```

### Key Design Decisions

1. **SSE over WebSockets** - Simpler for one-way progress streaming
2. **Float32 on MPS** - Float16 produces NaN/black images on Apple Silicon
3. **192px input limit on MPS** - Prevents OOM crashes
4. **Final Lanczos resize** - Ensures output matches user's requested scale

## License

MIT

## Credits

- [Stable Diffusion x4 Upscaler](https://huggingface.co/stabilityai/stable-diffusion-x4-upscaler) by Stability AI
- Built by [Robin](https://robin.guide)
