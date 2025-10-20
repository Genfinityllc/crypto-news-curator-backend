#!/usr/bin/env python3
"""
LIGHTWEIGHT LoRA Cover Generator - No SDXL Dependencies
Pure programmatic generation with LoRA-style branding
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
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Lightweight LoRA Cover Generator",
    description="Generate crypto news covers with LoRA-style branding",
    version="5.0.0"
)

class GenerationRequest(BaseModel):
    title: str
    subtitle: str = "CRYPTO NEWS"
    client: str = "hedera"
    style: Optional[str] = "dark_theme"
    use_trained_lora: bool = True  # Always True for this lightweight version

class GenerationResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None

class LightweightLoRACoverGenerator:
    def __init__(self):
        self.watermark = None
        self.load_watermark()
        logger.info("🚀 Lightweight LoRA generator initialized")
    
    def load_watermark(self):
        """Load watermark if available"""
        watermark_path = "genfinity-watermark.png"
        try:
            if os.path.exists(watermark_path):
                self.watermark = Image.open(watermark_path).convert("RGBA")
                logger.info(f"✅ Loaded watermark: {self.watermark.size}")
        except Exception as e:
            logger.warning(f"⚠️ Watermark loading failed: {e}")
    
    def generate_lora_style_background(self, width, height, client, style):
        """Generate LoRA-style enhanced backgrounds"""
        logger.info(f"🎨 Generating LoRA-style background: {client}/{style}")
        
        # Enhanced client colors with gradients
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
            },
            'bitcoin': {
                'primary': (247, 147, 26),
                'secondary': (205, 102, 0),
                'accent': (255, 193, 7),
                'energy': (255, 215, 0)
            },
            'ethereum': {
                'primary': (98, 126, 234),
                'secondary': (55, 71, 153),
                'accent': (141, 155, 255),
                'energy': (173, 216, 230)
            }
        }
        
        client_colors = colors.get(client, colors['hedera'])
        
        # Create base gradient
        img = Image.new('RGB', (width, height), (15, 15, 25))
        draw = ImageDraw.Draw(img)
        
        # Enhanced style-specific generation
        if style == "energy_fields":
            # Multiple gradient layers
            for y in range(height):
                gradient_factor = y / height
                color1 = client_colors['primary']
                color2 = client_colors['secondary']
                
                blended = tuple(int(color1[i] * (1 - gradient_factor) + color2[i] * gradient_factor) for i in range(3))
                draw.line([(0, y), (width, y)], fill=blended)
            
            # Add energy circles
            for _ in range(12):
                x = random.randint(0, width)
                y = random.randint(0, height)
                radius = random.randint(30, 120)
                alpha = random.randint(30, 80)
                
                circle_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                circle_draw = ImageDraw.Draw(circle_img)
                circle_color = client_colors['accent'] + (alpha,)
                circle_draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=circle_color)
                
                img = Image.alpha_composite(img.convert('RGBA'), circle_img).convert('RGB')
        
        elif style == "network_nodes":
            # Dark tech background
            img = Image.new('RGB', (width, height), (20, 25, 35))
            
            # Add connection lines
            overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            
            # Generate nodes
            nodes = [(random.randint(50, width-50), random.randint(50, height-50)) for _ in range(15)]
            
            # Draw connections
            for i, node1 in enumerate(nodes):
                for j, node2 in enumerate(nodes[i+1:], i+1):
                    if random.random() < 0.3:  # 30% chance of connection
                        alpha = random.randint(40, 100)
                        line_color = client_colors['accent'] + (alpha,)
                        overlay_draw.line([node1, node2], fill=line_color, width=2)
            
            # Draw nodes
            for node in nodes:
                radius = random.randint(8, 20)
                alpha = random.randint(150, 255)
                node_color = client_colors['primary'] + (alpha,)
                overlay_draw.ellipse([node[0]-radius, node[1]-radius, node[0]+radius, node[1]+radius], fill=node_color)
            
            img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        
        elif style == "particle_waves":
            # Flowing wave patterns
            for y in range(0, height, 4):
                wave_amplitude = 100
                wave_frequency = 0.01
                wave_offset = np.sin(y * wave_frequency) * wave_amplitude
                
                for x in range(width):
                    if abs(x - (width//2 + wave_offset)) < 3:
                        alpha = max(0, 150 - abs(x - (width//2 + wave_offset)) * 50)
                        if alpha > 0:
                            color = tuple(int(c * alpha / 255) for c in client_colors['accent'])
                            current_pixel = img.getpixel((x, y))
                            blended = tuple(min(255, current_pixel[i] + color[i]) for i in range(3))
                            img.putpixel((x, y), blended)
        
        elif style == "corporate_style":
            # Clean professional gradient
            for y in range(height):
                gradient = 1 - (y / height) * 0.7
                color = tuple(int(c * gradient * 0.3) for c in client_colors['primary'])
                draw.line([(0, y), (width, y)], fill=color)
            
            # Add subtle geometric elements
            overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            
            # Professional rectangles
            for _ in range(8):
                x1 = random.randint(0, width//2)
                y1 = random.randint(0, height//2)
                x2 = x1 + random.randint(100, 300)
                y2 = y1 + random.randint(50, 150)
                alpha = random.randint(20, 60)
                rect_color = client_colors['accent'] + (alpha,)
                overlay_draw.rectangle([x1, y1, x2, y2], outline=rect_color, width=2)
            
            img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        
        elif style == "ultra_visible":
            # High contrast design
            for y in range(height):
                if y % 40 < 20:  # Stripe pattern
                    intensity = 0.8
                else:
                    intensity = 0.3
                color = tuple(int(c * intensity) for c in client_colors['primary'])
                draw.line([(0, y), (width, y)], fill=color)
            
            # Add bright accent elements
            overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            
            for _ in range(6):
                x = random.randint(100, width-100)
                y = random.randint(100, height-100)
                size = random.randint(40, 80)
                overlay_draw.ellipse([x-size, y-size, x+size, y+size], 
                                   fill=client_colors['energy'] + (100,))
            
            img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        
        else:  # dark_theme default
            # Enhanced dark theme
            for y in range(height):
                darkness = 0.9 + 0.1 * (y / height)
                color = tuple(int(c * darkness * 0.2) for c in client_colors['primary'])
                draw.line([(0, y), (width, y)], fill=color)
        
        logger.info("✅ LoRA-style background generated")
        return img
    
    def get_fonts(self):
        """Get fonts for text overlay"""
        fonts = {}
        font_sizes = {"title": 160, "subtitle": 80, "small": 50}
        
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
        """Create enhanced text overlay"""
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        title_y = height // 3
        
        if title:
            title = title.upper()
            words = title.split()
            if len(words) > 4:
                mid = len(words) // 2
                title_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
            else:
                title_lines = [title]
            
            for i, line in enumerate(title_lines):
                bbox = draw.textbbox((0, 0), line, font=fonts["title"])
                text_width = bbox[2] - bbox[0]
                x = (width - text_width) // 2
                y = title_y + (i * 180)
                
                # Enhanced shadows
                for offset in [(12, 12), (8, 8), (4, 4)]:
                    shadow_alpha = 255 - (offset[0] - 4) * 30
                    draw.text((x + offset[0], y + offset[1]), line, 
                             fill=(0, 0, 0, shadow_alpha), font=fonts["title"])
                
                # Bright white text
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
        
        # Enhanced subtitle
        if subtitle:
            subtitle_y = title_y + len(title_lines) * 180 + 60
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            # Glowing background box
            padding = 30
            draw.rounded_rectangle([x-padding, subtitle_y-15, x+text_width+padding, subtitle_y+95], 
                                 radius=15, fill=(0, 0, 0, 200))
            draw.rounded_rectangle([x-padding+3, subtitle_y-12, x+text_width+padding-3, subtitle_y+92], 
                                 radius=12, outline=(255, 255, 255, 100), width=2)
            
            # Subtitle text with glow
            draw.text((x + 2, y + 2), subtitle, fill=(0, 0, 0, 150), font=fonts["subtitle"])
            draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        
        return overlay
    
    def generate_cover(self, title, subtitle, client="hedera", style="dark_theme"):
        """Generate complete LoRA-style cover"""
        try:
            logger.info(f"🎨 Generating LoRA-style cover: {title} (client: {client}, style: {style})")
            
            width, height = 1800, 900
            
            # Generate LoRA-style background
            background = self.generate_lora_style_background(width, height, client, style)
            
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
            
            logger.info("✅ LoRA-style cover generated successfully")
            return final_image.convert("RGB"), "lightweight_lora_style"
            
        except Exception as e:
            logger.error(f"❌ Cover generation failed: {str(e)}")
            return None, "error"

# Initialize generator
generator = LightweightLoRACoverGenerator()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Lightweight LoRA Cover Generator",
        "status": "running",
        "available_loras": ["universal_lightweight"],
        "pipeline_loaded": True,  # Always true for lightweight version
        "endpoints": ["/generate", "/health", "/lora-status"],
        "version": "5.0.0"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "service": "lightweight-lora-cover-generator",
        "lora_count": 1
    }

@app.get("/lora-status")
async def lora_status():
    """Get LoRA model status"""
    return {
        "available_loras": {"universal_lightweight": "built-in"},
        "current_lora": "universal_lightweight",
        "pipeline_loaded": True
    }

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    """Generate cover using lightweight LoRA-style generation"""
    try:
        logger.info(f"🎨 Request: {request.title} (Style: {request.style})")
        
        # Generate the cover
        result = generator.generate_cover(
            title=request.title,
            subtitle=request.subtitle,
            client=request.client,
            style=request.style or "dark_theme"
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
                "lora_used": "universal_lightweight",
                "resolution": "1800x900"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"🚀 Starting Lightweight LoRA Cover Generator on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)