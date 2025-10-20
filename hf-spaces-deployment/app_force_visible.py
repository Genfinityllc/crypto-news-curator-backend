#!/usr/bin/env python3
"""
FORCE VISIBLE LoRA Generator - Ultra Enhanced Version
This version uses extremely large fonts and high-contrast visual elements
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
    title="FORCE VISIBLE LoRA Generator",
    description="Ultra enhanced crypto news images with FORCED visibility",
    version="3.0.0"
)

class GenerationRequest(BaseModel):
    title: str
    subtitle: str = "CRYPTO NEWS"
    client: str = "hedera"
    style: Optional[str] = "dark_theme"

class GenerationResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None

class ForceVisibleGenerator:
    def __init__(self):
        self.watermark = None
        self.load_watermark()
        
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
    
    def get_fonts(self):
        """Load system fonts with MASSIVE sizes"""
        fonts = {}
        
        # EXTREMELY LARGE font sizes - impossible to miss
        font_sizes = {
            "title": 300,    # MASSIVE - was 180
            "subtitle": 150,  # HUGE - was 90
            "small": 80      # BIG - was 50
        }
        
        # Try to load system fonts
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/System/Library/Fonts/Arial.ttc",
            "/usr/share/fonts/arial.ttf"
        ]
        
        for size_name, size in font_sizes.items():
            fonts[size_name] = None
            for font_path in font_paths:
                try:
                    if os.path.exists(font_path):
                        fonts[size_name] = ImageFont.truetype(font_path, size)
                        logger.info(f"✅ FORCE LOADED {size_name} font: {font_path} at MASSIVE size {size}")
                        break
                except Exception as e:
                    logger.debug(f"Font load failed: {font_path} - {e}")
                    continue
            
            # If no font loaded, use default but with proper sizing
            if fonts[size_name] is None:
                try:
                    fonts[size_name] = ImageFont.load_default()
                    logger.warning(f"⚠️ Using default font for {size_name} at size {size}")
                except:
                    fonts[size_name] = ImageFont.load_default()
        
        return fonts
    
    def create_ultra_visible_background(self, width, height, client, style):
        """Create ULTRA VISIBLE background that cannot be missed"""
        
        # Client color schemes - BRIGHTER COLORS
        colors = {
            'hedera': {
                'primary': (200, 100, 255),    # BRIGHT Purple
                'secondary': (150, 50, 200),   # BRIGHT Dark purple
                'accent': (255, 150, 255),     # BRIGHT Light purple
                'energy': (255, 100, 255)      # BRIGHT Magenta
            },
            'algorand': {
                'primary': (0, 200, 220),      # BRIGHT Teal
                'secondary': (0, 150, 180),    # BRIGHT Dark teal
                'accent': (100, 220, 255),     # BRIGHT Light teal
                'energy': (0, 255, 255)        # BRIGHT Cyan
            },
            'constellation': {
                'primary': (120, 100, 200),    # BRIGHT Dark slate blue
                'secondary': (80, 80, 150),    # BRIGHT Midnight blue
                'accent': (150, 130, 255),     # BRIGHT Slate blue
                'energy': (255, 255, 255)      # WHITE
            }
        }
        
        client_colors = colors.get(client, colors['hedera'])
        
        # Create base image with VISIBLE gradient instead of pure black
        img = Image.new('RGB', (width, height), (20, 20, 30))  # Dark but not pure black
        draw = ImageDraw.Draw(img)
        
        logger.info(f"🔥 Creating ULTRA VISIBLE {style} with {client} colors")
        
        # FORCE VISIBLE ELEMENTS - NO SUBTLETY
        if style == "dark_theme":
            # Create VERY VISIBLE dark theme
            
            # Strong gradient background
            for y in range(height):
                gradient_factor = y / height
                r = int(20 + gradient_factor * 60)  # 20-80 range
                g = int(20 + gradient_factor * 40)  # 20-60 range  
                b = int(30 + gradient_factor * 80)  # 30-110 range
                draw.line([(0, y), (width, y)], fill=(r, g, b))
            
            # MASSIVE geometric patterns
            pattern_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            pattern_draw = ImageDraw.Draw(pattern_img)
            
            # LARGE hexagonal grid
            hex_size = 120  # DOUBLED size
            for y in range(0, height + hex_size, hex_size):
                for x in range(0, width + hex_size, hex_size):
                    offset_x = x + (hex_size // 2 if (y // hex_size) % 2 else 0)
                    
                    # BRIGHT hexagon outline - VERY VISIBLE
                    alpha = random.randint(120, 200)  # MUCH higher alpha
                    hex_color = client_colors['accent'] + (alpha,)
                    
                    # Larger diamond shape
                    points = [
                        (offset_x, y - hex_size//2),
                        (offset_x + hex_size//2, y),
                        (offset_x, y + hex_size//2),
                        (offset_x - hex_size//2, y)
                    ]
                    pattern_draw.polygon(points, outline=hex_color, width=4)  # THICK lines
            
            img = Image.alpha_composite(img.convert('RGBA'), pattern_img).convert('RGB')
            
            # HUGE lighting spots - IMPOSSIBLE TO MISS
            for i in range(15):  # MORE spots
                x = random.randint(100, width-100)
                y = random.randint(100, height-100)
                light_size = random.randint(200, 400)  # MASSIVE spots
                
                light_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                light_draw = ImageDraw.Draw(light_img)
                
                # BRIGHT light spot
                for radius in range(light_size, 0, -20):
                    alpha = int(80 * (1 - radius/light_size))  # HIGHER alpha
                    light_color = client_colors['energy'] + (alpha,)
                    light_draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=light_color)
                
                img = Image.alpha_composite(img.convert('RGBA'), light_img).convert('RGB')
        
        else:  # energy_fields or other styles
            # MASSIVE energy fields
            for i in range(100):  # DOUBLED count
                x = random.randint(0, width)
                y = random.randint(0, height)
                size = random.randint(80, 250)  # MUCH larger
                
                energy_img = Image.new('RGBA', (size*4, size*4), (0, 0, 0, 0))
                energy_draw = ImageDraw.Draw(energy_img)
                
                center = size * 2
                for radius in range(size, 0, -5):
                    # MAXIMUM visibility alpha
                    alpha = int(255 * (1 - radius/size) * 0.9)  # NEAR maximum
                    color = client_colors['energy'] + (alpha,)
                    energy_draw.ellipse([center-radius, center-radius, center+radius, center+radius], 
                                      fill=color)
                
                # BRIGHT core
                core_alpha = 255  # MAXIMUM
                core_color = client_colors['primary'] + (core_alpha,)
                energy_draw.ellipse([center-size//2, center-size//2, center+size//2, center+size//2], 
                                  fill=core_color)
                
                img.paste(energy_img, (x-center, y-center), energy_img)
        
        logger.info("✅ ULTRA VISIBLE background created - IMPOSSIBLE TO MISS")
        return img
    
    def create_massive_text_overlay(self, width, height, title, subtitle, fonts):
        """Create MASSIVE text overlay that cannot be missed"""
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Title positioning - HIGHER up for massive text
        title_y = height // 6  # Moved up
        
        logger.info(f"📝 Creating MASSIVE text: '{title}'")
        
        # Draw MASSIVE title
        if title:
            title = title.upper()
            
            # Force break into shorter lines for massive text
            words = title.split()
            if len(words) > 3:
                mid = len(words) // 2
                title_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
            elif len(words) > 1:
                title_lines = [words[0], " ".join(words[1:])]
            else:
                title_lines = [title]
            
            for i, line in enumerate(title_lines):
                bbox = draw.textbbox((0, 0), line, font=fonts["title"])
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
                
                x = (width - text_width) // 2
                y = title_y + (i * 350)  # MASSIVE spacing
                
                # HUGE shadows for maximum visibility
                draw.text((x + 12, y + 12), line, fill=(0, 0, 0, 255), font=fonts["title"])
                draw.text((x + 8, y + 8), line, fill=(0, 0, 0, 200), font=fonts["title"])
                draw.text((x + 4, y + 4), line, fill=(0, 0, 0, 150), font=fonts["title"])
                
                # PURE WHITE text - maximum contrast
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
                
                logger.info(f"🔤 MASSIVE text line '{line}' at ({x}, {y}) size: {text_width}x{text_height}")
        
        # MASSIVE subtitle
        if subtitle:
            subtitle_y = title_y + len(title_lines) * 350 + 100
            
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            # HUGE subtitle box
            box_padding = 50  # DOUBLED padding
            box_x1 = x - box_padding
            box_y1 = subtitle_y - box_padding // 2
            box_x2 = x + text_width + box_padding
            box_y2 = subtitle_y + 150 + box_padding // 2  # Adjusted for larger font
            
            # BRIGHT box with strong contrast
            draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], 
                                 radius=25, fill=(0, 0, 0, 200))  # DARKER box
            
            # BRIGHT inner glow
            draw.rounded_rectangle([box_x1+4, box_y1+4, box_x2-4, box_y2-4], 
                                 radius=21, outline=(255, 255, 255, 120), width=3)
            
            # HUGE subtitle shadow
            draw.text((x + 6, subtitle_y + 6), subtitle, fill=(0, 0, 0, 255), font=fonts["subtitle"])
            # PURE WHITE subtitle
            draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        
        return overlay
    
    def generate_cover(self, title, subtitle, client="hedera", style="dark_theme"):
        """Generate ULTRA VISIBLE cover"""
        try:
            logger.info(f"🔥 FORCE GENERATING ULTRA VISIBLE: {title} (client: {client}, style: {style})")
            
            width, height = 1800, 900
            
            # Create ULTRA VISIBLE background
            background = self.create_ultra_visible_background(width, height, client, style)
            base_rgba = background.convert("RGBA")
            
            # Get fonts and add MASSIVE text
            fonts = self.get_fonts()
            text_overlay = self.create_massive_text_overlay(width, height, title, subtitle, fonts)
            base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            # Apply watermark
            if self.watermark:
                watermark_resized = self.watermark.resize((width, height), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, watermark_resized)
            else:
                final_image = base_rgba
            
            logger.info("🔥 ULTRA VISIBLE cover FORCE GENERATED - IMPOSSIBLE TO MISS!")
            return final_image.convert("RGB")
            
        except Exception as e:
            logger.error(f"❌ FORCE generation failed: {str(e)}")
            return None

# Initialize generator
generator = ForceVisibleGenerator()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "FORCE VISIBLE LoRA Generator - ULTRA ENHANCED",
        "status": "FORCING VISIBILITY",
        "endpoints": ["/generate", "/health"],
        "version": "3.0.0-ULTRA"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "FORCE HEALTHY", "service": "ultra-visible-generator"}

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    """Generate ULTRA VISIBLE crypto news cover"""
    try:
        logger.info(f"🔥 FORCE GENERATING: {request.title}")
        
        # Generate the ULTRA VISIBLE cover
        image = generator.generate_cover(
            title=request.title,
            subtitle=request.subtitle,
            client=request.client,
            style=request.style or "dark_theme"
        )
        
        if image is None:
            raise HTTPException(status_code=500, detail="FORCE generation failed")
        
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
                "generator": "ULTRA-VISIBLE-FORCE",
                "resolution": "1800x900",
                "visibility": "MAXIMUM"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ FORCE generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"FORCE generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"🔥 STARTING ULTRA VISIBLE FORCE GENERATOR on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)