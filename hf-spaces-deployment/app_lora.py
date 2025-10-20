#!/usr/bin/env python3
"""
Real LoRA Generator for HF Spaces
Uses actual trained LoRA models for crypto news cover generation
"""
import torch
from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler
from PIL import Image, ImageDraw, ImageFont
import os
import random
import base64
import io
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Real LoRA Crypto News Image Generator",
    description="Generate LoRA-based crypto news images with trained models",
    version="2.0.0"
)

class GenerationRequest(BaseModel):
    title: str
    subtitle: str = "CRYPTO NEWS"
    client: str = "hedera"
    style: Optional[str] = "energy_fields"

class GenerationResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None

class RealLoRAGenerator:
    def __init__(self):
        # Use CPU for HF Spaces compatibility
        self.device = "cpu"
        self.pipeline = None
        self.watermark = None
        self.setup_pipeline()
        self.load_watermark()
        
    def setup_pipeline(self):
        """Load optimized SDXL pipeline"""
        logger.info(f"🖥️ Using device: {self.device}")
        logger.info("🔄 Loading Stable Diffusion XL...")
        
        model_id = "stabilityai/stable-diffusion-xl-base-1.0"
        
        self.pipeline = StableDiffusionXLPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float32,  # Use float32 for CPU stability
            use_safetensors=True,
            variant=None
        )
        
        self.pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
            self.pipeline.scheduler.config,
            use_karras_sigmas=True
        )
        
        self.pipeline = self.pipeline.to(self.device)
        # Enable CPU optimizations
        self.pipeline.enable_attention_slicing()
        
        logger.info("✅ Pipeline ready")
    
    def load_watermark(self):
        """Load watermark if available"""
        watermark_path = "genfinity-watermark.png"
        try:
            if os.path.exists(watermark_path):
                self.watermark = Image.open(watermark_path).convert("RGBA")
                logger.info(f"✅ Loaded watermark: {self.watermark.size}")
            else:
                logger.info("⚠️ No watermark found")
                self.watermark = None
        except Exception as e:
            logger.warning(f"⚠️ Watermark loading failed: {e}")
            self.watermark = None
    
    def load_lora_model(self, client):
        """Load client-specific LoRA model"""
        lora_path = f"models/lora/{client}_lora.safetensors"
        
        if os.path.exists(lora_path):
            try:
                logger.info(f"🎨 Loading LoRA model: {lora_path}")
                self.pipeline.load_lora_weights(lora_path)
                self.pipeline.fuse_lora()
                logger.info(f"✅ LoRA model loaded for {client.upper()}")
                return True
            except Exception as e:
                logger.warning(f"⚠️ LoRA loading failed for {client}: {e}")
                return False
        else:
            logger.info(f"📝 No LoRA model found for {client}, using enhanced prompts")
            return False
    
    def get_fonts(self):
        """Load system fonts with fallback"""
        fonts = {}
        
        font_sizes = {
            "title": 120,
            "subtitle": 60,
            "small": 40
        }
        
        # Try to load system fonts
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/System/Library/Fonts/Arial.ttc",
            "/usr/share/fonts/arial.ttf"
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
                try:
                    fonts[size_name] = ImageFont.load_default()
                except:
                    fonts[size_name] = ImageFont.load_default()
        
        return fonts
    
    def get_enhanced_prompts(self, client="hedera", style="energy_fields"):
        """Get enhanced prompts based on client and style"""
        
        brand_prompts = {
            "hedera": {
                "energy_fields": "dark electromagnetic field background, deep black with purple energy field distortions, purple electromagnetic waves, energy field visualizations, plasma-like purple distortions in space, electromagnetic field photography, 8k resolution, electric energy lighting, professional article cover background, no text, no words, no letters",
                "network_nodes": "dramatic dark purple hashgraph technology background, deep black void with glowing purple elements, glowing hashgraph network nodes in dark space, electric purple connections on black background, hexagonal grid overlay with luminous H symbols, premium dark technology photography, 8k resolution, dramatic lighting with deep shadows",
                "particle_waves": "dark cosmic background with purple particle systems, deep space with glowing purple dust clouds, swirling purple particle waves, cosmic dust formations, ethereal purple energy clouds floating in space, cosmic particle photography, 8k resolution, ethereal lighting effects"
            },
            "algorand": {
                "energy_fields": "dark computational field background, black space with teal algorithmic energy patterns, teal computational waves, algorithm visualization fields, digital energy distortions, computational field photography, 8k resolution, digital energy lighting",
                "network_nodes": "sophisticated dark blockchain environment, deep black background with glowing teal triangular elements, glowing proof of stake visualization, electric teal triangular nodes on black background, geometric network topology, premium dark fintech photography, 8k resolution, dramatic professional lighting",
                "geometric_patterns": "clean dark architectural background, minimalist black space with teal geometric structures, precise teal geometric forms, triangular architectural elements, mathematical precision patterns, mathematical architecture photography, 8k resolution, precision lighting"
            },
            "constellation": {
                "energy_fields": "dark gravitational field background, deep space with white gravitational wave distortions, white gravitational waves, spacetime distortion patterns, cosmic energy field visualizations, gravitational field photography, 8k resolution, spacetime lighting effects",
                "network_nodes": "dramatic dark cosmic space environment, deep black void with glowing stellar elements, glowing DAG network visualization, electric white star-shaped nodes on cosmic black background, premium dark space photography, 8k resolution, dramatic cosmic lighting",
                "crystalline_structures": "dark space with white crystal star formations, cosmic void with luminous crystal clusters, white crystalline star structures, cosmic crystal growth patterns, faceted stellar crystal formations, stellar crystal photography, 8k resolution, cosmic crystal lighting"
            }
        }
        
        # Get the prompt for the client and style
        if client.lower() in brand_prompts and style in brand_prompts[client.lower()]:
            return brand_prompts[client.lower()][style]
        else:
            # Default to hedera energy_fields
            return brand_prompts["hedera"]["energy_fields"]
    
    def create_text_overlay(self, width, height, title, subtitle, fonts):
        """Create text overlay with professional styling"""
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Title positioning
        title_y = height // 3
        
        # Draw title
        if title:
            title = title.upper()
            bbox = draw.textbbox((0, 0), title, font=fonts["title"])
            text_width = bbox[2] - bbox[0]
            
            # Check if title fits, if not break into lines
            if text_width > width * 0.8:
                words = title.split()
                mid = len(words) // 2
                title_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
            else:
                title_lines = [title]
            
            for i, line in enumerate(title_lines):
                bbox = draw.textbbox((0, 0), line, font=fonts["title"])
                text_width = bbox[2] - bbox[0]
                x = (width - text_width) // 2
                y = title_y + (i * 130)
                
                # Shadow
                draw.text((x + 3, y + 3), line, fill=(0, 0, 0, 200), font=fonts["title"])
                # Main text
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
        
        # Draw subtitle if provided
        if subtitle:
            subtitle_y = title_y + len(title_lines) * 130 + 50
            
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            # Subtitle with rounded box
            box_padding = 20
            box_x1 = x - box_padding
            box_y1 = subtitle_y - box_padding // 2
            box_x2 = x + text_width + box_padding
            box_y2 = subtitle_y + 60 + box_padding // 2
            
            # Draw rounded rectangle
            draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], 
                                 radius=15, fill=(0, 0, 0, 120))
            
            # Shadow
            draw.text((x + 2, subtitle_y + 2), subtitle, fill=(0, 0, 0, 150), font=fonts["subtitle"])
            # Main text
            draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        
        return overlay
    
    def generate_cover(self, title, subtitle, client="hedera", style="energy_fields"):
        """Generate LoRA-enhanced cover"""
        try:
            logger.info(f"🎨 Generating LoRA cover: {title} (client: {client}, style: {style})")
            
            # Load LoRA model for this client
            lora_loaded = self.load_lora_model(client)
            
            # Get enhanced prompt
            prompt = self.get_enhanced_prompts(client, style)
            
            # Generate background
            image = self.pipeline(
                prompt=prompt,
                negative_prompt="text, letters, words, titles, subtitles, watermarks, signatures, typography, fonts, readable text, characters, alphabet, numbers, low quality, blurry, amateur, ugly, poor lighting, pixelated, distorted logos",
                width=1792,
                height=896,
                num_inference_steps=25,  # Reduced for HF Spaces performance
                guidance_scale=8.0,
                num_images_per_prompt=1,
                generator=torch.Generator(device=self.device).manual_seed(random.randint(100, 999))
            ).images[0]
            
            # Resize to standard format
            resized_image = image.resize((1800, 900), Image.Resampling.LANCZOS)
            base_rgba = resized_image.convert("RGBA")
            
            # Get fonts and add text overlay
            fonts = self.get_fonts()
            text_overlay = self.create_text_overlay(1800, 900, title, subtitle, fonts)
            base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            # Apply watermark if available
            if self.watermark:
                watermark_resized = self.watermark.resize((1800, 900), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, watermark_resized)
            else:
                final_image = base_rgba
            
            logger.info("✅ LoRA cover generation complete")
            return final_image.convert("RGB")
            
        except Exception as e:
            logger.error(f"❌ Cover generation failed: {str(e)}")
            return None

# Initialize generator
generator = RealLoRAGenerator()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Real LoRA Crypto News Image Generator",
        "status": "running",
        "endpoints": ["/generate", "/health"],
        "version": "2.0.0"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "real-lora-generator"}

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    """Generate LoRA-enhanced crypto news cover"""
    try:
        logger.info(f"🎨 Generating image for: {request.title}")
        
        # Generate the cover
        image = generator.generate_cover(
            title=request.title,
            subtitle=request.subtitle,
            client=request.client,
            style=request.style or "energy_fields"
        )
        
        if image is None:
            raise HTTPException(status_code=500, detail="Failed to generate image")
        
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
                "generator": "real-lora",
                "resolution": "1800x900"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"🚀 Starting Real LoRA Generator on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)