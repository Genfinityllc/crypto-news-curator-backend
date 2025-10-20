import os
import random
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
import uvicorn
import logging
from PIL import Image, ImageDraw, ImageFont
import io
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="LoRA Crypto News Image Generator",
    description="Generate crypto news images with client branding",
    version="1.0.0"
)

class GenerationRequest(BaseModel):
    title: str
    subtitle: str = "CRYPTO NEWS"
    client: str = "algorand"
    style: Optional[str] = "energy_fields"

class GenerationResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[dict] = None

# Client color schemes
CLIENT_COLORS = {
    'hedera': {'bg': '#8B2CE6', 'text': '#FFFFFF', 'accent': '#B565F7'},
    'algorand': {'bg': '#0078CC', 'text': '#FFFFFF', 'accent': '#4BA3E0'},
    'constellation': {'bg': '#484D8B', 'text': '#FFFFFF', 'accent': '#7B82C4'},
    'bitcoin': {'bg': '#F7931A', 'text': '#000000', 'accent': '#FFB84D'},
    'ethereum': {'bg': '#627EEA', 'text': '#FFFFFF', 'accent': '#8FA6F0'},
    'generic': {'bg': '#4A90E2', 'text': '#FFFFFF', 'accent': '#7BB0E8'}
}

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_gradient_background(width, height, color1, color2):
    """Create a gradient background"""
    image = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(image)
    
    for y in range(height):
        # Calculate blend ratio
        ratio = y / height
        
        # Blend colors
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    return image

def generate_crypto_cover(title, subtitle, client, style):
    """Generate a crypto news cover image"""
    try:
        # Image dimensions
        width, height = 1792, 896
        
        # Get client colors
        colors = CLIENT_COLORS.get(client.lower(), CLIENT_COLORS['generic'])
        bg_color = hex_to_rgb(colors['bg'])
        text_color = hex_to_rgb(colors['text'])
        accent_color = hex_to_rgb(colors['accent'])
        
        # Create gradient background
        image = create_gradient_background(width, height, bg_color, accent_color)
        draw = ImageDraw.Draw(image)
        
        # Add some geometric elements based on style
        if style == 'energy_fields':
            # Add energy field lines
            for i in range(0, width, 100):
                draw.line([(i, 0), (i + 200, height)], fill=accent_color, width=2)
        elif style == 'network_nodes':
            # Add network node circles
            for i in range(5):
                x = random.randint(100, width-100)
                y = random.randint(100, height-100)
                draw.ellipse([x-30, y-30, x+30, y+30], outline=accent_color, width=3)
        elif style == 'geometric_patterns':
            # Add geometric patterns
            for i in range(0, width, 150):
                for j in range(0, height, 150):
                    draw.rectangle([i, j, i+100, j+100], outline=accent_color, width=2)
        
        # Try to use a bold font, fallback to default
        try:
            title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
            subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        except:
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
        
        # Calculate text positioning
        title_bbox = draw.textbbox((0, 0), title, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_height = title_bbox[3] - title_bbox[1]
        
        subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
        subtitle_height = subtitle_bbox[3] - subtitle_bbox[1]
        
        # Position text in center
        title_x = (width - title_width) // 2
        title_y = (height - title_height) // 2 - 50
        
        subtitle_x = (width - subtitle_width) // 2
        subtitle_y = title_y + title_height + 20
        
        # Add text shadow
        shadow_offset = 3
        draw.text((title_x + shadow_offset, title_y + shadow_offset), title, 
                 fill=(0, 0, 0, 128), font=title_font)
        draw.text((subtitle_x + shadow_offset, subtitle_y + shadow_offset), subtitle, 
                 fill=(0, 0, 0, 128), font=subtitle_font)
        
        # Add main text
        draw.text((title_x, title_y), title, fill=text_color, font=title_font)
        draw.text((subtitle_x, subtitle_y), subtitle, fill=text_color, font=subtitle_font)
        
        # Add client branding
        brand_text = f"{client.upper()} NEWS"
        brand_font = subtitle_font
        brand_bbox = draw.textbbox((0, 0), brand_text, font=brand_font)
        brand_width = brand_bbox[2] - brand_bbox[0]
        
        brand_x = width - brand_width - 50
        brand_y = height - 100
        
        draw.text((brand_x, brand_y), brand_text, fill=accent_color, font=brand_font)
        
        return image
        
    except Exception as e:
        logger.error(f"Error generating cover: {e}")
        raise

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Minimal LoRA Crypto News Image Generator",
        "status": "running",
        "endpoints": ["/generate", "/health"]
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "minimal-lora-generator"}

@app.post("/generate")
async def generate_image(request: GenerationRequest):
    """Generate crypto news cover image"""
    try:
        logger.info(f"🎨 Generating minimal cover for: {request.title}")
        
        # Generate the image
        image = generate_crypto_cover(
            request.title,
            request.subtitle,
            request.client,
            request.style or "energy_fields"
        )
        
        # Save to memory buffer
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        # Convert to base64 for response
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
        img_data_url = f"data:image/png;base64,{img_base64}"
        
        logger.info(f"✅ Minimal cover generated successfully")
        
        return GenerationResponse(
            success=True,
            image_url=img_data_url,
            metadata={
                "client": request.client,
                "style": request.style,
                "title": request.title,
                "method": "minimal_generation"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Generation failed: {str(e)}")
        return GenerationResponse(
            success=False,
            error=str(e)
        )

# For HF Spaces compatibility
if __name__ == "__main__":
    # HF Spaces expects the app to run on port 7860
    uvicorn.run("app_minimal:app", host="0.0.0.0", port=7860, reload=False)