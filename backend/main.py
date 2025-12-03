"""
Qwen-Edit Upscaler Backend
FastAPI server for AI-powered image upscaling
Uses Stable Diffusion x4 Upscaler with real-time progress streaming
"""

import io
import json
import base64
import logging
import asyncio
from typing import Optional, Tuple
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from PIL import Image, ImageEnhance

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state for ML model
ml_state = {
    "pipeline": None,
    "pipeline_type": None,
    "device": "cpu",
    "available": False,
    "loading": False,
    "error": None
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


def load_ml_model():
    """Load an ML upscaling model."""
    global ml_state
    
    if ml_state["loading"]:
        return
    
    ml_state["loading"] = True
    logger.info("Loading ML upscaling model...")
    
    try:
        import torch
        
        device = get_device()
        ml_state["device"] = device
        
        logger.info(f"Using device: {device}")
        
        # Determine dtype based on device
        # MPS needs float32 - float16 produces NaN/black images
        if device == "cuda":
            dtype = torch.float16
        elif device == "mps":
            dtype = torch.float32  # MPS float16 is buggy
        else:
            dtype = torch.float32
        
        # Try Stable Diffusion x4 Upscaler (publicly available, no auth needed)
        try:
            from diffusers import StableDiffusionUpscalePipeline
            
            logger.info("Loading Stable Diffusion x4 Upscaler...")
            # Only use fp16 variant on CUDA, not MPS
            use_fp16_variant = (dtype == torch.float16 and device == "cuda")
            pipeline = StableDiffusionUpscalePipeline.from_pretrained(
                "stabilityai/stable-diffusion-x4-upscaler",
                torch_dtype=dtype,
                variant="fp16" if use_fp16_variant else None,
            )
            
            # Move to device
            pipeline = pipeline.to(device)
            
            # Memory optimizations for GPU devices
            if device in ("cuda", "mps"):
                pipeline.enable_attention_slicing()
            
            ml_state["pipeline"] = pipeline
            ml_state["pipeline_type"] = "sd_upscaler"
            ml_state["available"] = True
            ml_state["error"] = None
            logger.info("✓ Stable Diffusion x4 Upscaler loaded!")
            
        except Exception as e:
            logger.warning(f"SD Upscaler failed: {e}")
            
            # Fallback: Try LDSR (Latent Diffusion Super Resolution)
            try:
                from diffusers import LDMSuperResolutionPipeline
                
                logger.info("Trying LDSR model as fallback...")
                pipeline = LDMSuperResolutionPipeline.from_pretrained(
                    "CompVis/ldm-super-resolution-4x-openimages",
                    torch_dtype=dtype,
                )
                pipeline = pipeline.to(device)
                
                ml_state["pipeline"] = pipeline
                ml_state["pipeline_type"] = "ldsr"
                ml_state["available"] = True
                ml_state["error"] = None
                logger.info("✓ LDSR model loaded!")
                
            except Exception as e2:
                raise Exception(f"All ML models failed: SD={e}, LDSR={e2}")
        
    except ImportError as e:
        ml_state["error"] = f"Missing dependencies: {e}"
        logger.error(f"ML dependencies not installed: {e}")
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
    title="Qwen Upscaler API",
    description="AI-powered image upscaling with real-time progress",
    version="2.1.0",
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


def decode_latents_to_image(pipeline, latents):
    """Decode latents to a viewable image."""
    import torch
    
    # Scale latents (0.18215 is the SD VAE scaling factor)
    VAE_SCALING_FACTOR = 0.18215
    latents = 1 / VAE_SCALING_FACTOR * latents
    
    with torch.no_grad():
        image = pipeline.vae.decode(latents).sample
    
    # Convert to PIL
    image = (image / 2 + 0.5).clamp(0, 1)
    image = image.cpu().permute(0, 2, 3, 1).numpy()
    image = (image * 255).round().astype("uint8")
    image = Image.fromarray(image[0])
    
    return image


def upscale_ml_with_progress(image: Image.Image, scale: int, denoise: float, creativity: float, progress_callback):
    """AI-powered upscaling with progress callbacks."""
    import torch
    
    pipeline = ml_state["pipeline"]
    if pipeline is None:
        raise RuntimeError("ML model not loaded")
    
    pipeline_type = ml_state.get("pipeline_type", "unknown")
    device = ml_state.get("device", "cpu")
    
    if pipeline_type == "sd_upscaler":
        # Remember original size for final scaling
        original_width, original_height = image.width, image.height
        target_width = original_width * scale
        target_height = original_height * scale
        
        # SD Upscaler always outputs 4x of its input
        # MPS has memory constraints - limit input size
        if device == "mps":
            max_input = 192  # Smaller for MPS to avoid OOM
        else:
            max_input = 384
            
        if image.width > max_input or image.height > max_input:
            ratio = min(max_input / image.width, max_input / image.height)
            image = image.resize(
                (int(image.width * ratio), int(image.height * ratio)),
                Image.Resampling.LANCZOS
            )
        
        prompt = "high quality, detailed, sharp, 4k resolution"
        negative_prompt = "blurry, noise, artifacts, low quality, pixelated, jpeg artifacts"
        
        num_steps = int(20 + denoise * 30)  # 20-50 steps
        
        # On MPS, don't decode previews (too memory intensive)
        # On CUDA, we can decode previews
        enable_previews = (device == "cuda")
        preview_interval = max(1, num_steps // 8)
        
        def callback_fn(step: int, timestep: int, latents: torch.Tensor):
            """Legacy callback to capture intermediate results."""
            preview_image = None
            
            # Only decode previews on CUDA (MPS runs out of memory)
            if enable_previews and (step % preview_interval == 0 or step == num_steps - 1):
                try:
                    preview_image = decode_latents_to_image(pipeline, latents)
                except Exception as e:
                    logger.warning(f"Preview decode failed: {e}")
            
            progress_callback(step + 1, num_steps, preview_image)
        
        # Noise level controls how much the AI can "reimagine" vs preserve
        # 0 = preserve original closely, 20-50 = balanced, 100+ = very creative
        noise_level = int(creativity * 100)  # Map 0-1 to 0-100
        
        logger.info(f"SD Upscaler: {original_width}x{original_height} → {target_width}x{target_height} ({scale}x, {num_steps} steps)")
        
        # Clear MPS cache before inference
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
        
        # Clear cache after inference
        if device == "mps":
            torch.mps.empty_cache()
        
        # Resize to target dimensions (user's requested scale)
        if result.width != target_width or result.height != target_height:
            logger.info(f"Resizing ML output {result.size} → ({target_width}, {target_height})")
            result = result.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        return result
    
    elif pipeline_type == "ldsr":
        # Remember original size for final scaling
        original_width, original_height = image.width, image.height
        target_width = original_width * scale
        target_height = original_height * scale
        
        # LDSR has smaller input limits
        max_input = 192
        if image.width > max_input or image.height > max_input:
            ratio = min(max_input / image.width, max_input / image.height)
            image = image.resize(
                (int(image.width * ratio), int(image.height * ratio)),
                Image.Resampling.LANCZOS
            )
        
        num_steps = int(50 + denoise * 50)
        
        logger.info(f"LDSR: {original_width}x{original_height} → {target_width}x{target_height} ({scale}x, {num_steps} steps)")
        
        # LDSR: just send periodic progress updates
        for i in range(0, num_steps, num_steps // 10):
            progress_callback(i, num_steps, None)
        
        with torch.inference_mode():
            result = pipeline(
                image=image,
                num_inference_steps=num_steps,
                eta=1.0,
            ).images[0]
        
        progress_callback(num_steps, num_steps, None)
        
        # Resize to target dimensions
        if result.width != target_width or result.height != target_height:
            result = result.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        return result
    
    else:
        raise RuntimeError(f"Unknown pipeline type: {pipeline_type}")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check server health and model status."""
    device = get_device()
    return HealthResponse(
        status="healthy",
        model_loaded=ml_state["available"],
        model_loading=ml_state["loading"],
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


@app.post("/upscale/stream")
async def upscale_image_stream(
    image: UploadFile = File(...),
    scale: int = Form(default=2, ge=1, le=4),
    denoise: float = Form(default=0.3, ge=0.0, le=1.0),
    creativity: float = Form(default=0.0, ge=0.0, le=1.0),
    use_ml: bool = Form(default=True)
):
    """
    Upscale an image with real-time progress streaming via SSE.
    
    Returns Server-Sent Events with:
    - type: "progress" - step updates with optional preview image
    - type: "complete" - final result
    - type: "error" - error message
    """
    contents = await image.read()
    
    async def generate_events():
        try:
            pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
            original_size = (pil_image.width, pil_image.height)
            
            # Send start event
            yield f"data: {json.dumps({'type': 'start', 'original_size': original_size})}\n\n"
            
            method = "lanczos"
            
            if use_ml and ml_state["available"] and ml_state["pipeline"] is not None:
                try:
                    # Progress tracking
                    progress_queue = asyncio.Queue()
                    
                    def sync_progress_callback(step, total, preview_image):
                        """Sync callback that puts progress into queue."""
                        preview_b64 = None
                        if preview_image is not None:
                            # Encode preview as low-quality JPEG for speed
                            preview_b64 = image_to_base64(preview_image, "JPEG", quality=60)
                        
                        # Use asyncio to put into queue from sync context
                        try:
                            progress_queue.put_nowait({
                                "step": step,
                                "total": total,
                                "preview": preview_b64
                            })
                        except asyncio.QueueFull:
                            pass  # Queue full, skip this progress update
                    
                    # Run ML upscaling in thread
                    import concurrent.futures
                    
                    loop = asyncio.get_event_loop()
                    
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = loop.run_in_executor(
                            executor,
                            lambda: upscale_ml_with_progress(pil_image, scale, denoise, creativity, sync_progress_callback)
                        )
                        
                        # Stream progress while waiting for completion
                        last_step = 0
                        while not future.done():
                            try:
                                # Check for progress updates
                                progress = await asyncio.wait_for(
                                    progress_queue.get(),
                                    timeout=0.1
                                )
                                
                                if progress["step"] > last_step:
                                    last_step = progress["step"]
                                    event_data = {
                                        "type": "progress",
                                        "step": progress["step"],
                                        "total": progress["total"],
                                        "percent": round(progress["step"] / progress["total"] * 100)
                                    }
                                    if progress["preview"]:
                                        event_data["preview"] = progress["preview"]
                                    
                                    yield f"data: {json.dumps(event_data)}\n\n"
                            except asyncio.TimeoutError:
                                # No progress yet, continue waiting
                                continue
                            except Exception as e:
                                logger.warning(f"Progress error: {e}")
                                continue
                        
                        # Get the result
                        upscaled = future.result()
                        method = "ml"
                    
                except Exception as e:
                    logger.warning(f"ML upscale failed: {e}")
                    yield f"data: {json.dumps({'type': 'fallback', 'reason': str(e)})}\n\n"
                    upscaled = upscale_lanczos(pil_image, scale, denoise)
                    method = "lanczos (ml failed)"
            else:
                # Lanczos fallback with simulated progress
                reason = "model loading" if ml_state["loading"] else "ml unavailable"
                yield f"data: {json.dumps({'type': 'progress', 'step': 1, 'total': 3, 'percent': 33, 'message': 'Resizing...'})}\n\n"
                
                upscaled = upscale_lanczos(pil_image, scale, denoise)
                method = f"lanczos ({reason})" if use_ml else "lanczos"
                
                yield f"data: {json.dumps({'type': 'progress', 'step': 3, 'total': 3, 'percent': 100, 'message': 'Enhancing...'})}\n\n"
            
            upscaled_size = (upscaled.width, upscaled.height)
            logger.info(f"Complete: {original_size} → {upscaled_size} via {method}")
            
            # Send final result
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
    use_ml: bool = Form(default=True)
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
        
        if use_ml and ml_state["available"] and ml_state["pipeline"] is not None:
            try:
                logger.info(f"ML upscale: {original_size} → {scale}x")
                upscaled = upscale_ml_with_progress(
                    pil_image, scale, denoise, creativity,
                    lambda step, total, preview: None  # No-op callback
                )
                method = "ml"
            except Exception as e:
                logger.warning(f"ML upscale failed, falling back to Lanczos: {e}")
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
        "name": "Qwen Upscaler API",
        "version": "2.1.0",
        "ml_status": {
            "available": ml_state["available"],
            "loading": ml_state["loading"],
            "device": ml_state["device"],
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
    logger.info("Starting Upscaler Backend v2.1...")
    logger.info(f"Device: {get_device()}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
