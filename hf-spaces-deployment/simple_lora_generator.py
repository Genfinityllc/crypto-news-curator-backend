#!/usr/bin/env python3
"""
Simplified LoRA Image Generator for Hugging Face Spaces
Optimized for deployment without large model files
"""

import os
import sys
import argparse
from PIL import Image, ImageDraw, ImageFont
import random
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleLORAGenerator:
    def __init__(self):
        self.output_dir = Path("style_outputs")
        self.output_dir.mkdir(exist_ok=True)
        
        # Client color schemes (matching your existing branding)
        self.client_colors = {
            'hedera': {'bg': '#8B2CE6', 'accent': '#FFFFFF', 'text': '#FFFFFF'},
            'algorand': {'bg': '#0078CC', 'accent': '#00D4FF', 'text': '#FFFFFF'},
            'constellation': {'bg': '#484D8B', 'accent': '#7B68EE', 'text': '#FFFFFF'},
            'bitcoin': {'bg': '#F7931A', 'accent': '#FFB84D', 'text': '#000000'},
            'ethereum': {'bg': '#627EEA', 'accent': '#8FA4FF', 'text': '#FFFFFF'},
            'generic': {'bg': '#4A90E2', 'accent': '#6BB6FF', 'text': '#FFFFFF'}
        }
        
        # Style variations
        self.style_patterns = [
            'energy_fields',
            'network_nodes', 
            'abstract_flow',
            'geometric_patterns',
            'particle_waves',
            'crystalline_structures'
        ]
    
    def generate_gradient_background(self, width, height, color_scheme, style='energy_fields'):
        """Generate a gradient background with style variations"""
        img = Image.new('RGB', (width, height))
        draw = ImageDraw.Draw(img)
        
        bg_color = color_scheme['bg']
        accent_color = color_scheme['accent']
        
        # Convert hex to RGB
        bg_rgb = tuple(int(bg_color[i:i+2], 16) for i in (1, 3, 5))
        accent_rgb = tuple(int(accent_color[i:i+2], 16) for i in (1, 3, 5))
        
        # Create gradient effect
        for y in range(height):
            ratio = y / height
            if style == 'energy_fields':
                # Wavy energy field effect
                wave = int(50 * (1 + 0.5 * (y % 100) / 100))
                r = int(bg_rgb[0] * (1 - ratio) + accent_rgb[0] * ratio) + wave % 30
                g = int(bg_rgb[1] * (1 - ratio) + accent_rgb[1] * ratio) + wave % 20
                b = int(bg_rgb[2] * (1 - ratio) + accent_rgb[2] * ratio) + wave % 25
            else:
                # Linear gradient
                r = int(bg_rgb[0] * (1 - ratio) + accent_rgb[0] * ratio)
                g = int(bg_rgb[1] * (1 - ratio) + accent_rgb[1] * ratio)
                b = int(bg_rgb[2] * (1 - ratio) + accent_rgb[2] * ratio)
            
            # Clamp values
            r, g, b = max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b))
            draw.line([(0, y), (width, y)], fill=(r, g, b))
        
        return img
    
    def add_network_effects(self, img, style='energy_fields'):
        """Add network-style visual effects"""
        draw = ImageDraw.Draw(img)
        width, height = img.size
        
        if style == 'network_nodes':
            # Add node connections
            for _ in range(15):
                x1, y1 = random.randint(0, width), random.randint(0, height)
                x2, y2 = random.randint(0, width), random.randint(0, height)
                draw.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, 30), width=1)
                draw.ellipse([x1-3, y1-3, x1+3, y1+3], fill=(255, 255, 255, 100))
        
        elif style == 'particle_waves':
            # Add particle effects
            for _ in range(50):
                x = random.randint(0, width)
                y = random.randint(0, height)
                size = random.randint(1, 4)
                draw.ellipse([x-size, y-size, x+size, y+size], fill=(255, 255, 255, 80))
        
        return img
    
    def add_text_overlay(self, img, title, subtitle, color_scheme):
        """Add title and subtitle text overlay"""
        draw = ImageDraw.Draw(img)
        width, height = img.size
        
        # Try to use a nice font, fall back to default
        try:
            title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
            subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
        except:
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
        
        text_color = color_scheme['text']
        text_rgb = tuple(int(text_color[i:i+2], 16) for i in (1, 3, 5))
        
        # Add title
        title_bbox = draw.textbbox((0, 0), title, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_height = title_bbox[3] - title_bbox[1]
        
        title_x = (width - title_width) // 2
        title_y = height // 2 - 50
        
        # Add shadow effect
        draw.text((title_x + 2, title_y + 2), title, font=title_font, fill=(0, 0, 0, 128))
        draw.text((title_x, title_y), title, font=title_font, fill=text_rgb)
        
        # Add subtitle
        subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
        
        subtitle_x = (width - subtitle_width) // 2
        subtitle_y = title_y + title_height + 20
        
        draw.text((subtitle_x + 1, subtitle_y + 1), subtitle, font=subtitle_font, fill=(0, 0, 0, 128))
        draw.text((subtitle_x, subtitle_y), subtitle, font=subtitle_font, fill=text_rgb)
        
        return img
    
    def generate_cover(self, title, subtitle, client, style=None):
        """Generate a LoRA-style cover image"""
        if style is None:
            style = random.choice(self.style_patterns)
        
        # Get color scheme
        color_scheme = self.client_colors.get(client, self.client_colors['generic'])
        
        logger.info(f"🎨 Generating {style} cover for {client}: {title}")
        
        # Create base image
        width, height = 1792, 896
        img = self.generate_gradient_background(width, height, color_scheme, style)
        
        # Add network effects
        img = self.add_network_effects(img, style)
        
        # Add text overlay
        img = self.add_text_overlay(img, title, subtitle, color_scheme)
        
        # Save image
        output_path = self.output_dir / f"boxed_cover_{client}.png"
        img.save(output_path, "PNG", quality=95)
        
        logger.info(f"✅ Cover saved to: {output_path}")
        return str(output_path)

def main():
    parser = argparse.ArgumentParser(description="Generate LoRA-style crypto news covers")
    parser.add_argument("--title", required=True, help="Article title")
    parser.add_argument("--subtitle", default="CRYPTO NEWS", help="Subtitle text")
    parser.add_argument("--client", default="generic", help="Client ID (hedera, algorand, etc.)")
    parser.add_argument("--style", help="Style variation")
    parser.add_argument("--article", help="Article file (for compatibility)")
    
    args = parser.parse_args()
    
    generator = SimpleLORAGenerator()
    output_path = generator.generate_cover(
        title=args.title,
        subtitle=args.subtitle,
        client=args.client,
        style=args.style
    )
    
    print(f"Generated: {output_path}")

if __name__ == "__main__":
    main()