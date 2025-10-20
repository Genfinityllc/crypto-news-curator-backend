#!/usr/bin/env python3
"""
CPU LoRA Cover Generator - Forces CPU for compatibility
Uses SDXL + LoRA on CPU when GPU memory insufficient
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

app = FastAPI(
    title="CPU LoRA Cover Generator",
    description="Generate crypto news covers using LoRA models on CPU",
    version="5.1.0-CPU-LORA"
)

class GenerationRequest(BaseModel):
    title: str
    subtitle: str = "CRYPTO NEWS"
    client: str = "hedera"
    style: Optional[str] = "dark_theme"
    use_trained_lora: bool = True

class GenerationResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None

class CPULoRACoverGenerator:
    def __init__(self):
        self.watermark = None
        self.pipeline = None
        self.current_lora = None
        self.lora_available = {}
        
        logger.info("🚀 CPU LoRA MODE: Forcing CPU for compatibility")
        self.load_watermark()
        self.check_available_loras()
        self.force_load_cpu_pipeline()
        logger.info("✅ CPU LoRA generator ready!")
    
    def load_watermark(self):
        watermark_path = "genfinity-watermark.png"
        if os.path.exists(watermark_path):
            try:
                self.watermark = Image.open(watermark_path).convert("RGBA")
                logger.info(f"✅ Loaded watermark: {self.watermark.size}")
            except Exception as e:
                logger.warning(f"⚠️ Watermark loading failed: {e}")
    
    def check_available_loras(self):
        lora_dir = "models/lora"
        if not os.path.exists(lora_dir):
            logger.error(f"❌ LoRA directory not found: {lora_dir}")
            raise SystemExit("LoRA directory required")
        
        universal_lora = f"{lora_dir}/crypto_cover_styles_lora.safetensors"
        if not os.path.exists(universal_lora):
            logger.error(f"❌ Universal LoRA not found: {universal_lora}")
            raise SystemExit("Universal LoRA model required")
        
        self.lora_available["universal"] = universal_lora
        logger.info("✅ Found Universal LoRA")
    
    def force_load_cpu_pipeline(self):
        """Force CPU pipeline loading for compatibility"""
        import gc
        gc.collect()
        
        # FORCE CPU to avoid GPU memory issues
        device = "cpu"
        torch_dtype = torch.float32
        logger.info("🚀 FORCING CPU for SDXL (compatibility mode)")
        
        try:
            # Load SDXL for CPU with minimal memory usage
            self.pipeline = StableDiffusionXLPipeline.from_pretrained(
                "stabilityai/stable-diffusion-xl-base-1.0",
                torch_dtype=torch_dtype,
                use_safetensors=True,
                low_cpu_mem_usage=True,
            )
            
            logger.info("📦 SDXL model loaded for CPU")
            self.pipeline = self.pipeline.to(device)
            
            # CPU optimizations
            try:
                self.pipeline.enable_attention_slicing()
                logger.info("✅ CPU attention slicing enabled")
            except Exception as e:
                logger.warning(f"⚠️ Attention slicing failed: {e}")
            
            logger.info("✅ CPU SDXL Pipeline loaded successfully")
            
        except Exception as e:
            logger.error(f"❌ CPU SDXL Pipeline loading FAILED: {str(e)}")
            logger.error(f"📍 Traceback: {traceback.format_exc()}")
            raise SystemExit(f"CPU SDXL pipeline failed: {e}")
    
    def force_load_lora_weights(self):
        if not self.pipeline:
            raise Exception("Pipeline not loaded")
        
        lora_path = self.lora_available["universal"]
        
        try:
            if self.current_lora:
                self.pipeline.unload_lora_weights()
            
            self.pipeline.load_lora_weights(lora_path)
            self.current_lora = "universal"
            logger.info("✅ Loaded Universal LoRA on CPU")
            return True
            
        except Exception as e:
            logger.error(f"❌ LoRA loading failed: {e}")
            raise Exception(f"LoRA loading failed: {e}")
    
    def generate_with_cpu_lora(self, client, style, title):
        if not self.pipeline:
            raise Exception("Pipeline not available")
        
        self.force_load_lora_weights()
        
        style_prompts = {
            "energy_fields": f"crypto cover, glowing energy fields, {client} colors, professional design",
            "dark_theme": f"crypto cover, dark background, {client} branding, corporate style",
            "network_nodes": f"crypto cover, network visualization, {client} colors, tech design",
            "particle_waves": f"crypto cover, particle effects, {client} branding, modern style"
        }
        
        prompt = style_prompts.get(style, f"crypto cover, {client} style, professional")
        negative_prompt = "text, letters, words, low quality, blurry"
        
        logger.info(f"🎨 Generating CPU LoRA: {client}/{style}")
        
        try:
            # CPU generation (slower but works)
            image = self.pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                height=512,
                width=1024,
                num_inference_steps=20,  # Reduced for CPU speed
                guidance_scale=7.5,
                num_images_per_prompt=1,
                generator=torch.Generator().manual_seed(random.randint(1, 1000000))
            ).images[0]
            
            image = image.resize((1800, 900), Image.Resampling.LANCZOS)
            logger.info("✅ CPU LoRA generation completed")
            return image
            
        except Exception as e:
            logger.error(f"❌ CPU LoRA generation failed: {e}")
            raise Exception(f"CPU LoRA generation failed: {e}")
    
    def get_fonts(self):
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
    
    def create_text_overlay(self, width, height, title, subtitle, fonts):
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
                
                # Strong shadows
                for offset in [(8, 8), (4, 4)]:
                    draw.text((x + offset[0], y + offset[1]), line, 
                             fill=(0, 0, 0, 200), font=fonts["title"])
                
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
        
        if subtitle:
            subtitle_y = title_y + len(title_lines) * 250 + 80
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            padding = 40
            draw.rounded_rectangle([x-padding, subtitle_y-20, x+text_width+padding, subtitle_y+120], 
                                 radius=20, fill=(0, 0, 0, 200))
            
            draw.text((x + 3, subtitle_y + 3), subtitle, fill=(0, 0, 0, 255), font=fonts["subtitle"])
            draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        
        return overlay
    
    def generate_cover(self, title, subtitle, client="hedera", style="dark_theme"):
        try:
            logger.info(f"🎨 CPU LoRA Generation: {title}")
            
            width, height = 1800, 900
            background = self.generate_with_cpu_lora(client, style, title)
            
            base_rgba = background.convert("RGBA")
            
            fonts = self.get_fonts()
            text_overlay = self.create_text_overlay(width, height, title, subtitle, fonts)
            base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            if self.watermark:
                watermark_resized = self.watermark.resize((width, height), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, watermark_resized)
            else:
                final_image = base_rgba
            
            logger.info("✅ CPU LoRA cover completed")
            return final_image.convert("RGB"), "cpu_universal_lora"
            
        except Exception as e:
            logger.error(f"❌ CPU LoRA generation failed: {str(e)}")
            raise Exception(f"CPU LoRA generation failed: {e}")

# Initialize generator
try:
    generator = CPULoRACoverGenerator()
except Exception as e:
    logger.error(f"❌ CPU LoRA generator failed: {e}")
    raise SystemExit("Cannot start CPU LoRA generator")

@app.get("/")
async def root():
    return {
        "message": "CPU LoRA Cover Generator",
        "status": "running",
        "mode": "CPU_LORA",
        "available_loras": list(generator.lora_available.keys()),
        "pipeline_loaded": generator.pipeline is not None,
        "device": "cpu",
        "version": "5.1.0-CPU-LORA"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "service": "cpu-lora-cover-generator",
        "device": "cpu"
    }

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    try:
        logger.info(f"🎨 CPU LoRA Request: {request.title}")
        
        result = generator.generate_cover(
            title=request.title,
            subtitle=request.subtitle,
            client=request.client,
            style=request.style or "dark_theme"
        )
        
        image, method = result
        
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
                "device": "cpu",
                "resolution": "1800x900"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ CPU LoRA failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CPU LoRA generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"🚀 Starting CPU LoRA Generator on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)