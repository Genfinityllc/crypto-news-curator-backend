#!/usr/bin/env python3
"""
Test much better title overlay with proper sizing and design
"""
import os
from PIL import Image, ImageDraw, ImageFont

def test_improved_title_overlay():
    """Test title overlay with much larger, more visible text"""
    print("🧪 Testing IMPROVED title overlay functionality...")
    
    # Create test background
    width, height = 1800, 900
    background = Image.new('RGB', (width, height), (30, 30, 80))  # Dark blue
    
    # MUCH LARGER font sizes for better visibility
    fonts = {}
    font_sizes = {"title": 180, "subtitle": 90}  # Increased from 120/60
    
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Arial.ttc",
    ]
    
    for size_name, size in font_sizes.items():
        fonts[size_name] = None
        for font_path in font_paths:
            try:
                if os.path.exists(font_path):
                    fonts[size_name] = ImageFont.truetype(font_path, size)
                    print(f"✅ Loaded {size_name} font: {size}px from {font_path}")
                    break
            except:
                continue
        
        if fonts[size_name] is None:
            try:
                fonts[size_name] = ImageFont.load_default()
                print(f"⚠️ Using default font for {size_name} ({size}px)")
            except:
                fonts[size_name] = ImageFont.load_default()
    
    # Create text overlay
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    title = "CRYPTO MARKET SURGE"
    subtitle = "Breaking News Analysis"
    
    # Title positioning - move up a bit for better balance
    title_y = height // 4  # Changed from height // 3
    
    # Draw title with MUCH better styling
    if title and title.strip():
        title = title.upper().strip()
        bbox = draw.textbbox((0, 0), title, font=fonts["title"])
        text_width = bbox[2] - bbox[0]
        
        # Check if title fits, if not break into lines
        if text_width > width * 0.85:
            words = title.split()
            mid = len(words) // 2
            title_lines = [" ".join(words[:mid]), " ".join(words[mid:])]
        else:
            title_lines = [title]
        
        for i, line in enumerate(title_lines):
            bbox = draw.textbbox((0, 0), line, font=fonts["title"])
            text_width = bbox[2] - bbox[0]
            x = (width - text_width) // 2
            y = title_y + (i * 200)  # More spacing between lines
            
            # ENHANCED shadow layers for much better visibility
            draw.text((x + 8, y + 8), line, fill=(0, 0, 0, 255), font=fonts["title"])
            draw.text((x + 6, y + 6), line, fill=(0, 0, 0, 220), font=fonts["title"])
            draw.text((x + 4, y + 4), line, fill=(0, 0, 0, 180), font=fonts["title"])
            draw.text((x + 2, y + 2), line, fill=(0, 0, 0, 140), font=fonts["title"])
            
            # Main text - bright white with slight outline
            draw.text((x, y), line, fill=(255, 255, 255, 255), font=fonts["title"])
            print(f"✅ Title line added: '{line}' at position ({x}, {y})")
    
    # Draw subtitle with MUCH BETTER design
    if subtitle and subtitle.strip():
        subtitle = subtitle.strip()
        subtitle_y = title_y + len(title_lines) * 200 + 80  # More spacing
        
        bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
        text_width = bbox[2] - bbox[0]
        x = (width - text_width) // 2
        
        # MUCH BETTER subtitle box design
        box_padding = 40  # Increased padding
        box_x1 = x - box_padding
        box_y1 = subtitle_y - 20
        box_x2 = x + text_width + box_padding
        box_y2 = subtitle_y + 100
        
        # Enhanced gradient box background
        draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], 
                             radius=20, fill=(0, 0, 0, 180))  # More opacity
        
        # Add border for better definition
        draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], 
                             radius=20, outline=(255, 255, 255, 100), width=2)
        
        # Inner highlight
        draw.rounded_rectangle([box_x1+3, box_y1+3, box_x2-3, box_y2-3], 
                             radius=17, outline=(255, 255, 255, 60), width=1)
        
        # Subtitle text with better shadows
        draw.text((x + 4, subtitle_y + 4), subtitle, fill=(0, 0, 0, 255), font=fonts["subtitle"])
        draw.text((x + 2, subtitle_y + 2), subtitle, fill=(0, 0, 0, 200), font=fonts["subtitle"])
        draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        print(f"✅ Subtitle added: '{subtitle}' at position ({x}, {subtitle_y})")
    
    # Composite overlay onto background
    final_image = Image.alpha_composite(background.convert('RGBA'), overlay).convert('RGB')
    
    # Save test image
    output_path = "/Users/valorkopeny/Desktop/improved_title_overlay_test.png"
    final_image.save(output_path)
    print(f"✅ Improved test image saved: {output_path}")
    
    return True

if __name__ == "__main__":
    success = test_improved_title_overlay()
    if success:
        print("🎉 IMPROVED title overlay test completed!")
        print("📏 Font sizes: Title=180px, Subtitle=90px")
        print("🎨 Enhanced shadows, padding, and borders")
    else:
        print("❌ Title overlay test failed!")