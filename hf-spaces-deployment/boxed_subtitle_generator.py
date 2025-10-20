#!/usr/bin/env python3
"""
Boxed Subtitle Generator with Rounded Corners and White Text
Professional subtitle styling with optional background boxes
"""
import torch
from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler
from PIL import Image, ImageDraw, ImageFont
import os
import random
import argparse
try:
    from article_prompt_generator import ArticlePromptGenerator
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("⚠️  OpenAI integration not available - install openai package for article-based prompt generation")

class BoxedSubtitleGenerator:
    def __init__(self):
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.pipeline = None
        self.watermark = None
        self.article_generator = None
        
        # Initialize OpenAI article generator if available
        if OPENAI_AVAILABLE:
            try:
                self.article_generator = ArticlePromptGenerator()
                print("✅ OpenAI article prompt generator initialized")
            except Exception as e:
                print(f"⚠️  OpenAI initialization failed: {e}")
                self.article_generator = None
        # Client-specific fonts
        self.client_fonts = {
            "hedera": [
                '/Users/valorkopeny/Library/Fonts/StyreneA-Medium-Trial-BF63f6cbdb24b6d.otf',
                '/Users/valorkopeny/Library/Fonts/StyreneA-Bold-Trial-BF63f6cbda1877f.otf'
            ],
            "algorand": [
                '/Users/valorkopeny/Library/Fonts/fonnts.com-Aeonik-Bold.ttf'
            ],
            "constellation": [
                '/Users/valorkopeny/Library/Fonts/StretchPro.otf',
                '/Users/valorkopeny/Library/Fonts/StyreneA-Black-Trial-BF63f6cbd9da245.otf'
            ]
        }
        
        # Default fonts for fallback
        self.custom_fonts = [
            '/Users/valorkopeny/Library/Fonts/StyreneA-Black-Trial-BF63f6cbd9da245.otf',
            '/Users/valorkopeny/Library/Fonts/StretchPro.otf',
            '/Users/valorkopeny/Library/Fonts/fonnts.com-Aeonik-Bold.ttf'
        ]
        self.setup_pipeline()
        self.load_watermark()
        
    def setup_pipeline(self):
        """Load optimized SDXL pipeline"""
        print(f"🖥️  Using device: {self.device}")
        print("🔄 Loading Stable Diffusion XL...")
        
        model_id = "stabilityai/stable-diffusion-xl-base-1.0"
        
        self.pipeline = StableDiffusionXLPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float32,
            use_safetensors=True,
            variant=None
        )
        
        self.pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
            self.pipeline.scheduler.config,
            use_karras_sigmas=True
        )
        
        if self.device == "mps":
            self.pipeline = self.pipeline.to(self.device)
            self.pipeline.enable_model_cpu_offload()
            
        print("✅ Pipeline ready")
    
    def load_lora_model(self, client):
        """Check for LoRA model - currently using enhanced prompt-based approach"""
        lora_path = f"/Users/valorkopeny/crypto-news-curator-backend/ai-cover-generator/models/lora/{client}_lora.safetensors"
        
        if os.path.exists(lora_path):
            print(f"🎨 Found LoRA file: {lora_path}")
            # Check if it's actually a trained model or just prompt enhancement
            try:
                with open(lora_path, 'r') as f:
                    content = f.read(100)  # Read first 100 chars
                    if content.startswith('#'):
                        print(f"📝 Using enhanced prompt-based approach for {client.upper()}")
                        print(f"💡 Training data available: 25 variations in training_data/{client}/")
                        print(f"🔄 Consider actual LoRA training for even better logo integration")
                        return False
            except:
                pass
            
            try:
                print(f"🎨 Attempting LoRA loading: {lora_path}")
                self.pipeline.load_lora_weights(lora_path)
                self.pipeline.fuse_lora()
                print(f"✅ LoRA model loaded for {client.upper()}")
                return True
            except Exception as e:
                print(f"📝 LoRA loading failed, using enhanced prompts for {client.upper()}")
                print(f"💡 Enhanced prompts will include specific {client} logo elements")
                return False
        else:
            print(f"📝 No LoRA model found, using enhanced prompts for {client.upper()}")
            return False
    
    def load_watermark(self):
        """Load Genfinity watermark"""
        watermark_path = "/Users/valorkopeny/Desktop/genfinity-watermark.png"
        try:
            self.watermark = Image.open(watermark_path).convert("RGBA")
            print(f"✅ Loaded watermark: {self.watermark.size}")
        except Exception as e:
            print(f"⚠️  No watermark found: {e}")
            self.watermark = None
    
    def get_client_fonts(self, client="hedera"):
        """Load client-specific fonts with kerning support"""
        fonts = {}
        
        font_sizes = {
            "title": 150,
            "subtitle": 80,
            "small": 50
        }
        
        # Get client-specific fonts
        if client in self.client_fonts:
            client_font_list = self.client_fonts[client]
            selected_font_path = random.choice(client_font_list)
        else:
            selected_font_path = random.choice(self.custom_fonts)
        
        font_name = os.path.basename(selected_font_path).split('.')[0]
        
        # Determine kerning based on font type
        kerning = -40 if "Styrene" in font_name else -15
        
        print(f"🎲 Selected {client.upper()} font: {font_name}")
        print(f"✂️  Kerning: {kerning}")
        
        for size_name, size in font_sizes.items():
            try:
                if os.path.exists(selected_font_path):
                    fonts[size_name] = ImageFont.truetype(selected_font_path, size)
                else:
                    raise FileNotFoundError(f"Font not found: {selected_font_path}")
            except Exception as e:
                print(f"⚠️  Failed to load {selected_font_path}: {e}")
                fallback_fonts = [
                    "/System/Library/Fonts/Arial.ttc",
                    "/System/Library/Fonts/Helvetica.ttc"
                ]
                for fallback in fallback_fonts:
                    try:
                        if os.path.exists(fallback):
                            fonts[size_name] = ImageFont.truetype(fallback, size)
                            break
                    except:
                        continue
                
                if size_name not in fonts:
                    fonts[size_name] = ImageFont.load_default()
        
        return fonts, font_name, selected_font_path, kerning
    
    def get_random_fonts(self):
        """Load random selection from your custom fonts - DEPRECATED"""
        fonts, font_name, font_path, kerning = self.get_client_fonts("hedera")
        return fonts, font_name
    
    def smart_line_breaking_with_scaling(self, title, draw, base_font_path, base_font_size, max_width=1080):
        """Smart line breaking with dynamic font scaling to fit 60% width constraint"""
        words = title.split()
        max_title_width = max_width
        
        print(f"📏 Max width constraint: {max_title_width}px (60% of 1800px)")
        
        # Try to fit as single line first by scaling font down if needed
        current_font_size = base_font_size
        min_font_size = 60  # Don't go below 60px
        
        while current_font_size >= min_font_size:
            try:
                test_font = ImageFont.truetype(base_font_path, current_font_size)
                single_line_bbox = draw.textbbox((0, 0), title, font=test_font)
                single_line_width = single_line_bbox[2] - single_line_bbox[0]
                
                if single_line_width <= max_title_width:
                    print(f"📏 Single line fits with font size {current_font_size}px (width: {single_line_width}px)")
                    return [title], test_font, current_font_size
                
                current_font_size -= 5  # Reduce by 5px each iteration
                
            except Exception as e:
                print(f"⚠️  Font loading error at size {current_font_size}: {e}")
                break
        
        # If single line doesn't fit even at minimum size, try two lines
        print(f"⚠️  Single line too long, trying two lines with font scaling...")
        
        current_font_size = base_font_size
        while current_font_size >= min_font_size:
            try:
                test_font = ImageFont.truetype(base_font_path, current_font_size)
                
                # Find best split point for two lines
                best_split = None
                best_ratio = 0
                
                for i in range(1, len(words)):
                    line1 = " ".join(words[:i])
                    line2 = " ".join(words[i:])
                    
                    bbox1 = draw.textbbox((0, 0), line1, font=test_font)
                    bbox2 = draw.textbbox((0, 0), line2, font=test_font)
                    width1 = bbox1[2] - bbox1[0]
                    width2 = bbox2[2] - bbox2[0]
                    
                    # Both lines must fit within width constraint
                    if width1 <= max_title_width and width2 <= max_title_width:
                        # Prefer longer first line
                        if width2 > 0:
                            ratio = width1 / width2
                            if ratio > best_ratio and ratio >= 1.0:
                                best_ratio = ratio
                                best_split = i
                
                if best_split is not None:
                    line1 = " ".join(words[:best_split])
                    line2 = " ".join(words[best_split:])
                    print(f"📏 Two lines fit with font size {current_font_size}px")
                    return [line1, line2], test_font, current_font_size
                
                current_font_size -= 5
                
            except Exception as e:
                print(f"⚠️  Font loading error at size {current_font_size}: {e}")
                break
        
        # Last resort: use minimum font size and find split that respects width
        try:
            fallback_font = ImageFont.truetype(base_font_path, min_font_size)
            
            # Try to find a split that fits within width constraint even at minimum font size
            for i in range(1, len(words)):
                line1 = " ".join(words[:i])
                line2 = " ".join(words[i:])
                
                bbox1 = draw.textbbox((0, 0), line1, font=fallback_font)
                bbox2 = draw.textbbox((0, 0), line2, font=fallback_font)
                width1 = bbox1[2] - bbox1[0]
                width2 = bbox2[2] - bbox2[0]
                
                # If both lines fit within constraint, use this split
                if width1 <= max_title_width and width2 <= max_title_width:
                    print(f"⚠️  Using fallback font size {min_font_size}px with width-respecting split")
                    print(f"📏 Fallback line 1 width: {width1}px ({'✅ FITS' if width1 <= max_title_width else '❌ OVERFLOW'})")
                    print(f"📏 Fallback line 2 width: {width2}px ({'✅ FITS' if width2 <= max_title_width else '❌ OVERFLOW'})")
                    return [line1, line2], fallback_font, min_font_size
            
            # If no split works even at minimum size, use aggressive word-by-word fitting for BOTH lines
            print(f"⚠️  Even minimum font size doesn't fit - using aggressive splitting")
            line1_words = []
            line2_words = []
            remaining_words = words[:]
            
            # Build first line word by word until it reaches max width
            for word in words:
                test_line = " ".join(line1_words + [word])
                test_bbox = draw.textbbox((0, 0), test_line, font=fallback_font)
                test_width = test_bbox[2] - test_bbox[0]
                
                if test_width <= max_title_width:
                    line1_words.append(word)
                    remaining_words.remove(word)
                else:
                    break
            
            # Build second line word by word until it reaches max width
            for word in remaining_words[:]:  # Use slice to avoid modification during iteration
                test_line = " ".join(line2_words + [word])
                test_bbox = draw.textbbox((0, 0), test_line, font=fallback_font)
                test_width = test_bbox[2] - test_bbox[0]
                
                if test_width <= max_title_width:
                    line2_words.append(word)
                    remaining_words.remove(word)
                else:
                    break
            
            line1 = " ".join(line1_words) if line1_words else words[0]  # At least one word
            line2 = " ".join(line2_words) if line2_words else ""
            
            # If there are still remaining words that don't fit, truncate with ellipsis
            if remaining_words:
                if line2:
                    line2 += "..."
                else:
                    line1 += "..."
                print(f"⚠️  Title too long - truncated with ellipsis. Remaining words: {remaining_words}")
            
            # Final width check
            bbox1 = draw.textbbox((0, 0), line1, font=fallback_font)
            bbox2 = draw.textbbox((0, 0), line2, font=fallback_font) if line2 else (0, 0, 0, 0)
            width1 = bbox1[2] - bbox1[0]
            width2 = bbox2[2] - bbox2[0]
            
            print(f"📏 Aggressive split line 1 width: {width1}px ({'✅ FITS' if width1 <= max_title_width else '❌ OVERFLOW'})")
            if line2:
                print(f"📏 Aggressive split line 2 width: {width2}px ({'✅ FITS' if width2 <= max_title_width else '❌ OVERFLOW'})")
            
            return [line1, line2] if line2 else [line1], fallback_font, min_font_size
            
        except Exception as e:
            print(f"⚠️  Font loading error in fallback: {e}")
            # Ultimate fallback
            return [title], ImageFont.load_default(), 40
    
    def apply_title_case(self, title, use_title_case=None):
        """Apply title case formatting with random chance if not specified"""
        if use_title_case is None:
            use_title_case = random.choice([True, False])  # 50% chance
        
        if use_title_case:
            # Capitalize first letter of each word
            formatted_title = ' '.join(word.capitalize() for word in title.split())
            print(f"📝 Applied title case: {formatted_title}")
            return formatted_title.upper()  # Still convert to uppercase for display
        else:
            return title.upper()
    
    def calculate_text_width_with_kerning(self, text, font, kerning=0):
        """Calculate the actual width of text with kerning applied"""
        if kerning == 0:
            # No kerning - use standard width calculation
            bbox = ImageDraw.Draw(Image.new("RGB", (1, 1))).textbbox((0, 0), text, font=font)
            return bbox[2] - bbox[0]
        
        # Calculate width with kerning
        font_size = font.size if hasattr(font, 'size') else 60
        kerning_pixels = (kerning / 1000.0) * font_size
        
        total_width = 0
        dummy_draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        
        for char in text:
            char_bbox = dummy_draw.textbbox((0, 0), char, font=font)
            char_width = char_bbox[2] - char_bbox[0]
            total_width += char_width + kerning_pixels
        
        # Remove the last kerning adjustment (after last character)
        total_width -= kerning_pixels
        return total_width

    def draw_text_with_kerning(self, draw, text, position, font, fill, kerning=0):
        """Draw text with custom kerning/letter spacing (Photoshop-style)"""
        if kerning == 0:
            # No kerning - use standard draw
            draw.text(position, text, fill=fill, font=font)
            return
        
        # Convert Photoshop-style kerning to pixel adjustment
        # Photoshop kerning: -40 = slightly tighter, -15 = very subtle
        # Formula: kerning_pixels = (kerning_value / 1000) * font_size
        font_size = font.size if hasattr(font, 'size') else 60  # fallback
        kerning_pixels = (kerning / 1000.0) * font_size
        
        # Apply kerning by drawing each character separately
        x, y = position
        for char in text:
            draw.text((x, y), char, fill=fill, font=font)
            # Get character width and add kerning adjustment
            char_bbox = draw.textbbox((0, 0), char, font=font)
            char_width = char_bbox[2] - char_bbox[0]
            x += char_width + kerning_pixels
    
    def draw_rounded_rectangle(self, draw, bbox, radius, fill, outline=None, width=1):
        """Draw a rectangle with rounded corners"""
        x1, y1, x2, y2 = bbox
        
        # Draw the main rectangle body
        draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill, outline=outline, width=width)
        draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill, outline=outline, width=width)
        
        # Draw the rounded corners
        draw.pieslice([x1, y1, x1 + 2*radius, y1 + 2*radius], 180, 270, fill=fill, outline=outline, width=width)
        draw.pieslice([x2 - 2*radius, y1, x2, y1 + 2*radius], 270, 360, fill=fill, outline=outline, width=width)
        draw.pieslice([x1, y2 - 2*radius, x1 + 2*radius, y2], 90, 180, fill=fill, outline=outline, width=width)
        draw.pieslice([x2 - 2*radius, y2 - 2*radius, x2, y2], 0, 90, fill=fill, outline=outline, width=width)
    
    def get_refined_brand_prompts(self, client="hedera"):
        """Get enhanced prompts based on actual training data for logo integration"""
        
        # Multiple style variations for each network
        style_variations = [
            "network_nodes", "abstract_flow", "geometric_patterns", 
            "particle_waves", "crystalline_structures", "energy_fields"
        ]
        
        # Randomly select a style variation or use a specific one
        import random
        selected_style = random.choice(style_variations)
        
        brand_prompts = {
            "hedera": {
                "network_nodes": {
                    "base": "dramatic dark purple hashgraph technology background, deep black void with glowing purple elements",
                    "tech": "glowing hashgraph network nodes in dark space, electric purple connections on black background, hexagonal grid overlay with luminous H symbols",
                    "quality": "premium dark technology photography, 8k resolution, dramatic lighting with deep shadows"
                },
                "abstract_flow": {
                    "base": "sophisticated dark purple fluid dynamics background, deep black space with flowing purple energy streams",
                    "tech": "smooth purple energy currents flowing through dark void, liquid hashgraph patterns, abstract data streams with purple gradients",
                    "quality": "cinematic abstract technology art, 8k resolution, smooth flowing lighting effects"
                },
                "geometric_patterns": {
                    "base": "minimalist dark background with purple geometric architecture, clean black space with structured elements",
                    "tech": "angular purple geometric shapes, hexagonal architectural patterns, modern minimalist design with purple accents",
                    "quality": "architectural technology photography, 8k resolution, clean professional lighting"
                },
                "particle_waves": {
                    "base": "dark cosmic background with purple particle systems, deep space with glowing purple dust clouds",
                    "tech": "swirling purple particle waves, cosmic dust formations, ethereal purple energy clouds floating in space",
                    "quality": "cosmic particle photography, 8k resolution, ethereal lighting effects"
                },
                "crystalline_structures": {
                    "base": "dark background with purple crystal formations, black void with glowing crystalline structures",
                    "tech": "luminous purple crystal clusters, geometric crystal growth patterns, faceted purple gemstone structures",
                    "quality": "premium crystal photography, 8k resolution, dramatic crystal lighting"
                },
                "energy_fields": {
                    "base": "dark electromagnetic field background, deep black with purple energy field distortions",
                    "tech": "purple electromagnetic waves, energy field visualizations, plasma-like purple distortions in space",
                    "quality": "electromagnetic field photography, 8k resolution, electric energy lighting"
                }
            },
            
            "algorand": {
                "network_nodes": {
                    "base": "sophisticated dark blockchain environment, deep black background with glowing teal triangular elements",
                    "tech": "glowing proof of stake visualization, electric teal triangular nodes on black background, geometric network topology",
                    "quality": "premium dark fintech photography, 8k resolution, dramatic professional lighting"
                },
                "abstract_flow": {
                    "base": "sleek dark background with teal liquid dynamics, black void with flowing teal energy streams",
                    "tech": "smooth teal energy currents, liquid consensus patterns, abstract algorithmic flows with teal gradients",
                    "quality": "fluid dynamics art photography, 8k resolution, smooth flowing lighting"
                },
                "geometric_patterns": {
                    "base": "clean dark architectural background, minimalist black space with teal geometric structures",
                    "tech": "precise teal geometric forms, triangular architectural elements, mathematical precision patterns",
                    "quality": "mathematical architecture photography, 8k resolution, precision lighting"
                },
                "particle_waves": {
                    "base": "dark quantum background with teal particle systems, deep space with glowing teal quantum fields",
                    "tech": "teal quantum particle waves, algorithmic dust formations, quantum computing visualization effects",
                    "quality": "quantum physics photography, 8k resolution, quantum lighting effects"
                },
                "crystalline_structures": {
                    "base": "dark background with teal crystal matrices, black void with geometric teal crystal formations",
                    "tech": "angular teal crystal structures, algorithmic crystal growth, faceted teal geometric crystals",
                    "quality": "geometric crystal photography, 8k resolution, mathematical crystal lighting"
                },
                "energy_fields": {
                    "base": "dark computational field background, black space with teal algorithmic energy patterns",
                    "tech": "teal computational waves, algorithm visualization fields, digital energy distortions",
                    "quality": "computational field photography, 8k resolution, digital energy lighting"
                }
            },
            
            "constellation": {
                "network_nodes": {
                    "base": "dramatic dark cosmic space environment, deep black void with glowing stellar elements",
                    "tech": "glowing DAG network visualization, electric white star-shaped nodes on cosmic black background",
                    "quality": "premium dark space photography, 8k resolution, dramatic cosmic lighting"
                },
                "abstract_flow": {
                    "base": "deep space with flowing stellar energy, cosmic black with streaming white energy ribbons",
                    "tech": "flowing stellar energy streams, cosmic wind patterns, abstract galactic currents with white trails",
                    "quality": "cosmic flow photography, 8k resolution, stellar wind lighting"
                },
                "geometric_patterns": {
                    "base": "clean cosmic architecture background, dark space with geometric stellar structures",
                    "tech": "precise white geometric constellations, architectural star patterns, mathematical cosmic geometry",
                    "quality": "cosmic architecture photography, 8k resolution, stellar geometric lighting"
                },
                "particle_waves": {
                    "base": "deep space nebula background, cosmic black with white stardust particle systems",
                    "tech": "swirling white stardust waves, nebula particle formations, cosmic dust cloud patterns",
                    "quality": "nebula photography, 8k resolution, stardust lighting effects"
                },
                "crystalline_structures": {
                    "base": "dark space with white crystal star formations, cosmic void with luminous crystal clusters",
                    "tech": "white crystalline star structures, cosmic crystal growth patterns, faceted stellar crystal formations",
                    "quality": "stellar crystal photography, 8k resolution, cosmic crystal lighting"
                },
                "energy_fields": {
                    "base": "dark gravitational field background, deep space with white gravitational wave distortions",
                    "tech": "white gravitational waves, spacetime distortion patterns, cosmic energy field visualizations",
                    "quality": "gravitational field photography, 8k resolution, spacetime lighting effects"
                }
            }
        }
        
        if client.lower() not in brand_prompts:
            client = "hedera"
        
        # Get the brand and selected style
        brand_styles = brand_prompts[client.lower()]
        if selected_style not in brand_styles:
            selected_style = "network_nodes"  # fallback
            
        brand = brand_styles[selected_style]
        
        print(f"🎨 Using style variation: {selected_style}")
        
        full_prompt = f"{brand['base']}, {brand['tech']}, {brand['quality']}, professional article cover background, no text, no words, no letters"
        
        return full_prompt
    
    def create_boxed_text_overlay(self, width, height, title, subtitle="", fonts=None, font_name="", use_subtitle_box=True, client="hedera", kerning=0, use_title_case=None):
        """Create text overlay with optional rounded subtitle box, client-specific fonts, and kerning"""
        
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        
        if not fonts:
            fonts, font_name = self.get_random_fonts()
        
        # TITLE with dynamic font scaling and title case formatting
        if title:
            title = self.apply_title_case(title, use_title_case)
            
            # Get font path for scaling
            selected_font_path = random.choice(self.custom_fonts)
            base_font_size = 150
            
            # Dynamic font scaling to fit 60% width constraint (1080px)
            max_title_width = int(width * 0.6)  # 60% of image width
            title_lines, scaled_font, final_font_size = self.smart_line_breaking_with_scaling(
                title, draw, selected_font_path, base_font_size, max_title_width
            )
            
            # Update fonts dict with the scaled title font
            fonts["title"] = scaled_font
            print(f"🎯 Final title font size: {final_font_size}px")
            
            # Dynamic line spacing: 10% of font size (tighter)
            line_height = int(final_font_size * 1.1)  # Font size + 10% spacing
            total_title_height = len(title_lines) * line_height
            start_y = (height - total_title_height) // 2 - 50
            
            for i, line in enumerate(title_lines):
                bbox = draw.textbbox((0, 0), line, font=fonts["title"])
                text_width = bbox[2] - bbox[0]
                
                x = (width - text_width) // 2
                y = start_y + (i * line_height)
                
                # Very subtle shadow with kerning
                shadow_offset = 2
                shadow_color = (0, 0, 0, 50)
                
                self.draw_text_with_kerning(draw, line, (x + shadow_offset, y + shadow_offset), fonts["title"], shadow_color, kerning)
                self.draw_text_with_kerning(draw, line, (x, y), fonts["title"], (255, 255, 255, 255), kerning)
                
                print(f"📝 Title line {i+1}: '{line}' at ({x}, {y})")
        
        # SUBTITLE with optional rounded box and WHITE text
        if subtitle:
            # Ensure subtitle font is smaller than title font (max 60% of title font size)
            subtitle_font_size = max(40, int(final_font_size * 0.6))  # Min 40px, max 60% of title
            try:
                fonts["subtitle"] = ImageFont.truetype(selected_font_path, subtitle_font_size)
                print(f"🎯 Subtitle font size: {subtitle_font_size}px (60% of title font {final_font_size}px)")
            except:
                fonts["subtitle"] = ImageFont.load_default()
            
            subtitle_y = start_y + total_title_height + 40
            
            bbox = draw.textbbox((0, 0), subtitle, font=fonts["subtitle"])
            subtitle_width = bbox[2] - bbox[0]
            
            if subtitle_width > width * 0.9:
                words = subtitle.split()
                # For subtitles, use simple split without title width constraints
                mid_point = len(words) // 2
                subtitle_lines = [
                    " ".join(words[:mid_point]),
                    " ".join(words[mid_point:])
                ]
            else:
                subtitle_lines = [subtitle]
            
            # Calculate total subtitle dimensions for box (accounting for kerning)
            total_subtitle_width = 0
            total_subtitle_height = len(subtitle_lines) * 70
            
            for line in subtitle_lines:
                line_width = self.calculate_text_width_with_kerning(line, fonts["subtitle"], kerning)
                if line_width > total_subtitle_width:
                    total_subtitle_width = line_width
            
            # Calculate proper vertical centering for subtitle text with dynamic spacing
            subtitle_line_spacing = int(subtitle_font_size * 1.1)  # 10% spacing for subtitle too
            actual_text_height = len(subtitle_lines) * subtitle_line_spacing
            
            # Draw rounded box if requested
            if use_subtitle_box and subtitle_lines:
                # Box padding
                box_padding_x = 40
                box_padding_y = 25
                
                # Calculate actual text dimensions for proper centering
                actual_text_height = subtitle_font_size  # For single line, just use font size
                if len(subtitle_lines) > 1:
                    actual_text_height = (len(subtitle_lines) - 1) * subtitle_line_spacing + subtitle_font_size
                
                # Box dimensions - make box larger to accommodate padding
                box_height = actual_text_height + (box_padding_y * 2)
                
                # Box position (centered around text)
                box_x1 = (width - total_subtitle_width) // 2 - box_padding_x
                box_y1 = subtitle_y - box_padding_y
                box_x2 = (width + total_subtitle_width) // 2 + box_padding_x
                box_y2 = box_y1 + box_height
                
                # Calculate perfect vertical center for text positioning
                box_center_y = (box_y1 + box_y2) // 2
                text_start_y = box_center_y - (actual_text_height // 2)
                
                # Draw rounded rectangle background
                box_radius = 15  # Corner radius
                box_color = (0, 0, 0, 120)  # Semi-transparent black
                
                self.draw_rounded_rectangle(
                    draw, 
                    (box_x1, box_y1, box_x2, box_y2), 
                    box_radius, 
                    fill=box_color
                )
                
                print(f"📦 Subtitle box: ({box_x1}, {box_y1}) to ({box_x2}, {box_y2}) with radius {box_radius}")
                print(f"📦 Box height: {box_height}px, Text height: {actual_text_height}px")
                print(f"📦 Box center Y: {box_center_y}, Text start Y: {text_start_y}")
            else:
                # No box - use original positioning
                text_start_y = subtitle_y
            
            # Draw subtitle text (WHITE) - centered both horizontally and vertically in box
            for i, line in enumerate(subtitle_lines):
                # Calculate width with kerning for proper centering
                text_width = self.calculate_text_width_with_kerning(line, fonts["subtitle"], kerning)
                
                # Center horizontally
                x = (width - text_width) // 2
                
                # Center vertically within the box or use standard positioning
                if use_subtitle_box:
                    y = text_start_y + (i * subtitle_line_spacing)
                else:
                    y = subtitle_y + (i * subtitle_line_spacing)
                
                # Subtle subtitle shadow with kerning
                shadow_offset = 1
                shadow_color = (0, 0, 0, 30)
                
                self.draw_text_with_kerning(draw, line, (x + shadow_offset, y + shadow_offset), fonts["subtitle"], shadow_color, kerning)
                
                # WHITE subtitle text with kerning
                self.draw_text_with_kerning(draw, line, (x, y), fonts["subtitle"], (255, 255, 255, 255), kerning)
                
                print(f"📝 Subtitle line {i+1}: '{line}' at ({x}, {y}) - WHITE text, centered in box")
        
        return overlay
    
    def generate_boxed_cover(self, title="", subtitle="", client="hedera", use_subtitle_box=True, use_title_case=None):
        """Generate cover with boxed subtitle styling using LoRA models and client-specific fonts"""
        
        # Get client-specific fonts and kerning
        fonts, font_name, font_path, kerning = self.get_client_fonts(client)
        
        # Load LoRA model for client
        lora_loaded = self.load_lora_model(client)
        
        # Get refined prompt
        brand_prompt = self.get_refined_brand_prompts(client)
        
        print(f"\n🏢 Generating BOXED {client.upper()} cover...")
        print(f"🎨 LoRA Model: {'LOADED' if lora_loaded else 'NOT FOUND'}")
        print(f"🎲 Using font: {font_name}")
        print(f"📰 Title: {title}")
        print(f"📝 Subtitle: {subtitle}")
        print(f"📦 Subtitle box: {'YES' if use_subtitle_box else 'NO'}")
        print(f"🎨 Subtitle color: WHITE")
        
        try:
            # Generate background
            image = self.pipeline(
                prompt=brand_prompt,
                negative_prompt="text, letters, words, titles, subtitles, watermarks, signatures, typography, fonts, readable text, characters, alphabet, numbers, low quality, blurry, amateur, ugly, poor lighting, pixelated, distorted logos",
                width=1792,
                height=896,
                num_inference_steps=35,
                guidance_scale=9.0,
                num_images_per_prompt=1,
                generator=torch.Generator(device=self.device).manual_seed(random.randint(100, 999))
            ).images[0]
            
            # Resize to exact specification
            resized_image = image.resize((1800, 900), Image.Resampling.LANCZOS)
            base_rgba = resized_image.convert("RGBA")
            
            # Add boxed text overlay with all new features
            if title:
                text_overlay = self.create_boxed_text_overlay(
                    1800, 900, title, subtitle, fonts, font_name, use_subtitle_box, 
                    client, kerning, use_title_case
                )
                base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            # Apply watermark
            if self.watermark:
                full_size_watermark = self.watermark.resize((1800, 900), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, full_size_watermark)
            else:
                final_image = base_rgba
            
            print("✅ Boxed cover generation complete")
            return final_image.convert("RGB"), font_name
            
        except Exception as e:
            print(f"❌ Cover generation failed: {str(e)}")
            return None, None
    
    def generate_article_based_cover(self, article_text: str, title: str = "", subtitle: str = "", client: str = "hedera", use_subtitle_box: bool = True, use_title_case: bool = None):
        """Generate cover based on article content analysis using OpenAI"""
        
        if not self.article_generator:
            print("⚠️  OpenAI article generator not available, falling back to standard generation")
            return self.generate_boxed_cover(title, subtitle, client, use_subtitle_box, use_title_case)
        
        print(f"\n🤖 Generating AI-enhanced cover for {client.upper()} based on article content...")
        
        try:
            # Process article and generate enhanced prompt
            article_result = self.article_generator.process_article_for_cover(
                article_text, title, subtitle, client
            )
            
            enhanced_prompt = article_result['enhanced_prompt']
            
            print(f"🎨 Using AI-enhanced prompt ({len(enhanced_prompt)} chars)")
            print(f"📝 Prompt preview: {enhanced_prompt[:100]}...")
            
            # Get client-specific fonts and kerning
            fonts, font_name, font_path, kerning = self.get_client_fonts(client)
            
            # Load LoRA model for client (will use enhanced prompts if LoRA unavailable)
            lora_loaded = self.load_lora_model(client)
            
            print(f"\n🏢 Generating ARTICLE-BASED {client.upper()} cover...")
            print(f"🎨 LoRA Model: {'LOADED' if lora_loaded else 'ENHANCED PROMPTS'}")
            print(f"🎲 Using font: {font_name}")
            print(f"📰 Title: {title}")
            print(f"📝 Subtitle: {subtitle}")
            print(f"📦 Subtitle box: {'YES' if use_subtitle_box else 'NO'}")
            print(f"🤖 AI-Enhanced: YES")
            
            # Generate background with AI-enhanced prompt
            image = self.pipeline(
                prompt=enhanced_prompt,
                negative_prompt="text, letters, words, titles, subtitles, watermarks, signatures, typography, fonts, readable text, characters, alphabet, numbers, low quality, blurry, amateur, ugly, poor lighting, pixelated, distorted logos",
                width=1792,
                height=896,
                num_inference_steps=35,
                guidance_scale=9.0,
                num_images_per_prompt=1,
                generator=torch.Generator(device=self.device).manual_seed(random.randint(100, 999))
            ).images[0]
            
            # Resize to exact specification
            resized_image = image.resize((1800, 900), Image.Resampling.LANCZOS)
            base_rgba = resized_image.convert("RGBA")
            
            # Add boxed text overlay with all features
            if title:
                text_overlay = self.create_boxed_text_overlay(
                    1800, 900, title, subtitle, fonts, font_name, use_subtitle_box, 
                    client, kerning, use_title_case
                )
                base_rgba = Image.alpha_composite(base_rgba, text_overlay)
            
            # Apply watermark
            if self.watermark:
                full_size_watermark = self.watermark.resize((1800, 900), Image.Resampling.LANCZOS)
                final_image = Image.alpha_composite(base_rgba, full_size_watermark)
            else:
                final_image = base_rgba
            
            print("✅ Article-based cover generation complete")
            print(f"🎯 Enhanced with: {article_result['analysis'].get('main_topic', 'N/A')}")
            
            return final_image.convert("RGB"), font_name
            
        except Exception as e:
            print(f"❌ Article-based cover generation failed: {str(e)}")
            print("🔄 Falling back to standard cover generation...")
            return self.generate_boxed_cover(title, subtitle, client, use_subtitle_box, use_title_case)

def generate_multiple_examples():
    """Generate multiple examples with LoRA models and proper typography"""
    generator = BoxedSubtitleGenerator()
    
    # Test cases with varied titles to showcase different scenarios
    test_examples = [
        {
            "title": "Hedera Network Major Partnership",
            "subtitle": "Revolutionary DeFi Innovation",
            "client": "hedera",
            "use_box": True
        },
        {
            "title": "Algorand Consensus Protocol Breakthrough Delivers Scalable Solutions",
            "subtitle": "Pure Proof of Stake Technology", 
            "client": "algorand",
            "use_box": True
        },
        {
            "title": "Constellation Network Launches Enterprise DAG Platform",
            "subtitle": "Decentralized Exchange Platform",
            "client": "constellation",
            "use_box": True
        },
        {
            "title": "Hedera Hashgraph Ecosystem Growth",
            "subtitle": "Enterprise Adoption Accelerates",
            "client": "hedera",
            "use_box": False
        },
        {
            "title": "Algorand Smart Contract Platform Update",
            "subtitle": "Enhanced Performance Metrics",
            "client": "algorand", 
            "use_box": True
        }
    ]
    
    os.makedirs("/Users/valorkopeny/crypto-news-curator-backend/ai-cover-generator/style_outputs", exist_ok=True)
    
    for i, test in enumerate(test_examples, 1):
        print(f"\n🎨 Example {i}/{len(test_examples)}: {test['client'].upper()}")
        
        cover, font_name = generator.generate_boxed_cover(
            title=test["title"],
            subtitle=test["subtitle"], 
            client=test["client"],
            use_subtitle_box=test["use_box"]
        )
        
        if cover:
            box_suffix = "_boxed" if test["use_box"] else "_clean"
            timestamp = random.randint(1000, 9999)
            filename = f"lora_{test['client']}{box_suffix}_{timestamp}.png"
            filepath = f"/Users/valorkopeny/crypto-news-curator-backend/ai-cover-generator/style_outputs/{filename}"
            cover.save(filepath)
            print(f"✅ Saved: {filepath}")
            print(f"🏢 Client: {test['client'].upper()}")
            print(f"🎲 Font: {font_name}")
            print(f"📦 Box: {'YES' if test['use_box'] else 'NO'}")
            print(f"🎨 Features: LoRA model, width constraints, perfect centering")
        else:
            print(f"❌ Failed to generate {test['client']} cover")
    
    print("\n🎉 Multiple example generation complete!")
    print("✨ Features: LoRA models, 60% width constraints, dynamic font scaling, perfect subtitle centering")

def test_boxed_subtitles():
    """Test boxed subtitle variations - DEPRECATED: Use generate_multiple_examples() instead"""
    print("⚠️  test_boxed_subtitles() is deprecated. Use generate_multiple_examples() for better results.")
    generate_multiple_examples()

def main():
    parser = argparse.ArgumentParser(description="AI-Enhanced Cover Generator with Article Analysis")
    parser.add_argument("--title", type=str, default="Technology Update", help="Article title")
    parser.add_argument("--subtitle", type=str, default="Innovation Breakthrough", help="Article subtitle") 
    parser.add_argument("--client", choices=["hedera", "algorand", "constellation"], default="hedera", help="Client brand")
    parser.add_argument("--box", action="store_true", help="Add rounded box around subtitle")
    parser.add_argument("--title-case", action="store_true", help="Use title case (capitalize first letters)")
    parser.add_argument("--article", type=str, help="Article text or file path for AI-enhanced generation")
    parser.add_argument("--test", action="store_true", help="Run boxed subtitle tests")
    
    args = parser.parse_args()
    
    if args.test:
        test_boxed_subtitles()
    else:
        generator = BoxedSubtitleGenerator()
        
        # Check if article-based generation is requested
        if args.article:
            # Handle article input (file path or direct text)
            if os.path.exists(args.article):
                with open(args.article, 'r', encoding='utf-8') as f:
                    article_text = f.read()
                print(f"📖 Loaded article from: {args.article}")
            else:
                article_text = args.article
                print(f"📖 Using provided article text ({len(article_text)} chars)")
            
            # Generate article-based cover
            cover, font_name = generator.generate_article_based_cover(
                article_text=article_text,
                title=args.title,
                subtitle=args.subtitle,
                client=args.client,
                use_subtitle_box=args.box,
                use_title_case=args.title_case
            )
        else:
            # Standard cover generation
            cover, font_name = generator.generate_boxed_cover(
                title=args.title,
                subtitle=args.subtitle,
                client=args.client,
                use_subtitle_box=args.box,
                use_title_case=args.title_case
            )
        
        if cover:
            box_suffix = "_boxed" if args.box else ""
            filename = f"boxed_cover_{args.client}{box_suffix}.png"
            filepath = f"/Users/valorkopeny/crypto-news-curator-backend/ai-cover-generator/style_outputs/{filename}"
            cover.save(filepath)
            print(f"✅ Cover saved: {filepath}")
            print(f"🏢 Client: {args.client.upper()}")
            print(f"🎲 Font: {font_name}")
            print(f"📦 Box: {'YES' if args.box else 'NO'}")

if __name__ == "__main__":
    main()