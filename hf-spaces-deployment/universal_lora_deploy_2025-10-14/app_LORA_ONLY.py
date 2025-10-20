#!/usr/bin/env python3
"""
PURE LoRA-Only Cover Generator - NO FALLBACKS ALLOWED
Forces SDXL + LoRA generation or complete failure
"""
import os
import random
import base64
import io
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn
import logging
from PIL import Image, ImageDraw, ImageFont
import torch
from diffusers import StableDiffusionXLPipeline
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Log system information
logger.info("🖥️ System Information:")
logger.info(f"📊 Python version: {__import__('sys').version}")
logger.info(f"🔧 Platform: {__import__('platform').platform()}")

try:
    import torch
    logger.info(f"🔥 PyTorch version: {torch.__version__}")
    logger.info(f"⚡ CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        logger.info(f"🎮 GPU count: {torch.cuda.device_count()}")
        logger.info(f"🎯 Current GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"💾 GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
except ImportError:
    logger.error("⚠️ PyTorch not available - CANNOT PROCEED WITHOUT PYTORCH")
    raise SystemExit("PyTorch required for LoRA generation")

try:
    import diffusers
    logger.info(f"🌀 Diffusers version: {diffusers.__version__}")
except ImportError:
    logger.error("⚠️ Diffusers not available - CANNOT PROCEED WITHOUT DIFFUSERS")
    raise SystemExit("Diffusers required for LoRA generation")

app = FastAPI(
    title="PURE LoRA Cover Generator - NO FALLBACKS",
    description="Generate crypto news covers using ONLY trained LoRA models",
    version="5.0.0-LORA-ONLY"
)

class GenerationRequest(BaseModel):
    title: str
    subtitle: str = "CRYPTO NEWS"
    client: str = "hedera"
    style: Optional[str] = "dark_theme"
    use_trained_lora: bool = True  # ALWAYS True - no other option

class GenerationResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None

class PureLoRACoverGenerator:
    def __init__(self):
        self.watermark = None
        self.pipeline = None
        self.current_lora = None
        self.lora_available = {}
        
        # Initialize components - ALL MUST SUCCEED
        logger.info("🚀 PURE LORA MODE: No fallbacks allowed!")
        self.load_watermark()
        self.check_available_loras()
        
        # FORCE SDXL pipeline loading - FAIL if not possible
        self.force_load_pipeline()
        
        logger.info("✅ PURE LoRA generator ready - SDXL + Universal LoRA loaded!")
    
    def load_watermark(self):
        """Load watermark - required"""
        watermark_path = "genfinity-watermark.png"
        if not os.path.exists(watermark_path):
            logger.warning(f"⚠️ Watermark not found: {watermark_path}")
            return
            
        try:
            self.watermark = Image.open(watermark_path).convert("RGBA")
            logger.info(f"✅ Loaded watermark: {self.watermark.size}")
        except Exception as e:
            logger.error(f"❌ Watermark loading failed: {e}")
            raise SystemExit("Watermark required for proper covers")
    
    def check_available_loras(self):
        """Check LoRA models - MUST HAVE UNIVERSAL LORA"""
        lora_dir = "models/lora"
        if not os.path.exists(lora_dir):
            logger.error(f"❌ LoRA directory not found: {lora_dir}")
            raise SystemExit("LoRA directory required for LoRA generation")
        
        # REQUIRE Universal LoRA
        universal_lora = f"{lora_dir}/crypto_cover_styles_lora.safetensors"
        if not os.path.exists(universal_lora):
            logger.error(f"❌ Universal LoRA not found: {universal_lora}")
            raise SystemExit("Universal LoRA model is required")
        
        self.lora_available["universal"] = universal_lora
        logger.info("✅ Found Universal LoRA: crypto_cover_styles_lora.safetensors")
        
        if not self.lora_available:
            logger.error("❌ No LoRA models found")
            raise SystemExit("At least one LoRA model required")
    
    def force_load_pipeline(self):
        """FORCE load SDXL pipeline - FAIL HARD if impossible"""
        import gc
        
        logger.info("🚀 FORCING SDXL pipeline load...")
        
        # Force garbage collection
        gc.collect()
        
        if torch.cuda.is_available():
            device = "cuda"
            torch_dtype = torch.float16
            logger.info(f"🚀 Using CUDA - GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
            torch.cuda.empty_cache()
        else:
            logger.error("❌ CUDA not available - LoRA generation requires GPU")
            raise SystemExit("GPU required for LoRA generation")
        
        logger.info(f"🚀 Loading SDXL pipeline on {device} with {torch_dtype}")
        
        try:
            # Load with aggressive memory optimizations
            self.pipeline = StableDiffusionXLPipeline.from_pretrained(
                "stabilityai/stable-diffusion-xl-base-1.0",
                torch_dtype=torch_dtype,
                variant="fp16",
                use_safetensors=True,
                low_cpu_mem_usage=True,
                device_map="auto",
                max_memory={0: "12GB"}  # Reduced memory limit
            )
            
            logger.info("📦 SDXL model loaded, moving to device...")
            self.pipeline = self.pipeline.to(device)
            
            # Enable memory optimizations
            try:
                self.pipeline.enable_attention_slicing()
                logger.info("✅ Attention slicing enabled")
            except Exception as e:
                logger.warning(f"⚠️ Attention slicing failed: {e}")
            
            try:
                self.pipeline.enable_vae_slicing()
                logger.info("✅ VAE slicing enabled")
            except Exception as e:
                logger.warning(f"⚠️ VAE slicing failed: {e}")
            
            # Test pipeline with minimal generation
            logger.info("🧪 Testing SDXL pipeline...")
            test_result = self.pipeline(
                "test",
                height=64,
                width=64,
                num_inference_steps=1,
                guidance_scale=1.0
            )
            logger.info("✅ SDXL Pipeline loaded and tested successfully")
            
        except Exception as e:
            logger.error(f"❌ SDXL Pipeline loading FAILED: {str(e)}")
            logger.error(f"📊 Error details: {type(e).__name__}")
            logger.error(f"📍 Traceback: {traceback.format_exc()}")
            raise SystemExit(f"SDXL pipeline is required for LoRA generation: {e}")
    
    def force_load_lora_weights(self, client, style):
        """FORCE load LoRA weights - FAIL if impossible"""
        if not self.pipeline:
            raise Exception("Pipeline not loaded - cannot load LoRA")
        
        # Use Universal LoRA for all generations
        lora_key = "universal"
        lora_path = self.lora_available["universal"]
        
        try:
            # Unload previous LoRA if any
            if self.current_lora:
                self.pipeline.unload_lora_weights()
            
            # Load Universal LoRA
            self.pipeline.load_lora_weights(lora_path)
            self.current_lora = lora_key
            logger.info(f"✅ Loaded LoRA: {lora_key}")
            return True
            
        except Exception as e:
            logger.error(f"❌ FAILED to load LoRA {lora_path}: {e}")
            raise Exception(f"LoRA loading failed: {e}")
    
    def generate_with_universal_lora(self, client, style, title):
        """Generate background using Universal LoRA - NO FALLBACKS"""
        if not self.pipeline:
            raise Exception("SDXL Pipeline not available")
        
        # FORCE load Universal LoRA
        self.force_load_lora_weights(client, style)
        
        # Enhanced style-specific prompts for Universal LoRA
        style_prompts = {
            "energy_fields": f"crypto cover, glowing energy fields, particle effects, cosmic energy, vibrant {client} colors, professional financial design, high quality",
            "dark_theme": f"crypto cover, dark professional background, geometric patterns, minimal lighting, {client} branding, corporate financial style, premium",
            "network_nodes": f"crypto cover, connected network visualization, digital nodes, tech infrastructure, {client} colors, futuristic financial design",
            "particle_waves": f"crypto cover, flowing particle effects, dynamic waves, energy motion, {client} branding, modern financial aesthetic"
        }
        
        prompt = style_prompts.get(style, f"crypto financial cover, {client} style, professional design, high quality")
        negative_prompt = "text, letters, words, title, subtitle, watermark, signature, blurry, low quality, distorted, people, faces, ugly, bad anatomy"
        
        logger.info(f"🎨 Generating Universal LoRA background: {client}/{style}")
        logger.info(f"📝 Prompt: {prompt}")
        
        try:
            # Generate with Universal LoRA
            image = self.pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                height=512,
                width=1024,
                num_inference_steps=30,
                guidance_scale=7.5,
                num_images_per_prompt=1,
                generator=torch.Generator().manual_seed(random.randint(1, 1000000))
            ).images[0]
            
            # Upscale to final resolution
            image = image.resize((1800, 900), Image.Resampling.LANCZOS)
            
            logger.info("✅ Universal LoRA background generated successfully")
            return image
            
        except Exception as e:
            logger.error(f"❌ Universal LoRA generation FAILED: {e}")
            raise Exception(f"LoRA generation failed: {e}")
    
    def get_fonts(self):
        """Get fonts for text overlay"""
        fonts = {}
        font_sizes = {"title": 200, "subtitle": 100}
        
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
        
        for size_name, size in font_sizes.items():
            fonts[size_name] = None
            for font_path in font_paths:
                try:
                    if os.path.exists(font_path):
                        fonts[size_name] = ImageFont.truetype(font_path, size)
                        break
                except:
                    continue
            
            if fonts[size_name] is None:
                fonts[size_name] = ImageFont.load_default()
        
        return fonts
    
    def create_enhanced_text_overlay(self, width, height, title, subtitle, fonts):
        """Create enhanced text overlay for LoRA backgrounds"""
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        title_y = height // 4
        
        if title:
            title = title.upper()
            words = title.split()
            if len(words) > 3:
                mid = len(words) // 2
                title_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
            else:
                title_lines = [title]
            
            for i, line in enumerate(title_lines):
                bbox = draw.textbbox((0, 0), line, font=fonts["title"])
                text_width = bbox[2] - bbox[0]
                x = (width - text_width) // 2
                y = title_y + (i * 250)
                
                # Enhanced shadows for better visibility on LoRA backgrounds
                for offset in [(12, 12), (8, 8), (4, 4)]:
                    draw.text((x + offset[0], y + offset[1]), line, 
                             fill=(0, 0, 0, 200), font=fonts["title"])
                
                # White text with slight glow effect
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
        
        # Enhanced subtitle
        if subtitle:
            subtitle_y = title_y + len(title_lines) * 250 + 80
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            # Enhanced box background
            padding = 40
            draw.rounded_rectangle([x-padding, subtitle_y-20, x+text_width+padding, subtitle_y+120], 
                                 radius=20, fill=(0, 0, 0, 220))
            
            # Subtitle text with better contrast
            draw.text((x + 3, subtitle_y + 3), subtitle, fill=(0, 0, 0, 255), font=fonts["subtitle"])
            draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        
        return overlay
    
    def generate_cover(self, title, subtitle, client="hedera", style="dark_theme"):
        """Generate complete cover - PURE LoRA ONLY"""
        try:
            logger.info(f"🎨 PURE LoRA Generation: {title} (client: {client}, style: {style})")
            
            width, height = 1800, 900
            
            # FORCE Universal LoRA generation - NO FALLBACKS
            background = self.generate_with_universal_lora(client, style, title)
            
            # Convert to RGBA for compositing
            base_rgba = background.convert("RGBA")
            
            # Add enhanced text overlay
            fonts = self.get_fonts()
            text_overlay = self.create_enhanced_text_overlay(width, height, title, subtitle, fonts)
            base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            # Add watermark
            if self.watermark:
                watermark_resized = self.watermark.resize((width, height), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, watermark_resized)
            else:
                final_image = base_rgba
            
            logger.info("✅ PURE LoRA cover generated successfully")
            return final_image.convert("RGB"), "pure_universal_lora"
            
        except Exception as e:
            logger.error(f"❌ PURE LoRA generation FAILED: {str(e)}")
            raise Exception(f"LoRA generation failed - NO FALLBACKS: {e}")

# Initialize generator - FAIL HARD if impossible
try:
    generator = PureLoRACoverGenerator()
except Exception as e:
    logger.error(f"❌ PURE LoRA generator initialization FAILED: {e}")
    raise SystemExit("Cannot start without proper LoRA setup")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "PURE LoRA Cover Generator - NO FALLBACKS",
        "status": "running",
        "mode": "PURE_LORA_ONLY",
        "available_loras": list(generator.lora_available.keys()),
        "pipeline_loaded": generator.pipeline is not None,
        "fallbacks_disabled": True,
        "version": "5.0.0-LORA-ONLY"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "service": "pure-lora-cover-generator",
        "lora_count": len(generator.lora_available),
        "fallbacks": "DISABLED"
    }

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    """Generate cover using PURE LoRA - NO FALLBACKS"""
    try:
        logger.info(f"🎨 PURE LoRA Request: {request.title}")
        
        # FORCE LoRA generation - NO FALLBACKS ALLOWED
        result = generator.generate_cover(
            title=request.title,
            subtitle=request.subtitle,
            client=request.client,
            style=request.style or "dark_theme"
        )
        
        image, method = result
        
        # Convert to base64
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", quality=95)
        buffer.seek(0)
        image_data = buffer.getvalue()
        base64_image = base64.b64encode(image_data).decode()
        
        return GenerationResponse(
            success=True,
            image_url=f"data:image/png;base64,{base64_image}",
            metadata={
                "client": request.client,
                "style": request.style,
                "title": request.title,
                "subtitle": request.subtitle,
                "generation_method": method,
                "lora_used": generator.current_lora,
                "resolution": "1800x900",
                "fallbacks_used": False
            }
        )
        
    except Exception as e:
        logger.error(f"❌ PURE LoRA generation FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"LoRA generation failed (NO FALLBACKS): {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"🚀 Starting PURE LoRA Cover Generator on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)