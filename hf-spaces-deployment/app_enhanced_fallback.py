#!/usr/bin/env python3
"""
Enhanced Fallback Generator with Universal LoRA Support
Works without heavy ML dependencies but provides Universal LoRA path when available
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
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Enhanced Crypto News Generator with Universal LoRA Support",
    description="Generate crypto news covers with Universal LoRA or enhanced fallback",
    version="3.0.0"
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

class EnhancedUniversalGenerator:
    def __init__(self):
        self.watermark = None
        self.universal_lora_available = False
        self.lora_pipeline = None
        
        # Initialize components
        self.load_watermark()
        self.check_universal_lora()
        self.try_load_lora_pipeline()
        
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
    
    def check_universal_lora(self):
        """Check if Universal LoRA model is available"""
        lora_paths = [
            "models/lora/crypto_cover_styles_lora.safetensors",
            "models/lora/universal/crypto_cover_universal_lora.pt",
            "crypto_cover_styles_lora.safetensors"
        ]
        
        for path in lora_paths:
            if os.path.exists(path):
                self.universal_lora_available = True
                logger.info(f"✅ Found Universal LoRA: {path}")
                return
        
        logger.info("📝 No Universal LoRA found - using enhanced fallback")
        self.universal_lora_available = False
    
    def try_load_lora_pipeline(self):
        """Try to load LoRA pipeline if dependencies available"""
        if not self.universal_lora_available:
            return
        
        try:
            # Try to import heavy dependencies
            import torch
            from diffusers import StableDiffusionXLPipeline
            
            logger.info("🚀 Loading Universal LoRA pipeline...")
            
            # Load pipeline (CPU-friendly for HF Spaces)
            device = "cpu"  # HF Spaces typically uses CPU
            self.lora_pipeline = StableDiffusionXLPipeline.from_pretrained(
                "stabilityai/stable-diffusion-xl-base-1.0",
                torch_dtype=torch.float32,
                use_safetensors=True,
                variant=None
            )
            
            self.lora_pipeline.to(device)
            
            # Load Universal LoRA weights
            lora_path = "models/lora/crypto_cover_styles_lora.safetensors"
            if os.path.exists(lora_path):
                self.lora_pipeline.load_lora_weights(lora_path)
                logger.info("✅ Universal LoRA loaded successfully!")
                return
            
        except ImportError as e:
            logger.info(f"📝 LoRA dependencies not available: {e}")
        except Exception as e:
            logger.warning(f"⚠️ LoRA pipeline loading failed: {e}")
        
        # Reset if loading failed
        self.lora_pipeline = None
        self.universal_lora_available = False
    
    def generate_with_universal_lora(self, title, client, style):
        """Generate using Universal LoRA if available"""
        if not self.lora_pipeline:
            return None
        
        try:
            # Create Universal LoRA prompt
            style_prompts = {
                "energy_fields": f"crypto news cover background, glowing energy fields, particle effects, {client} branding, professional design",
                "dark_theme": f"crypto news cover background, dark professional theme, geometric patterns, {client} branding, corporate style",
                "network_nodes": f"crypto news cover background, connected network nodes, tech visualization, {client} branding, futuristic design",
                "particle_waves": f"crypto news cover background, flowing particle waves, dynamic motion, {client} branding, energy flow",
                "corporate_style": f"crypto news cover background, clean corporate design, professional gradients, {client} branding",
                "ultra_visible": f"crypto news cover background, high contrast design, bright elements, {client} branding, professional"
            }
            
            prompt = style_prompts.get(style, f"crypto news cover background, {style}, {client} branding, professional design")
            negative_prompt = "text, letters, words, watermark, signature, blurry, low quality"
            
            logger.info(f"🎨 Generating with Universal LoRA: {client}/{style}")
            
            # Generate with Universal LoRA
            image = self.lora_pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                height=512,
                width=1024,  # 2:1 aspect ratio
                num_inference_steps=20,  # Fewer steps for HF Spaces
                guidance_scale=7.5,
                num_images_per_prompt=1
            ).images[0]
            
            # Upscale to final resolution
            image = image.resize((1800, 900), Image.Resampling.LANCZOS)
            
            logger.info("✅ Universal LoRA generation successful")
            return image
            
        except Exception as e:
            logger.error(f"❌ Universal LoRA generation failed: {e}")
            return None
    
    def generate_enhanced_fallback(self, width, height, client, style):
        """Enhanced fallback generation with improved visuals"""
        logger.info(f"🎨 Enhanced fallback generation: {client}/{style}")
        
        # Enhanced client colors
        colors = {
            'hedera': {
                'primary': (138, 43, 226),    # Purple
                'secondary': (75, 0, 130),    # Dark purple
                'accent': (186, 85, 211),     # Light purple
                'energy': (255, 100, 255)     # Bright magenta
            },
            'algorand': {
                'primary': (0, 120, 140),     # Teal
                'secondary': (0, 85, 100),    # Dark teal
                'accent': (75, 163, 224),     # Light teal
                'energy': (0, 255, 255)       # Cyan
            },
            'constellation': {
                'primary': (72, 61, 139),     # Dark slate blue
                'secondary': (25, 25, 112),   # Midnight blue
                'accent': (106, 90, 205),     # Slate blue
                'energy': (255, 255, 255)     # White
            },
            'bitcoin': {
                'primary': (255, 165, 0),     # Orange
                'secondary': (184, 115, 51),  # Dark orange
                'accent': (255, 215, 0),      # Gold
                'energy': (255, 255, 0)       # Yellow
            },
            'ethereum': {
                'primary': (98, 126, 234),    # Ethereum blue
                'secondary': (52, 73, 154),   # Dark blue
                'accent': (162, 177, 255),    # Light blue
                'energy': (255, 255, 255)     # White
            }
        }
        
        client_colors = colors.get(client, colors['hedera'])
        
        # Create base with subtle gradient
        img = Image.new('RGB', (width, height), (10, 10, 15))
        draw = ImageDraw.Draw(img)
        
        # Enhanced style-specific generation
        if style == "dark_theme":
            # Professional dark gradient
            for y in range(height):
                gradient_factor = y / height
                r = int(15 + gradient_factor * 45)
                g = int(15 + gradient_factor * 35) 
                b = int(20 + gradient_factor * 60)
                draw.line([(0, y), (width, y)], fill=(r, g, b))
            
            # Geometric overlay
            overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            
            # Professional hexagon pattern
            hex_size = 80
            for y in range(0, height + hex_size, hex_size):
                for x in range(0, width + hex_size, hex_size):
                    offset_x = x + (hex_size // 2 if (y // hex_size) % 2 else 0)
                    alpha = random.randint(60, 120)
                    hex_color = client_colors['accent'] + (alpha,)
                    
                    # Professional diamond pattern
                    points = [
                        (offset_x, y - hex_size//3),
                        (offset_x + hex_size//3, y),
                        (offset_x, y + hex_size//3),
                        (offset_x - hex_size//3, y)
                    ]
                    overlay_draw.polygon(points, outline=hex_color, width=2)
            
            img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        
        elif style == "energy_fields":
            # Dynamic energy field generation
            for i in range(30):
                x = random.randint(0, width)
                y = random.randint(0, height)
                size = random.randint(60, 150)
                
                energy_overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                energy_draw = ImageDraw.Draw(energy_overlay)
                
                # Multi-layer energy effect
                for radius in range(size, 0, -8):
                    alpha = int(200 * (1 - radius/size))
                    color = client_colors['energy'] + (alpha,)
                    energy_draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=color)
                
                # Bright core
                core_size = size // 3
                core_color = client_colors['primary'] + (255,)
                energy_draw.ellipse([x-core_size, y-core_size, x+core_size, y+core_size], fill=core_color)
                
                img = Image.alpha_composite(img.convert('RGBA'), energy_overlay).convert('RGB')
        
        elif style == "network_nodes":
            # Professional network visualization
            nodes = []
            for i in range(25):
                x = random.randint(100, width-100)
                y = random.randint(100, height-100)
                nodes.append((x, y))
                
                # Professional nodes
                node_size = random.randint(15, 35)
                draw.ellipse([x-node_size, y-node_size, x+node_size, y+node_size], 
                           fill=client_colors['accent'])
                
                # Glow effect
                glow_overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                glow_draw = ImageDraw.Draw(glow_overlay)
                for r in range(node_size+10, node_size+30):
                    alpha = max(0, 100 - (r-node_size)*4)
                    glow_color = client_colors['primary'] + (alpha,)
                    glow_draw.ellipse([x-r, y-r, x+r, y+r], outline=glow_color, width=2)
                img = Image.alpha_composite(img.convert('RGBA'), glow_overlay).convert('RGB')
            
            # Professional connections
            for i in range(len(nodes)):
                for j in range(i+1, min(i+4, len(nodes))):
                    if random.random() < 0.4:
                        draw.line([nodes[i], nodes[j]], fill=client_colors['secondary'], width=3)
        
        # Add professional lighting
        lighting = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        lighting_draw = ImageDraw.Draw(lighting)
        
        # Radial lighting effect
        center_x, center_y = width // 2, height // 2
        max_radius = min(width, height) // 2
        
        for radius in range(max_radius, 0, -20):
            alpha = int(40 * (1 - radius / max_radius))
            light_color = client_colors['primary'] + (alpha,)
            lighting_draw.ellipse([center_x-radius, center_y-radius, center_x+radius, center_y+radius], 
                                outline=light_color, width=5)
        
        img = Image.alpha_composite(img.convert('RGBA'), lighting).convert('RGB')
        
        logger.info("✅ Enhanced fallback generation complete")
        return img
    
    def get_fonts(self):
        """Load fonts with proper sizing"""
        fonts = {}
        font_sizes = {
            "title": 200,    # Large, professional title
            "subtitle": 100, # Professional subtitle
            "small": 60     # Small text
        }
        
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/System/Library/Fonts/Arial.ttc"
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
        """Create professional text overlay"""
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        title_y = height // 4
        
        if title:
            title = title.upper()
            
            # Smart line breaking
            words = title.split()
            if len(words) > 4:
                mid = len(words) // 2
                title_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
            else:
                title_lines = [title]
            
            # Draw title with professional styling
            for i, line in enumerate(title_lines):
                bbox = draw.textbbox((0, 0), line, font=fonts["title"])
                text_width = bbox[2] - bbox[0]
                x = (width - text_width) // 2
                y = title_y + (i * 250)
                
                # Professional shadow layers
                draw.text((x + 8, y + 8), line, fill=(0, 0, 0, 255), font=fonts["title"])
                draw.text((x + 4, y + 4), line, fill=(0, 0, 0, 200), font=fonts["title"])
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
        
        # Professional subtitle
        if subtitle:
            subtitle_y = title_y + len(title_lines) * 250 + 100
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            # Professional box
            padding = 50
            box_coords = [x-padding, subtitle_y-25, x+text_width+padding, subtitle_y+125]
            draw.rounded_rectangle(box_coords, radius=25, fill=(0, 0, 0, 180))
            draw.rounded_rectangle([c+3 for c in box_coords[:2]] + [c-3 for c in box_coords[2:]], 
                                 radius=22, outline=(255, 255, 255, 80), width=2)
            
            # Subtitle text
            draw.text((x + 3, subtitle_y + 3), subtitle, fill=(0, 0, 0, 255), font=fonts["subtitle"])
            draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        
        return overlay
    
    def generate_cover(self, title, subtitle, client="hedera", style="dark_theme", use_trained_lora=True):
        """Generate cover with Universal LoRA or enhanced fallback"""
        try:
            logger.info(f"🎨 Generating cover: {title} (client: {client}, style: {style}, LoRA: {use_trained_lora})")
            
            width, height = 1800, 900
            generation_method = "enhanced_fallback"
            
            # Try Universal LoRA first if requested and available
            background = None
            if use_trained_lora and self.lora_pipeline:
                background = self.generate_with_universal_lora(title, client, style)
                if background:
                    generation_method = "universal_lora"
            
            # Fallback to enhanced generation
            if background is None:
                background = self.generate_enhanced_fallback(width, height, client, style)
            
            # Convert to RGBA for compositing
            base_rgba = background.convert("RGBA")
            
            # Add professional text overlay
            fonts = self.get_fonts()
            text_overlay = self.create_text_overlay(width, height, title, subtitle, fonts)
            base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            # Apply watermark
            if self.watermark:
                watermark_resized = self.watermark.resize((width, height), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, watermark_resized)
            else:
                final_image = base_rgba
            
            logger.info(f"✅ Cover generated using: {generation_method}")
            return final_image.convert("RGB"), generation_method
            
        except Exception as e:
            logger.error(f"❌ Cover generation failed: {str(e)}")
            return None, "error"

# Initialize generator
generator = EnhancedUniversalGenerator()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Enhanced Crypto News Generator with Universal LoRA Support",
        "status": "running",
        "universal_lora_available": generator.universal_lora_available,
        "lora_pipeline_loaded": generator.lora_pipeline is not None,
        "capabilities": {
            "universal_lora": generator.universal_lora_available,
            "enhanced_fallback": True,
            "styles": ["energy_fields", "dark_theme", "network_nodes", "particle_waves", "corporate_style", "ultra_visible"],
            "clients": ["hedera", "algorand", "constellation", "bitcoin", "ethereum"]
        },
        "version": "3.0.0"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "service": "enhanced-universal-generator",
        "universal_lora": generator.universal_lora_available
    }

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    """Generate cover using Universal LoRA or enhanced fallback"""
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
                "universal_lora_available": generator.universal_lora_available,
                "resolution": "1800x900",
                "generator": "enhanced-universal-v3"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"🚀 Starting Enhanced Universal Generator on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)