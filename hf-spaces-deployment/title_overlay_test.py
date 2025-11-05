#!/usr/bin/env python3
"""
Title Overlay Test for HF Spaces
Test script to verify title overlay functionality
"""
import os
from PIL import Image, ImageDraw, ImageFont

def create_test_title_overlay():
    """Test title overlay creation"""
    print("🧪 Testing title overlay creation...")
    
    # Create test image
    width, height = 1800, 900
    test_image = Image.new('RGB', (width, height), (50, 50, 150))  # Dark blue background
    
    # Load fonts
    fonts = {}
    font_sizes = {"title": 120, "subtitle": 60}
    
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
                    print(f"✅ Loaded {size_name} font: {font_path}")
                    break
            except Exception as e:
                continue
        
        if fonts[size_name] is None:
            fonts[size_name] = ImageFont.load_default()
            print(f"⚠️ Using default font for {size_name}")
    
    # Create text overlay
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    title = "TEST TITLE OVERLAY"
    subtitle = "Test Subtitle"
    
    # Title positioning
    title_y = height // 3
    
    # Draw title
    bbox = draw.textbbox((0, 0), title, font=fonts["title"])
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) // 2
    y = title_y
    
    # Title shadows
    draw.text((x + 4, y + 4), title, fill=(0, 0, 0, 255), font=fonts["title"])
    draw.text((x + 2, y + 2), title, fill=(0, 0, 0, 180), font=fonts["title"])
    # Main title
    draw.text((x, y), title, fill=(255, 255, 255, 255), font=fonts["title"])
    
    # Draw subtitle
    subtitle_y = title_y + 130 + 50
    bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) // 2
    
    # Subtitle box
    box_padding = 25
    box_x1 = x - box_padding
    box_y1 = subtitle_y - box_padding // 2
    box_x2 = x + text_width + box_padding
    box_y2 = subtitle_y + 70 + box_padding // 2
    
    # Draw box
    draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], 
                         radius=15, fill=(0, 0, 0, 140))
    
    # Subtitle text
    draw.text((x + 2, subtitle_y + 2), subtitle, fill=(0, 0, 0, 200), font=fonts["subtitle"])
    draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
    
    # Composite overlay onto base image
    final_image = Image.alpha_composite(test_image.convert('RGBA'), overlay).convert('RGB')
    
    # Save test image
    output_path = "title_overlay_test.png"
    final_image.save(output_path)
    print(f"✅ Test image saved: {output_path}")
    
    return True

if __name__ == "__main__":
    success = create_test_title_overlay()
    if success:
        print("🎉 Title overlay test completed successfully!")
    else:
        print("❌ Title overlay test failed!")