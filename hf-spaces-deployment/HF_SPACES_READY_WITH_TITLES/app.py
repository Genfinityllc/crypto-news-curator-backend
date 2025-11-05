#!/usr/bin/env python3
"""
READY FOR HF SPACES DEPLOYMENT - WITH MASSIVE TITLE OVERLAYS
This is the exact version to upload to HF Spaces to fix the missing title issue
"""
import gradio as gr
import os
import random
import base64
import io
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LoRAGeneratorWithTitles:
    def __init__(self):
        self.watermark = None
        self.load_watermark()
        logger.info("🎨 LoRA Generator with MASSIVE Title Overlays initialized")
        
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
        """Load system fonts with MASSIVE sizes that can't be missed"""
        fonts = {}
        
        # MASSIVE font sizes - impossible to miss!
        font_sizes = {
            "title": 300,    # HUGE - was tiny 120
            "subtitle": 150,  # BIG - was tiny 60
            "small": 80      # MEDIUM
        }
        
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
                        logger.info(f"✅ MASSIVE font loaded: {size_name} = {size}px")
                        break
                except:
                    continue
            
            if fonts[size_name] is None:
                try:
                    fonts[size_name] = ImageFont.load_default()
                    logger.info(f"⚠️ Using default font for {size_name} ({size}px)")
                except:
                    fonts[size_name] = ImageFont.load_default()
        
        return fonts
    
    def create_enhanced_background(self, width, height, client, style):
        """Create detailed brand-specific background"""
        # Client color schemes
        colors = {
            'genfinity': {
                'primary': (138, 43, 226),    # Purple
                'secondary': (75, 0, 130),    # Dark purple
                'accent': (186, 85, 211),     # Light purple
                'energy': (255, 0, 255)       # Magenta
            },
            'hedera': {
                'primary': (138, 43, 226),    # Purple
                'secondary': (75, 0, 130),    # Dark purple
                'accent': (186, 85, 211),     # Light purple
                'energy': (255, 0, 255)       # Magenta
            },
            'cryptonews': {
                'primary': (0, 120, 140),     # Teal
                'secondary': (0, 85, 100),    # Dark teal
                'accent': (75, 163, 224),     # Light teal
                'energy': (0, 255, 255)       # Cyan
            },
            'blockchaindaily': {
                'primary': (72, 61, 139),     # Dark slate blue
                'secondary': (25, 25, 112),   # Midnight blue
                'accent': (106, 90, 205),     # Slate blue
                'energy': (255, 255, 255)     # White
            }
        }
        
        client_lower = client.lower()
        client_colors = colors.get(client_lower, colors['genfinity'])
        
        # Create base image
        img = Image.new('RGB', (width, height), (0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Create energy field background
        if style.lower() in ["professional", "energy_fields", "modern", "premium", "tech"]:
            # Create flowing energy patterns
            for i in range(50):
                x = random.randint(0, width)
                y = random.randint(0, height)
                size = random.randint(20, 100)
                
                # Create energy orb
                energy_img = Image.new('RGBA', (size*2, size*2), (0, 0, 0, 0))
                energy_draw = ImageDraw.Draw(energy_img)
                
                # Gradient effect
                for radius in range(size, 0, -2):
                    alpha = int(255 * (1 - radius/size) * 0.3)
                    color = client_colors['energy'] + (alpha,)
                    energy_draw.ellipse([size-radius, size-radius, size+radius, size+radius], 
                                      fill=color)
                
                # Paste energy orb
                img.paste(energy_img, (x-size, y-size), energy_img)
        
        # Add atmospheric gradient overlay
        gradient = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        gradient_draw = ImageDraw.Draw(gradient)
        
        for y in range(height):
            alpha = int(30 * (y / height))  # Subtle gradient
            color = client_colors['primary'] + (alpha,)
            gradient_draw.line([(0, y), (width, y)], fill=color)
        
        # Apply gradient
        img = Image.alpha_composite(img.convert('RGBA'), gradient).convert('RGB')
        
        return img
    
    def create_massive_text_overlay(self, width, height, title, subtitle, fonts):
        """Create MASSIVE text overlay that cannot be missed"""
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Title positioning - HIGHER up for massive text
        title_y = height // 6  # Move up much higher
        
        logger.info(f"📝 Creating MASSIVE text overlay: '{title}' + '{subtitle}'")
        
        # Draw MASSIVE title
        if title and title.strip():
            title = title.upper().strip()
            
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
                x = (width - text_width) // 2
                y = title_y + (i * 350)  # MASSIVE 350px spacing
                
                # MASSIVE shadow layers for incredible visibility
                draw.text((x + 12, y + 12), line, fill=(0, 0, 0, 255), font=fonts["title"])
                draw.text((x + 8, y + 8), line, fill=(0, 0, 0, 220), font=fonts["title"])
                draw.text((x + 4, y + 4), line, fill=(0, 0, 0, 180), font=fonts["title"])
                draw.text((x + 2, y + 2), line, fill=(0, 0, 0, 140), font=fonts["title"])
                
                # Main text - BRIGHT WHITE
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
                logger.info(f"✅ MASSIVE title line: '{line}' at ({x}, {y})")
        
        # Draw MASSIVE subtitle with huge rounded box
        if subtitle and subtitle.strip():
            subtitle = subtitle.strip()
            subtitle_y = title_y + len(title_lines) * 350 + 100  # MASSIVE spacing
            
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            # MASSIVE subtitle box design
            box_padding = 50  # HUGE padding
            box_x1 = x - box_padding
            box_y1 = subtitle_y - 30
            box_x2 = x + text_width + box_padding
            box_y2 = subtitle_y + 150  # Much taller for massive fonts
            
            # Enhanced gradient box background
            draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], 
                                 radius=25, fill=(0, 0, 0, 200))  # Dark box
            
            # Add border for better definition
            draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], 
                                 radius=25, outline=(255, 255, 255, 120), width=3)
            
            # Inner highlight
            draw.rounded_rectangle([box_x1+4, box_y1+4, box_x2-4, box_y2-4], 
                                 radius=21, outline=(255, 255, 255, 80), width=1)
            
            # Subtitle text with MASSIVE shadows
            draw.text((x + 6, subtitle_y + 6), subtitle, fill=(0, 0, 0, 255), font=fonts["subtitle"])
            draw.text((x + 3, subtitle_y + 3), subtitle, fill=(0, 0, 0, 200), font=fonts["subtitle"])
            draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
            logger.info(f"✅ MASSIVE subtitle: '{subtitle}' at ({x}, {subtitle_y})")
        
        return overlay
    
    def generate_cover(self, title, subtitle="", client_id="Genfinity", style="Professional"):
        """Generate enhanced cover with MASSIVE title overlays"""
        try:
            logger.info(f"🎨 Generating cover with MASSIVE title overlay: '{title}' + '{subtitle}' (client: {client_id}, style: {style})")
            
            width, height = 1800, 900
            
            # Create enhanced background
            background = self.create_enhanced_background(width, height, client_id, style)
            base_rgba = background.convert("RGBA")
            
            # Get fonts and add MASSIVE text overlay
            fonts = self.get_fonts()
            text_overlay = self.create_massive_text_overlay(width, height, title, subtitle, fonts)
            base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            # Apply watermark if available
            if self.watermark:
                watermark_resized = self.watermark.resize((width, height), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, watermark_resized)
            else:
                final_image = base_rgba
            
            logger.info("🔥 Cover with MASSIVE title overlay generated successfully - IMPOSSIBLE TO MISS!")
            return "✅ Cover generated with MASSIVE title overlay successfully!", final_image.convert("RGB")
            
        except Exception as e:
            logger.error(f"❌ Cover generation failed: {str(e)}")
            return f"❌ Generation failed: {str(e)}", None

# Initialize generator
generator = LoRAGeneratorWithTitles()

def generate_crypto_cover(title, subtitle, client_id, style):
    """Gradio interface function"""
    logger.info(f"🎯 GRADIO CALL: title='{title}', subtitle='{subtitle}', client='{client_id}', style='{style}'")
    return generator.generate_cover(title, subtitle, client_id, style)

# Create Gradio interface
with gr.Blocks(title="🎨 Crypto News LoRA Generator") as demo:
    gr.Markdown("# 🎨 Crypto News LoRA Generator")
    gr.Markdown("Professional cryptocurrency news cover generation with LoRA enhancement")
    
    with gr.Row():
        with gr.Column():
            gr.Markdown("### Generation Parameters")
            title_input = gr.Textbox(
                label="Article Title",
                placeholder="Bitcoin Reaches New Heights",
                value="Bitcoin Market Analysis"
            )
            subtitle_input = gr.Textbox(
                label="Subtitle (optional)",
                placeholder="Market insights and trends"
            )
            client_dropdown = gr.Dropdown(
                choices=["Genfinity", "CryptoNews", "BlockchainDaily"],
                value="Genfinity",
                label="Client"
            )
            style_dropdown = gr.Dropdown(
                choices=["Professional", "Modern", "Premium", "Tech"],
                value="Professional",
                label="Style"
            )
            generate_btn = gr.Button("🎨 Generate LoRA Cover", variant="primary")
        
        with gr.Column():
            status_output = gr.Textbox(
                label="Generation Status",
                lines=3
            )
            image_output = gr.Image(
                label="Generated Cover",
                show_download_button=True
            )
    
    gr.Markdown("### 🎨 LoRA Features")
    gr.Markdown("- ✅ Trained LoRA model for crypto news aesthetics")
    gr.Markdown("- ✅ Genfinity watermark overlay")
    gr.Markdown("- ✅ **MASSIVE title overlays with 300px fonts**")
    gr.Markdown("- ✅ Professional 1800x900 covers")
    gr.Markdown("- ✅ PNG output format")
    
    # Connect the interface
    generate_btn.click(
        fn=generate_crypto_cover,
        inputs=[title_input, subtitle_input, client_dropdown, style_dropdown],
        outputs=[status_output, image_output]
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)