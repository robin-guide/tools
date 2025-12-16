"""
Upscaler Backend
FastAPI server for AI-powered image upscaling
Supports SeedVR2 (best quality) and SD Upscaler with real-time progress streaming
"""

import io
import os
import sys
import json
import base64
import logging
import asyncio
import tempfile
import subprocess
from pathlib import Path
from typing import Optional, Tuple, Literal
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from PIL import Image, ImageEnhance

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Paths
BACKEND_DIR = Path(__file__).parent
SEEDVR2_DIR = BACKEND_DIR / "seedvr2"
SEEDVR2_MODELS_DIR = SEEDVR2_DIR / "models" / "SEEDVR2"

# Global state for ML model
ml_state = {
    "pipeline": None,
    "pipeline_type": None,  # "seedvr2_3b", "seedvr2_7b", "sd_upscaler", "ldsr"
    "device": "cpu",
    "available": False,
    "loading": False,
    "error": None,
    "seedvr2_available": False,
}


def get_device() -> str:
    """Determine the best available device."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


def check_seedvr2_models() -> Tuple[bool, Optional[str]]:
    """Check if SeedVR2 models are available."""
    dit_model = SEEDVR2_MODELS_DIR / "seedvr2_ema_3b_fp16.safetensors"
    vae_model = SEEDVR2_MODELS_DIR / "ema_vae_fp16.safetensors"
    
    if dit_model.exists() and vae_model.exists():
        # Determine model size
        if (SEEDVR2_MODELS_DIR / "seedvr2_ema_7b_fp16.safetensors").exists():
            return True, "seedvr2_7b"
        return True, "seedvr2_3b"
    return False, None


def load_ml_model():
    """Load an ML upscaling model."""
    global ml_state
    
    if ml_state["loading"]:
        return
    
    ml_state["loading"] = True
    logger.info("Checking ML upscaling models...")
    
    try:
        device = get_device()
        ml_state["device"] = device
        logger.info(f"Using device: {device}")
        
        # Check for SeedVR2 models (best quality)
        seedvr2_available, seedvr2_type = check_seedvr2_models()
        ml_state["seedvr2_available"] = seedvr2_available
        
        if seedvr2_available:
            ml_state["pipeline_type"] = seedvr2_type
            ml_state["available"] = True
            ml_state["error"] = None
            logger.info(f"✓ SeedVR2 {seedvr2_type.split('_')[1].upper()} FP16 ready!")
            ml_state["loading"] = False
            return
        
        # Fallback: Try loading SD Upscaler
        import torch
        
        if device == "cuda":
            dtype = torch.float16
        elif device == "mps":
            dtype = torch.float32
        else:
            dtype = torch.float32
        
        try:
            from diffusers import StableDiffusionUpscalePipeline
            
            logger.info("Loading Stable Diffusion x4 Upscaler as fallback...")
            use_fp16_variant = (dtype == torch.float16 and device == "cuda")
            pipeline = StableDiffusionUpscalePipeline.from_pretrained(
                "stabilityai/stable-diffusion-x4-upscaler",
                torch_dtype=dtype,
                variant="fp16" if use_fp16_variant else None,
            )
            
            pipeline = pipeline.to(device)
            if device in ("cuda", "mps"):
                pipeline.enable_attention_slicing()
            
            ml_state["pipeline"] = pipeline
            ml_state["pipeline_type"] = "sd_upscaler"
            ml_state["available"] = True
            ml_state["error"] = None
            logger.info("✓ SD Upscaler loaded (fallback)")
            
        except Exception as e:
            logger.warning(f"SD Upscaler failed: {e}")
            ml_state["error"] = str(e)
            
    except Exception as e:
        ml_state["error"] = str(e)
        logger.error(f"Failed to load ML model: {e}")
    finally:
        ml_state["loading"] = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    import threading
    thread = threading.Thread(target=load_ml_model)
    thread.start()
    yield
    if ml_state["pipeline"] is not None:
        del ml_state["pipeline"]
        ml_state["pipeline"] = None


app = FastAPI(
    title="Upscaler API",
    description="AI-powered image upscaling with SeedVR2 and SD Upscaler",
    version="3.0.0",
    lifespan=lifespan
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UpscaleResponse(BaseModel):
    success: bool
    image_base64: Optional[str] = None
    original_size: Optional[Tuple[int, int]] = None
    upscaled_size: Optional[Tuple[int, int]] = None
    method: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_loading: bool
    model_type: Optional[str] = None
    gpu_available: bool
    device: str
    error: Optional[str] = None


def enhance_image(image: Image.Image, strength: float = 0.3) -> Image.Image:
    """Apply enhancement filters to improve image quality."""
    if strength > 0:
        sharpness = ImageEnhance.Sharpness(image)
        image = sharpness.enhance(1 + strength * 0.5)
        contrast = ImageEnhance.Contrast(image)
        image = contrast.enhance(1 + strength * 0.1)
    return image


def upscale_lanczos(image: Image.Image, scale: int, enhance_strength: float = 0.3) -> Image.Image:
    """High-quality Lanczos upscaling (CPU fallback)."""
    new_width = image.width * scale
    new_height = image.height * scale
    upscaled = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    upscaled = enhance_image(upscaled, enhance_strength)
    return upscaled


def image_to_base64(image: Image.Image, format: str = "JPEG", quality: int = 85) -> str:
    """Convert PIL Image to base64 string."""
    buffer = io.BytesIO()
    if format.upper() == "JPEG":
        image.save(buffer, format="JPEG", quality=quality, optimize=True)
    else:
        image.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')


async def upscale_with_seedvr2(
    image: Image.Image, 
    scale: int, 
    denoise: float,
    color_correction: str = "none",
    progress_callback=None
) -> Image.Image:
    """
    Upscale using SeedVR2 CLI.
    
    Args:
        image: Input PIL Image
        scale: Scale factor (2, 3, or 4)
        denoise: Denoising strength (0-1)
        color_correction: 'none', 'lab', 'wavelet', 'hsv', 'adain'
        progress_callback: Optional callback for progress updates
    """
    # Calculate target resolution
    target_height = image.height * scale
    target_width = image.width * scale
    target_resolution = min(target_height, target_width)
    
    # Create temp files
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as input_file:
        image.save(input_file, format="PNG")
        input_path = input_file.name
    
    output_path = input_path.replace(".png", "_upscaled.png")
    
    try:
        # Build CLI command
        cli_path = SEEDVR2_DIR / "inference_cli.py"
        dit_model = "seedvr2_ema_3b_fp16.safetensors"
        
        # Check for 7B model
        if (SEEDVR2_MODELS_DIR / "seedvr2_ema_7b_fp16.safetensors").exists():
            dit_model = "seedvr2_ema_7b_fp16.safetensors"
        
        cmd = [
            sys.executable, str(cli_path),
            input_path,
            "--dit_model", dit_model,
            "--model_dir", str(SEEDVR2_MODELS_DIR),
            "--resolution", str(target_resolution),
            "--color_correction", color_correction,
            "--output", output_path,
        ]
        
        # Add noise scale based on denoise parameter
        if denoise > 0:
            cmd.extend(["--latent_noise_scale", str(denoise * 0.1)])
        
        logger.info(f"SeedVR2: {image.size} → {target_width}x{target_height} ({scale}x)")
        
        # Run CLI
        if progress_callback:
            progress_callback(0, 4, None, "Starting SeedVR2...")
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        
        # Parse progress from output and capture errors
        current_phase = 0
        output_lines = []
        
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            
            line_str = line.decode('utf-8', errors='ignore').strip()
            if line_str:
                output_lines.append(line_str)
                
                # Log errors for debugging
                if any(keyword in line_str.lower() for keyword in ['error', 'failed', 'oom', 'memory', 'kill', 'allocation']):
                    logger.warning(f"SeedVR2: {line_str}")
                
                # Parse phase progress
                if "Phase 1" in line_str:
                    current_phase = 1
                    if progress_callback:
                        progress_callback(1, 4, None, "VAE Encoding...")
                elif "Phase 2" in line_str:
                    current_phase = 2
                    if progress_callback:
                        progress_callback(2, 4, None, "AI Upscaling...")
                elif "Phase 3" in line_str:
                    current_phase = 3
                    if progress_callback:
                        progress_callback(3, 4, None, "VAE Decoding...")
                elif "Phase 4" in line_str or "completed" in line_str.lower():
                    current_phase = 4
                    if progress_callback:
                        progress_callback(4, 4, None, "Finalizing...")
        
        await process.wait()
        
        if process.returncode != 0:
            error_msg = f"SeedVR2 failed with exit code {process.returncode}"
            # Try to extract useful error from output
            for line in reversed(output_lines[-20:]):  # Last 20 lines, reverse order
                line_lower = line.lower()
                if any(keyword in line_lower for keyword in ['memory', 'oom', 'allocation', 'vram', 'out of memory']):
                    error_msg += f": Memory limit exceeded. Try 2x or 3x scale, or use 'High' quality instead of 'Best'."
                    break
                elif any(keyword in line_lower for keyword in ['error', 'failed', 'exception']):
                    # Extract just the error message, not full traceback
                    if ':' in line and len(line) < 200:
                        error_msg += f": {line}"
                    break
            raise RuntimeError(error_msg)
        
        # Load result
        if not os.path.exists(output_path):
            raise RuntimeError(f"Output file not created: {output_path}")
        
        result = Image.open(output_path).convert("RGB")
        
        # Resize to exact target if needed
        if result.width != target_width or result.height != target_height:
            result = result.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        return result
        
    finally:
        # Cleanup temp files
        try:
            os.unlink(input_path)
            if os.path.exists(output_path):
                os.unlink(output_path)
        except:
            pass


def upscale_sd_with_progress(image: Image.Image, scale: int, denoise: float, creativity: float, progress_callback):
    """SD Upscaler with progress callbacks (fallback when SeedVR2 unavailable)."""
    import torch
    
    pipeline = ml_state["pipeline"]
    if pipeline is None:
        raise RuntimeError("SD model not loaded")
    
    device = ml_state.get("device", "cpu")
    
    original_width, original_height = image.width, image.height
    target_width = original_width * scale
    target_height = original_height * scale
    
    # SD Upscaler limits
    if device == "mps":
        max_input = 192
    else:
        max_input = 384
        
    if image.width > max_input or image.height > max_input:
        ratio = min(max_input / image.width, max_input / image.height)
        image = image.resize(
            (int(image.width * ratio), int(image.height * ratio)),
            Image.Resampling.LANCZOS
        )
    
    prompt = "high quality, detailed, sharp, 4k resolution"
    negative_prompt = "blurry, noise, artifacts, low quality, pixelated"
    
    num_steps = int(20 + denoise * 30)
    noise_level = int(creativity * 100)
    
    def callback_fn(step: int, timestep: int, latents: torch.Tensor):
        progress_callback(step + 1, num_steps, None, f"Step {step + 1}/{num_steps}")
    
    logger.info(f"SD Upscaler: {original_width}x{original_height} → {target_width}x{target_height}")
    
    if device == "mps":
        torch.mps.empty_cache()
    
    with torch.inference_mode():
        result = pipeline(
            prompt=prompt,
            image=image,
            negative_prompt=negative_prompt,
            num_inference_steps=num_steps,
            guidance_scale=7.5 + denoise * 2,
            noise_level=noise_level,
            callback=callback_fn,
            callback_steps=1,
        ).images[0]
    
    if device == "mps":
        torch.mps.empty_cache()
    
    if result.width != target_width or result.height != target_height:
        result = result.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    return result


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check server health and model status."""
    device = get_device()
    return HealthResponse(
        status="healthy",
        model_loaded=ml_state["available"],
        model_loading=ml_state["loading"],
        model_type=ml_state.get("pipeline_type"),
        gpu_available=device in ["cuda", "mps"],
        device=device,
        error=ml_state["error"]
    )


@app.post("/load-model")
async def trigger_model_load():
    """Manually trigger model loading."""
    if ml_state["available"]:
        return {"status": "already_loaded", "message": "Model is already loaded"}
    if ml_state["loading"]:
        return {"status": "loading", "message": "Model is currently loading"}
    
    import threading
    thread = threading.Thread(target=load_ml_model)
    thread.start()
    
    return {"status": "started", "message": "Model loading started"}


@app.post("/download-models")
async def download_models(model_size: str = "3b"):
    """
    Download SeedVR2 models.
    
    Args:
        model_size: "3b" (6.3GB) or "7b" (15GB)
    """
    import subprocess
    import sys
    
    try:
        # Ensure models directory exists
        SEEDVR2_MODELS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Determine which model to download
        if model_size.lower() == "7b":
            dit_model = "seedvr2_ema_7b_fp16.safetensors"
            size_gb = 15
        else:
            dit_model = "seedvr2_ema_3b_fp16.safetensors"
            size_gb = 6.3
        
        vae_model = "ema_vae_fp16.safetensors"
        
        # Check if already downloaded
        dit_path = SEEDVR2_MODELS_DIR / dit_model
        vae_path = SEEDVR2_MODELS_DIR / vae_model
        
        if dit_path.exists() and vae_path.exists():
            return {
                "status": "already_downloaded",
                "message": f"Models already exist ({model_size.upper()})",
                "dit_model": str(dit_path),
                "vae_model": str(vae_path)
            }
        
        # Download using huggingface_hub
        from huggingface_hub import hf_hub_download
        
        logger.info(f"Downloading SeedVR2 {model_size.upper()} model (~{size_gb}GB)...")
        
        # Download VAE first (smaller, required for both)
        if not vae_path.exists():
            logger.info("Downloading VAE model (478MB)...")
            hf_hub_download(
                repo_id='numz/SeedVR2_comfyUI',
                filename=vae_model,
                local_dir=str(SEEDVR2_MODELS_DIR),
                local_dir_use_symlinks=False
            )
            logger.info("✓ VAE downloaded")
        
        # Download DiT model
        if not dit_path.exists():
            logger.info(f"Downloading {model_size.upper()} model (~{size_gb}GB)...")
            hf_hub_download(
                repo_id='numz/SeedVR2_comfyUI',
                filename=dit_model,
                local_dir=str(SEEDVR2_MODELS_DIR),
                local_dir_use_symlinks=False
            )
            logger.info(f"✓ {model_size.upper()} model downloaded")
        
        # Reload model
        import threading
        thread = threading.Thread(target=load_ml_model)
        thread.start()
        
        return {
            "status": "success",
            "message": f"Models downloaded successfully ({model_size.upper()})",
            "dit_model": str(dit_path),
            "vae_model": str(vae_path)
        }
        
    except Exception as e:
        logger.error(f"Model download failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


@app.post("/upscale/stream")
async def upscale_image_stream(
    image: UploadFile = File(...),
    scale: int = Form(default=2, ge=1, le=4),
    denoise: float = Form(default=0.3, ge=0.0, le=1.0),
    creativity: float = Form(default=0.0, ge=0.0, le=1.0),
    use_ml: bool = Form(default=True),
    color_correction: str = Form(default="none")
):
    """
    Upscale an image with real-time progress streaming via SSE.
    
    Returns Server-Sent Events with:
    - type: "progress" - step updates
    - type: "complete" - final result
    - type: "error" - error message
    """
    contents = await image.read()
    
    async def generate_events():
        try:
            pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
            original_size = (pil_image.width, pil_image.height)
            
            yield f"data: {json.dumps({'type': 'start', 'original_size': original_size})}\n\n"
            
            method = "lanczos"
            
            if use_ml and ml_state["available"]:
                try:
                    pipeline_type = ml_state.get("pipeline_type", "")
                    
                    if pipeline_type.startswith("seedvr2"):
                        # Use SeedVR2
                        progress_data = {"step": 0, "total": 4, "message": "Starting..."}
                        
                        def progress_callback(step, total, preview, message):
                            progress_data["step"] = step
                            progress_data["total"] = total
                            progress_data["message"] = message
                        
                        # Run in executor
                        import concurrent.futures
                        loop = asyncio.get_event_loop()
                        
                        with concurrent.futures.ThreadPoolExecutor() as executor:
                            future = loop.run_in_executor(
                                executor,
                                lambda: asyncio.run(upscale_with_seedvr2(
                                    pil_image, scale, denoise, color_correction, progress_callback
                                ))
                            )
                            
                            # Stream progress
                            last_step = -1
                            while not future.done():
                                await asyncio.sleep(0.5)
                                if progress_data["step"] > last_step:
                                    last_step = progress_data["step"]
                                    yield f"data: {json.dumps({'type': 'progress', 'step': progress_data['step'], 'total': progress_data['total'], 'percent': int(progress_data['step'] / progress_data['total'] * 100), 'message': progress_data['message']})}\n\n"
                            
                            upscaled = future.result()
                            method = f"seedvr2 ({pipeline_type.split('_')[1].upper()})"
                    
                    elif ml_state["pipeline"] is not None:
                        # Use SD Upscaler
                        progress_queue = asyncio.Queue()
                        
                        def sync_progress(step, total, preview, message):
                            try:
                                progress_queue.put_nowait({"step": step, "total": total, "message": message})
                            except:
                                pass
                        
                        import concurrent.futures
                        loop = asyncio.get_event_loop()
                        
                        with concurrent.futures.ThreadPoolExecutor() as executor:
                            future = loop.run_in_executor(
                                executor,
                                lambda: upscale_sd_with_progress(pil_image, scale, denoise, creativity, sync_progress)
                            )
                            
                            while not future.done():
                                try:
                                    progress = await asyncio.wait_for(progress_queue.get(), timeout=0.1)
                                    yield f"data: {json.dumps({'type': 'progress', 'step': progress['step'], 'total': progress['total'], 'percent': int(progress['step'] / progress['total'] * 100), 'message': progress['message']})}\n\n"
                                except asyncio.TimeoutError:
                                    continue
                            
                            upscaled = future.result()
                            method = "sd_upscaler"
                    else:
                        raise RuntimeError("No ML model available")
                        
                except Exception as e:
                    logger.warning(f"ML upscale failed: {e}")
                    yield f"data: {json.dumps({'type': 'fallback', 'reason': str(e)})}\n\n"
                    upscaled = upscale_lanczos(pil_image, scale, denoise)
                    method = "lanczos (ml failed)"
            else:
                reason = "model loading" if ml_state["loading"] else "ml unavailable"
                yield f"data: {json.dumps({'type': 'progress', 'step': 1, 'total': 3, 'percent': 33, 'message': 'Resizing...'})}\n\n"
                upscaled = upscale_lanczos(pil_image, scale, denoise)
                method = f"lanczos ({reason})" if use_ml else "lanczos"
                yield f"data: {json.dumps({'type': 'progress', 'step': 3, 'total': 3, 'percent': 100, 'message': 'Done'})}\n\n"
            
            upscaled_size = (upscaled.width, upscaled.height)
            logger.info(f"Complete: {original_size} → {upscaled_size} via {method}")
            
            final_b64 = image_to_base64(upscaled, "PNG")
            
            yield f"data: {json.dumps({'type': 'complete', 'image': final_b64, 'original_size': original_size, 'upscaled_size': upscaled_size, 'method': method})}\n\n"
            
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/upscale", response_model=UpscaleResponse)
async def upscale_image(
    image: UploadFile = File(...),
    scale: int = Form(default=2, ge=1, le=4),
    denoise: float = Form(default=0.3, ge=0.0, le=1.0),
    creativity: float = Form(default=0.0, ge=0.0, le=1.0),
    use_ml: bool = Form(default=True),
    color_correction: str = Form(default="none")
):
    """
    Upscale an image (non-streaming version).
    For real-time progress, use /upscale/stream instead.
    """
    try:
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
        original_size = (pil_image.width, pil_image.height)
        
        method = "lanczos"
        
        if use_ml and ml_state["available"]:
            try:
                pipeline_type = ml_state.get("pipeline_type", "")
                
                if pipeline_type.startswith("seedvr2"):
                    logger.info(f"SeedVR2 upscale: {original_size} → {scale}x")
                    upscaled = await upscale_with_seedvr2(pil_image, scale, denoise, color_correction)
                    method = f"seedvr2 ({pipeline_type.split('_')[1].upper()})"
                elif ml_state["pipeline"] is not None:
                    logger.info(f"SD upscale: {original_size} → {scale}x")
                    upscaled = upscale_sd_with_progress(
                        pil_image, scale, denoise, creativity,
                        lambda s, t, p, m: None
                    )
                    method = "sd_upscaler"
                else:
                    raise RuntimeError("No model available")
            except Exception as e:
                logger.warning(f"ML upscale failed: {e}")
                upscaled = upscale_lanczos(pil_image, scale, denoise)
                method = "lanczos (ml failed)"
        else:
            if use_ml and not ml_state["available"]:
                if ml_state["loading"]:
                    method = "lanczos (model loading)"
                else:
                    method = "lanczos (ml unavailable)"
            logger.info(f"Lanczos upscale: {original_size} → {scale}x")
            upscaled = upscale_lanczos(pil_image, scale, denoise)
        
        upscaled_size = (upscaled.width, upscaled.height)
        logger.info(f"Complete: {original_size} → {upscaled_size} via {method}")
        
        image_b64 = image_to_base64(upscaled, "PNG")
        
        return UpscaleResponse(
            success=True,
            image_base64=image_b64,
            original_size=original_size,
            upscaled_size=upscaled_size,
            method=method
        )
        
    except Exception as e:
        logger.error(f"Upscale failed: {e}")
        return UpscaleResponse(
            success=False,
            error=str(e)
        )


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Upscaler API",
        "version": "3.0.0",
        "ml_status": {
            "available": ml_state["available"],
            "loading": ml_state["loading"],
            "pipeline_type": ml_state.get("pipeline_type"),
            "device": ml_state["device"],
            "seedvr2_available": ml_state.get("seedvr2_available", False),
            "error": ml_state["error"]
        },
        "endpoints": {
            "/health": "GET - Check server status",
            "/upscale": "POST - Upscale an image",
            "/upscale/stream": "POST - Upscale with SSE progress streaming",
            "/load-model": "POST - Manually trigger model loading"
        }
    }


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Upscaler Backend v3.0 with SeedVR2 support...")
    logger.info(f"Device: {get_device()}")
    logger.info(f"SeedVR2 models dir: {SEEDVR2_MODELS_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
