#!/usr/bin/env python3
"""
LoRA-Powered Cover Generator
Uses trained LoRA models based on original cover styles
"""
import os
import random
import base64
import io
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
    title="Trained LoRA Cover Generator",
    description="Generate crypto news covers using trained LoRA models",
    version="4.0.0"
)

class GenerationRequest(BaseModel):
    title: str
    subtitle: str = "CRYPTO NEWS"
    client: str = "hedera"
    style: Optional[str] = "dark_theme"
    use_trained_lora: bool = True  # Toggle between LoRA and fallback

class GenerationResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None

class LoRACoverGenerator:
    def __init__(self):
        self.watermark = None
        self.pipeline = None
        self.current_lora = None
        self.lora_available = {}
        
        # Initialize
        self.load_watermark()
        self.check_available_loras()
        
        # Try to load pipeline (may fail in CPU-only environments)
        try:
            self.load_pipeline()
        except Exception as e:
            logger.warning(f"⚠️ Could not load SDXL pipeline: {e}")
            logger.info("📝 Falling back to programmatic generation")
    
    def load_watermark(self):
        """Load watermark if available"""
        watermark_path = "genfinity-watermark.png"
        try:
            if os.path.exists(watermark_path):
                self.watermark = Image.open(watermark_path).convert("RGBA")
                logger.info(f"✅ Loaded watermark: {self.watermark.size}")
        except Exception as e:
            logger.warning(f"⚠️ Watermark loading failed: {e}")
    
    def check_available_loras(self):
        """Check which LoRA models are available"""
        lora_dir = "models/lora"
        if not os.path.exists(lora_dir):
            logger.info("📁 Creating LoRA models directory")
            os.makedirs(lora_dir, exist_ok=True)
            return
        
        # Check for style-specific LoRAs
        styles = ["energy_fields", "dark_theme", "network_nodes", "particle_waves"]
        clients = ["hedera", "algorand", "constellation"]
        
        for client in clients:
            for style in styles:
                lora_path = f"{lora_dir}/{client}_{style}_lora.safetensors"
                if os.path.exists(lora_path):
                    self.lora_available[f"{client}_{style}"] = lora_path
                    logger.info(f"✅ Found LoRA: {client}_{style}")
        
        # Check for universal style LoRA
        universal_lora = f"{lora_dir}/cover_styles_lora.safetensors"
        if os.path.exists(universal_lora):
            self.lora_available["universal"] = universal_lora
            logger.info("✅ Found universal cover styles LoRA")
        
        if not self.lora_available:
            logger.info("📝 No trained LoRA models found - will use programmatic fallback")
    
    def load_pipeline(self):
        """Load SDXL pipeline for LoRA generation"""
        if torch.cuda.is_available():
            device = "cuda"
            torch_dtype = torch.float16
        else:
            device = "cpu"
            torch_dtype = torch.float32
        
        logger.info(f"🚀 Loading SDXL pipeline on {device}")
        
        self.pipeline = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch_dtype,
            variant="fp16" if device == "cuda" else None,
            use_safetensors=True,
            low_cpu_mem_usage=True  # Important for HF Spaces
        )
        
        self.pipeline.to(device)
        
        # Enable memory optimizations
        if device == "cuda":
            self.pipeline.enable_xformers_memory_efficient_attention()
        else:
            # CPU optimizations for HF Spaces
            try:
                self.pipeline.enable_sequential_cpu_offload()
            except:
                pass  # Skip if not available
        
        logger.info("✅ SDXL Pipeline loaded")
    
    def load_lora_weights(self, client, style):
        """Load appropriate LoRA weights"""
        if not self.pipeline:
            return False
        
        # Try specific client/style LoRA first
        lora_key = f"{client}_{style}"
        if lora_key in self.lora_available:
            lora_path = self.lora_available[lora_key]
        elif "universal" in self.lora_available:
            lora_path = self.lora_available["universal"]
            lora_key = "universal"
        else:
            logger.info(f"📝 No LoRA available for {client}/{style}")
            return False
        
        try:
            # Unload previous LoRA
            if self.current_lora:
                self.pipeline.unload_lora_weights()
            
            # Load new LoRA
            self.pipeline.load_lora_weights(lora_path)
            self.current_lora = lora_key
            logger.info(f"✅ Loaded LoRA: {lora_key}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load LoRA {lora_path}: {e}")
            return False
    
    def generate_with_trained_lora(self, client, style, title):
        """Generate background using trained LoRA model"""
        if not self.pipeline:
            return None
        
        # Load appropriate LoRA
        lora_loaded = self.load_lora_weights(client, style)
        
        # Create style-specific prompt based on original training data
        style_prompts = {
            "energy_fields": f"crypto news cover background, glowing energy fields, particle effects, cosmic energy, vibrant auras, {client} branding colors, professional design",
            "dark_theme": f"crypto news cover background, dark professional background, subtle geometric patterns, minimal lighting, {client} color scheme, corporate style",
            "network_nodes": f"crypto news cover background, connected network nodes, digital connections, tech visualization, {client} branding, futuristic design",
            "particle_waves": f"crypto news cover background, flowing particle waves, dynamic motion, wave patterns, {client} colors, energy flow"
        }
        
        prompt = style_prompts.get(style, f"crypto news cover background, {client} style, professional design")
        negative_prompt = "text, letters, words, title, subtitle, watermark, signature, blurry, low quality, distorted, people, faces"
        
        logger.info(f"🎨 Generating LoRA background: {client}/{style}")
        
        try:
            # Generate background image
            image = self.pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                height=512,
                width=1024,  # 2:1 aspect ratio like your covers
                num_inference_steps=30,
                guidance_scale=7.5,
                num_images_per_prompt=1,
                generator=torch.Generator().manual_seed(random.randint(1, 1000000))
            ).images[0]
            
            # Upscale to final resolution
            image = image.resize((1800, 900), Image.Resampling.LANCZOS)
            
            logger.info("✅ LoRA background generated successfully")
            return image
            
        except Exception as e:
            logger.error(f"❌ LoRA generation failed: {e}")
            return None
    
    def generate_programmatic_fallback(self, width, height, client, style):
        """Fallback to programmatic generation if LoRA unavailable"""
        logger.info(f"📝 Using programmatic fallback for {client}/{style}")
        
        # Client colors (same as before)
        colors = {
            'hedera': {
                'primary': (138, 43, 226),
                'secondary': (75, 0, 130),
                'accent': (186, 85, 211),
                'energy': (255, 0, 255)
            },
            'algorand': {
                'primary': (0, 120, 140),
                'secondary': (0, 85, 100),
                'accent': (75, 163, 224),
                'energy': (0, 255, 255)
            },
            'constellation': {
                'primary': (72, 61, 139),
                'secondary': (25, 25, 112),
                'accent': (106, 90, 205),
                'energy': (255, 255, 255)
            }
        }
        
        client_colors = colors.get(client, colors['hedera'])
        img = Image.new('RGB', (width, height), (10, 10, 15))
        draw = ImageDraw.Draw(img)
        
        # Create enhanced visual elements (same as ultra-visible version)
        if style == "dark_theme":
            # Dark gradient
            for y in range(height):
                darkness = 0.8 + 0.2 * (y / height)
                color = tuple(int(c * darkness * 0.15) for c in client_colors['primary'])
                draw.line([(0, y), (width, y)], fill=color)
            
            # Geometric patterns
            pattern_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            pattern_draw = ImageDraw.Draw(pattern_img)
            
            hex_size = 80
            for y in range(0, height + hex_size, hex_size):
                for x in range(0, width + hex_size, hex_size):
                    offset_x = x + (hex_size // 2 if (y // hex_size) % 2 else 0)
                    alpha = random.randint(40, 100)
                    hex_color = client_colors['accent'] + (alpha,)
                    
                    points = [
                        (offset_x, y - hex_size//3),
                        (offset_x + hex_size//3, y),
                        (offset_x, y + hex_size//3),
                        (offset_x - hex_size//3, y)
                    ]
                    pattern_draw.polygon(points, outline=hex_color, width=2)
            
            img = Image.alpha_composite(img.convert('RGBA'), pattern_img).convert('RGB')
        
        return img
    
    def get_fonts(self):
        """Get fonts for text overlay"""
        fonts = {}
        font_sizes = {"title": 200, "subtitle": 100, "small": 60}
        
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
        """Create text overlay"""
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
                draw.text((x + 8, y + 8), line, fill=(0, 0, 0, 255), font=fonts["title"])
                draw.text((x + 4, y + 4), line, fill=(0, 0, 0, 200), font=fonts["title"])
                # White text
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
        
        # Subtitle
        if subtitle:
            subtitle_y = title_y + len(title_lines) * 250 + 80
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            # Box background
            padding = 40
            draw.rounded_rectangle([x-padding, subtitle_y-20, x+text_width+padding, subtitle_y+120], 
                                 radius=20, fill=(0, 0, 0, 180))
            
            # Subtitle text
            draw.text((x + 3, subtitle_y + 3), subtitle, fill=(0, 0, 0, 200), font=fonts["subtitle"])
            draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        
        return overlay
    
    def generate_cover(self, title, subtitle, client="hedera", style="dark_theme", use_trained_lora=True):
        """Generate complete cover with background and text"""
        try:
            logger.info(f"🎨 Generating cover: {title} (client: {client}, style: {style}, LoRA: {use_trained_lora})")
            
            width, height = 1800, 900
            
            # Try LoRA generation first if enabled and available
            background = None
            if use_trained_lora and self.lora_available:
                background = self.generate_with_trained_lora(client, style, title)
            
            # Fallback to programmatic if LoRA failed or disabled
            if background is None:
                background = self.generate_programmatic_fallback(width, height, client, style)
            
            # Convert to RGBA for compositing
            base_rgba = background.convert("RGBA")
            
            # Add text overlay
            fonts = self.get_fonts()
            text_overlay = self.create_text_overlay(width, height, title, subtitle, fonts)
            base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            # Add watermark
            if self.watermark:
                watermark_resized = self.watermark.resize((width, height), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, watermark_resized)
            else:
                final_image = base_rgba
            
            generation_method = "trained_lora" if (use_trained_lora and self.current_lora) else "programmatic_fallback"
            logger.info(f"✅ Cover generated using: {generation_method}")
            
            return final_image.convert("RGB"), generation_method
            
        except Exception as e:
            logger.error(f"❌ Cover generation failed: {str(e)}")
            return None, "error"

# Initialize generator
generator = LoRACoverGenerator()

@app.get("/")
async def root():
    """Root endpoint"""
    available_loras = list(generator.lora_available.keys()) if generator.lora_available else ["none"]
    
    return {
        "message": "Trained LoRA Cover Generator",
        "status": "running",
        "available_loras": available_loras,
        "pipeline_loaded": generator.pipeline is not None,
        "endpoints": ["/generate", "/health", "/lora-status"],
        "version": "4.0.0"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "service": "lora-cover-generator",
        "lora_count": len(generator.lora_available)
    }

@app.get("/lora-status")
async def lora_status():
    """Get LoRA model status"""
    return {
        "available_loras": generator.lora_available,
        "current_lora": generator.current_lora,
        "pipeline_loaded": generator.pipeline is not None
    }

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    """Generate cover using trained LoRA or fallback"""
    try:
        logger.info(f"🎨 Request: {request.title} (LoRA: {request.use_trained_lora})")
        
        # Generate the cover
        result = generator.generate_cover(
            title=request.title,
            subtitle=request.subtitle,
            client=request.client,
            style=request.style or "dark_theme",
            use_trained_lora=request.use_trained_lora
        )
        
        if result[0] is None:
            raise HTTPException(status_code=500, detail="Generation failed")
        
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
                "resolution": "1800x900"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"🚀 Starting LoRA Cover Generator on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)