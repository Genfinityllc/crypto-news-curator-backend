#!/usr/bin/env python3
"""
Lightweight LoRA Generator for HF Spaces
Optimized for CPU and memory constraints while still providing detailed backgrounds
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
    title="Enhanced LoRA Crypto News Image Generator",
    description="Generate detailed crypto news images with brand-specific backgrounds",
    version="2.1.0"
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

class EnhancedGenerator:
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
        """Load system fonts with fallback"""
        fonts = {}
        
        # Increased font sizes for better visibility
        font_sizes = {
            "title": 180,  # Increased from 120
            "subtitle": 90, # Increased from 60
            "small": 50    # Increased from 40
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
                        logger.info(f"✅ Loaded {size_name} font: {font_path} at size {size}")
                        break
                except Exception as e:
                    logger.debug(f"Font load failed: {font_path} - {e}")
                    continue
            
            # If no font loaded, use default but with proper sizing
            if fonts[size_name] is None:
                try:
                    # Create a default font that actually works
                    fonts[size_name] = ImageFont.load_default()
                    logger.warning(f"⚠️ Using default font for {size_name}")
                except:
                    fonts[size_name] = ImageFont.load_default()
        
        return fonts
    
    def create_enhanced_background(self, width, height, client, style):
        """Create detailed brand-specific background without ML"""
        
        # Client color schemes
        colors = {
            'hedera': {
                'primary': (138, 43, 226),    # Purple
                'secondary': (75, 0, 130),    # Dark purple
                'accent': (186, 85, 211),     # Light purple
                'energy': (255, 0, 255)       # Magenta
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
            }
        }
        
        client_colors = colors.get(client, colors['hedera'])
        
        # Create base image
        img = Image.new('RGB', (width, height), (0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Create energy field background
        if style == "energy_fields":
            logger.info(f"🌟 Creating energy fields with {client} colors")
            # Create flowing energy patterns
            for i in range(50):
                x = random.randint(0, width)
                y = random.randint(0, height)
                size = random.randint(30, 120)  # Larger sizes
                
                # Create energy orb with more visible alpha
                energy_img = Image.new('RGBA', (size*3, size*3), (0, 0, 0, 0))
                energy_draw = ImageDraw.Draw(energy_img)
                
                # Create multiple gradient layers for better visibility
                center = size * 1.5
                for radius in range(size, 0, -3):
                    # Higher alpha values for visibility
                    alpha = int(255 * (1 - radius/size) * 0.8)  # Increased from 0.3
                    color = client_colors['energy'] + (alpha,)
                    energy_draw.ellipse([center-radius, center-radius, center+radius, center+radius], 
                                      fill=color)
                
                # Add bright core
                core_alpha = min(255, int(alpha * 1.5))
                core_color = client_colors['primary'] + (core_alpha,)
                energy_draw.ellipse([center-size//3, center-size//3, center+size//3, center+size//3], 
                                  fill=core_color)
                
                # Paste energy orb
                img.paste(energy_img, (x-int(center), y-int(center)), energy_img)
            
            logger.info("✅ Energy fields created")
        
        elif style == "network_nodes":
            logger.info(f"🔗 Creating network nodes with {client} colors")
            # Create network node pattern
            nodes = []
            for i in range(40):  # More nodes
                x = random.randint(50, width-50)
                y = random.randint(50, height-50)
                nodes.append((x, y))
                
                # Draw larger, more visible nodes
                node_size = random.randint(12, 30)  # Bigger nodes
                draw.ellipse([x-node_size, y-node_size, x+node_size, y+node_size], 
                           fill=client_colors['accent'])
                
                # Draw brighter glow with higher opacity
                glow_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                glow_draw = ImageDraw.Draw(glow_img)
                for r in range(node_size+5, node_size+25):  # Larger glow
                    alpha = max(0, 150 - (r-node_size)*6)  # Higher base alpha
                    glow_color = client_colors['primary'] + (alpha,)
                    glow_draw.ellipse([x-r, y-r, x+r, y+r], outline=glow_color, width=2)
                img = Image.alpha_composite(img.convert('RGBA'), glow_img).convert('RGB')
            
            # Connect more nodes with thicker lines
            for i in range(len(nodes)):
                for j in range(i+1, min(i+5, len(nodes))):
                    if random.random() < 0.5:  # 50% chance to connect
                        draw.line([nodes[i], nodes[j]], fill=client_colors['secondary'], width=3)
            
            logger.info("✅ Network nodes created")
        
        elif style == "particle_waves":
            logger.info(f"🌊 Creating particle waves with {client} colors")
            # Create particle wave patterns
            for wave in range(7):  # More waves
                y_offset = wave * height // 7
                amplitude = random.randint(50, 120)  # Larger amplitude
                frequency = random.uniform(0.008, 0.025)
                
                points = []
                for x in range(0, width, 3):  # Denser points
                    y = y_offset + amplitude * np.sin(frequency * x)
                    points.append((x, int(y)))
                
                # Draw wave with larger, more visible particles
                for i, (x, y) in enumerate(points):
                    if i % 8 == 0:  # Every 8th point for more density
                        particle_size = random.randint(6, 15)  # Larger particles
                        alpha = random.randint(180, 255)  # Higher alpha
                        color = client_colors['accent'] + (alpha,)
                        
                        particle_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                        particle_draw = ImageDraw.Draw(particle_img)
                        particle_draw.ellipse([x-particle_size, y-particle_size, 
                                             x+particle_size, y+particle_size], fill=color)
                        
                        # Add glow around particles
                        glow_size = particle_size + 5
                        glow_color = client_colors['energy'] + (alpha//2,)
                        particle_draw.ellipse([x-glow_size, y-glow_size, 
                                             x+glow_size, y+glow_size], outline=glow_color, width=2)
                        
                        img = Image.alpha_composite(img.convert('RGBA'), particle_img).convert('RGB')
            
            logger.info("✅ Particle waves created")
        
        elif style == "dark_theme":
            logger.info(f"🌑 Creating dark theme background with {client} colors")
            # Create dark themed background with subtle elements
            
            # Dark gradient background
            for y in range(height):
                darkness_factor = 0.8 + 0.2 * (y / height)  # Darker at top
                dark_color = tuple(int(c * darkness_factor * 0.2) for c in client_colors['primary'])
                draw.line([(0, y), (width, y)], fill=dark_color)
            
            # Add subtle geometric patterns
            pattern_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            pattern_draw = ImageDraw.Draw(pattern_img)
            
            # Hexagonal grid pattern
            hex_size = 60
            for y in range(0, height + hex_size, hex_size):
                for x in range(0, width + hex_size, hex_size):
                    # Offset every other row
                    offset_x = x + (hex_size // 2 if (y // hex_size) % 2 else 0)
                    
                    # Draw subtle hexagon outline
                    alpha = random.randint(20, 60)
                    hex_color = client_colors['accent'] + (alpha,)
                    
                    # Simple diamond shape for performance
                    points = [
                        (offset_x, y - hex_size//3),
                        (offset_x + hex_size//3, y),
                        (offset_x, y + hex_size//3),
                        (offset_x - hex_size//3, y)
                    ]
                    pattern_draw.polygon(points, outline=hex_color, width=1)
            
            img = Image.alpha_composite(img.convert('RGBA'), pattern_img).convert('RGB')
            
            # Add some subtle lighting spots
            for i in range(8):
                x = random.randint(100, width-100)
                y = random.randint(100, height-100)
                light_size = random.randint(80, 150)
                
                light_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                light_draw = ImageDraw.Draw(light_img)
                
                # Create soft light spot
                for radius in range(light_size, 0, -10):
                    alpha = int(30 * (1 - radius/light_size))
                    light_color = client_colors['energy'] + (alpha,)
                    light_draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=light_color)
                
                img = Image.alpha_composite(img.convert('RGBA'), light_img).convert('RGB')
            
            logger.info("✅ Dark theme background created")
        
        # Add atmospheric effects and base lighting
        logger.info("🌅 Adding atmospheric effects")
        
        # Create a more visible gradient overlay
        gradient = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        gradient_draw = ImageDraw.Draw(gradient)
        
        # Create radial gradient from center
        center_x, center_y = width // 2, height // 2
        max_distance = ((width/2)**2 + (height/2)**2)**0.5
        
        for y in range(height):
            for x in range(0, width, 4):  # Skip some pixels for performance
                distance = ((x - center_x)**2 + (y - center_y)**2)**0.5
                alpha = int(60 * (1 - distance / max_distance))  # Stronger gradient
                if alpha > 0:
                    color = client_colors['primary'] + (alpha,)
                    gradient_draw.point((x, y), fill=color)
        
        # Apply gradient
        img = Image.alpha_composite(img.convert('RGBA'), gradient).convert('RGB')
        
        # Add some additional base lighting for depth
        lighting = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        lighting_draw = ImageDraw.Draw(lighting)
        
        # Add corner lighting effects
        corner_color = client_colors['secondary'] + (40,)
        lighting_draw.ellipse([width//4, height//4, 3*width//4, 3*height//4], 
                            outline=corner_color, width=5)
        
        img = Image.alpha_composite(img.convert('RGBA'), lighting).convert('RGB')
        logger.info("✅ Atmospheric effects applied")
        
        return img
    
    def create_text_overlay(self, width, height, title, subtitle, fonts):
        """Create professional text overlay"""
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
                y = title_y + (i * 200)  # Increased spacing for larger font
                
                # Multiple shadow layers for depth with larger shadows
                draw.text((x + 6, y + 6), line, fill=(0, 0, 0, 255), font=fonts["title"])
                draw.text((x + 3, y + 3), line, fill=(0, 0, 0, 180), font=fonts["title"])
                # Main text - bright white
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
        
        # Draw subtitle with rounded box
        if subtitle:
            subtitle_y = title_y + len(title_lines) * 200 + 80  # Adjusted for larger font spacing
            
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            # Subtitle box
            box_padding = 25
            box_x1 = x - box_padding
            box_y1 = subtitle_y - box_padding // 2
            box_x2 = x + text_width + box_padding
            box_y2 = subtitle_y + 70 + box_padding // 2
            
            # Draw rounded rectangle with gradient effect
            draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], 
                                 radius=15, fill=(0, 0, 0, 140))
            
            # Add inner glow to box
            draw.rounded_rectangle([box_x1+2, box_y1+2, box_x2-2, box_y2-2], 
                                 radius=13, outline=(255, 255, 255, 50), width=1)
            
            # Subtitle text with shadow
            draw.text((x + 2, subtitle_y + 2), subtitle, fill=(0, 0, 0, 200), font=fonts["subtitle"])
            draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        
        return overlay
    
    def generate_cover(self, title, subtitle, client="hedera", style="energy_fields"):
        """Generate enhanced cover with detailed backgrounds"""
        try:
            logger.info(f"🎨 Generating enhanced cover: {title} (client: {client}, style: {style})")
            
            width, height = 1800, 900
            
            # Create enhanced background
            background = self.create_enhanced_background(width, height, client, style)
            base_rgba = background.convert("RGBA")
            
            # Get fonts and add text overlay
            fonts = self.get_fonts()
            text_overlay = self.create_text_overlay(width, height, title, subtitle, fonts)
            base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            # Apply watermark if available
            if self.watermark:
                watermark_resized = self.watermark.resize((width, height), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, watermark_resized)
            else:
                final_image = base_rgba
            
            logger.info("✅ Enhanced cover generation complete")
            return final_image.convert("RGB")
            
        except Exception as e:
            logger.error(f"❌ Cover generation failed: {str(e)}")
            return None

# Initialize generator
generator = EnhancedGenerator()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Enhanced LoRA-Style Crypto News Image Generator",
        "status": "running",
        "endpoints": ["/generate", "/health"],
        "version": "2.1.0"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "enhanced-lora-generator"}

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    """Generate enhanced crypto news cover"""
    try:
        logger.info(f"🎨 Generating image for: {request.title}")
        
        # Generate the cover
        image = generator.generate_cover(
            title=request.title,
            subtitle=request.subtitle,
            client=request.client,
            style=request.style or "dark_theme"
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
                "generator": "enhanced-lightweight",
                "resolution": "1800x900"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    logger.info(f"🚀 Starting Enhanced Generator on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)