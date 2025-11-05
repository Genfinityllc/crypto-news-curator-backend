#!/usr/bin/env python3
"""
Gradio LoRA Generator with Title Overlays
Fixed version that includes proper title overlay functionality
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

class GradioLoRAGenerator:
    def __init__(self):
        self.watermark = None
        self.load_watermark()
        logger.info("🎨 Gradio LoRA Generator with Title Overlays initialized")
        
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
        font_sizes = {"title": 120, "subtitle": 60, "small": 40}
        
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
                        break
                except:
                    continue
            
            if fonts[size_name] is None:
                try:
                    fonts[size_name] = ImageFont.load_default()
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
        if style.lower() in ["professional", "energy_fields"]:
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
    
    def create_text_overlay(self, width, height, title, subtitle, fonts):
        """Create professional text overlay with proper padding"""
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Title positioning - better spacing
        title_y = height // 3
        
        # Draw title
        if title and title.strip():
            title = title.upper().strip()
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
                
                # Multiple shadow layers for depth
                draw.text((x + 4, y + 4), line, fill=(0, 0, 0, 255), font=fonts["title"])
                draw.text((x + 2, y + 2), line, fill=(0, 0, 0, 180), font=fonts["title"])
                # Main text - bright white
                draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
        
        # Draw subtitle with rounded box
        if subtitle and subtitle.strip():
            subtitle = subtitle.strip()
            subtitle_y = title_y + len(title_lines) * 130 + 50
            
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            
            # Subtitle box with proper padding
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
    
    def generate_cover(self, title, subtitle="", client_id="Genfinity", style="Professional"):
        """Generate enhanced cover with title overlays"""
        try:
            logger.info(f"🎨 Generating cover with title overlay: '{title}' (client: {client_id}, style: {style})")
            
            width, height = 1800, 900
            
            # Create enhanced background
            background = self.create_enhanced_background(width, height, client_id, style)
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
            
            logger.info("✅ Cover with title overlay generated successfully")
            return "✅ Cover generated with title overlay successfully!", final_image.convert("RGB")
            
        except Exception as e:
            logger.error(f"❌ Cover generation failed: {str(e)}")
            return f"❌ Generation failed: {str(e)}", None

# Initialize generator
generator = GradioLoRAGenerator()

def generate_crypto_cover(title, subtitle, client_id, style):
    """Gradio interface function"""
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
    gr.Markdown("- ✅ Professional title overlays with proper padding")
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