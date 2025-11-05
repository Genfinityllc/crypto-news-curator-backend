#!/usr/bin/env python3
"""
Test just the title overlay functionality
"""
import os
from PIL import Image, ImageDraw, ImageFont

def test_title_overlay():
    """Test title overlay creation without full system"""
    print("🧪 Testing title overlay functionality...")
    
    # Create test background
    width, height = 1800, 900
    background = Image.new('RGB', (width, height), (50, 50, 150))  # Dark blue
    
    # Load fonts
    fonts = {}
    font_sizes = {"title": 120, "subtitle": 60}
    
    for size_name, size in font_sizes.items():
        try:
            fonts[size_name] = ImageFont.load_default()
        except:
            fonts[size_name] = ImageFont.load_default()
    
    # Create text overlay
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    title = "TEST TITLE OVERLAY"
    subtitle = "Test Subtitle"
    
    # Title positioning
    title_y = height // 3
    
    # Draw title
    if title and title.strip():
        title = title.upper().strip()
        bbox = draw.textbbox((0, 0), title, font=fonts["title"])
        text_width = bbox[2] - bbox[0]
        x = (width - text_width) // 2
        y = title_y
        
        # Multiple shadow layers for depth
        draw.text((x + 4, y + 4), title, fill=(0, 0, 0, 255), font=fonts["title"])
        draw.text((x + 2, y + 2), title, fill=(0, 0, 0, 180), font=fonts["title"])
        # Main text - bright white
        draw.text((x, y), title, fill=(255, 255, 255, 255), font=fonts["title"])
        print(f"✅ Title added: '{title}' at position ({x}, {y})")
    
    # Draw subtitle
    if subtitle and subtitle.strip():
        subtitle = subtitle.strip()
        subtitle_y = title_y + 130 + 50
        
        bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
        text_width = bbox[2] - bbox[0]
        x = (width - text_width) // 2
        
        # Subtitle box with padding
        box_padding = 25
        box_x1 = x - box_padding
        box_y1 = subtitle_y - box_padding // 2
        box_x2 = x + text_width + box_padding
        box_y2 = subtitle_y + 70 + box_padding // 2
        
        # Draw rounded rectangle
        draw.rounded_rectangle([box_x1, box_y1, box_x2, box_y2], 
                             radius=15, fill=(0, 0, 0, 140))
        
        # Subtitle text with shadow
        draw.text((x + 2, subtitle_y + 2), subtitle, fill=(0, 0, 0, 200), font=fonts["subtitle"])
        draw.text((x, subtitle_y), subtitle, fill=(255, 255, 255, 255), font=fonts["subtitle"])
        print(f"✅ Subtitle added: '{subtitle}' at position ({x}, {subtitle_y})")
    
    # Composite overlay onto background
    final_image = Image.alpha_composite(background.convert('RGBA'), overlay).convert('RGB')
    
    # Save test image
    output_path = "/Users/valorkopeny/Desktop/title_overlay_test_output.png"
    final_image.save(output_path)
    print(f"✅ Test image saved: {output_path}")
    
    return True

if __name__ == "__main__":
    success = test_title_overlay()
    if success:
        print("🎉 Title overlay test completed successfully!")
    else:
        print("❌ Title overlay test failed!")