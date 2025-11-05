#!/usr/bin/env python3
"""
Crypto News LoRA Generator - Uses Your Trained Model
"""
import gradio as gr
import os
import random
import torch
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
from peft import PeftModel
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global pipeline
_pipeline = None
_device = "cuda" if torch.cuda.is_available() else "cpu"

def load_lora_pipeline():
    """Load the trained LoRA model pipeline"""
    global _pipeline
    
    if _pipeline is not None:
        return _pipeline
    
    try:
        logger.info(f"🚀 Loading pipeline on {_device}")
        
        # Load base Stable Diffusion 1.5 model
        base_model = "runwayml/stable-diffusion-v1-5"
        
        # Load pipeline
        pipeline = StableDiffusionPipeline.from_pretrained(
            base_model,
            torch_dtype=torch.float16 if _device == "cuda" else torch.float32,
            safety_checker=None,
            requires_safety_checker=False
        )
        
        # Load your trained LoRA adapter
        lora_path = "models/lora"
        if os.path.exists(os.path.join(lora_path, "trained_crypto_lora.safetensors")):
            logger.info("📚 Loading trained LoRA model...")
            pipeline.unet = PeftModel.from_pretrained(
                pipeline.unet, 
                lora_path,
                adapter_name="crypto_lora"
            )
            logger.info("✅ LoRA model loaded successfully!")
        else:
            logger.warning("⚠️ Trained LoRA model not found, using base model")
        
        # Optimize pipeline
        pipeline.scheduler = DPMSolverMultistepScheduler.from_config(pipeline.scheduler.config)
        pipeline = pipeline.to(_device)
        
        if _device == "cuda":
            pipeline.enable_memory_efficient_attention()
            pipeline.enable_vae_slicing()
        
        _pipeline = pipeline
        logger.info("🎉 Pipeline loaded successfully!")
        return _pipeline
        
    except Exception as e:
        logger.error(f"❌ Error loading pipeline: {str(e)}")
        raise e

def add_text_overlay(image, title, subtitle=""):
    """Add text overlay to generated image"""
    draw = ImageDraw.Draw(image)
    width, height = image.size
    
    try:
        # Try to use a nice font, fallback to default
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
    
    # Add semi-transparent background for text
    overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    
    # Calculate text positions
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_width = title_bbox[2] - title_bbox[0]
    title_height = title_bbox[3] - title_bbox[1]
    
    # Position title at bottom
    title_x = (width - title_width) // 2
    title_y = height - title_height - 60
    
    # Background rectangle for title
    overlay_draw.rectangle([
        (title_x - 20, title_y - 10),
        (title_x + title_width + 20, title_y + title_height + 10)
    ], fill=(0, 0, 0, 180))
    
    # Composite overlay
    image = Image.alpha_composite(image.convert('RGBA'), overlay)
    draw = ImageDraw.Draw(image)
    
    # Draw title text
    draw.text((title_x, title_y), title, font=title_font, fill=(255, 255, 255))
    
    # Add subtitle if provided
    if subtitle:
        subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
        subtitle_x = (width - subtitle_width) // 2
        subtitle_y = title_y + title_height + 15
        draw.text((subtitle_x, subtitle_y), subtitle, font=subtitle_font, fill=(200, 200, 200))
    
    return image.convert('RGB')

def generate_crypto_cover(prompt, title="", negative_prompt="", num_steps=20, guidance_scale=7.5):
    """Generate crypto news cover using trained LoRA model"""
    try:
        logger.info(f"🎨 Generating image with prompt: {prompt}")
        
        # Load pipeline if not already loaded
        pipeline = load_lora_pipeline()
        
        # Enhanced prompt with LoRA trigger words
        enhanced_prompt = f"crypto cover art style, {prompt}, professional design, high quality, detailed"
        
        # Default negative prompt
        if not negative_prompt:
            negative_prompt = "low quality, blurry, text, watermark, signature, bad anatomy"
        
        # Generate image
        with torch.autocast(_device):
            result = pipeline(
                prompt=enhanced_prompt,
                negative_prompt=negative_prompt,
                num_inference_steps=num_steps,
                guidance_scale=guidance_scale,
                width=768,
                height=768,
                generator=torch.Generator(device=_device).manual_seed(random.randint(0, 2**32-1))
            )
        
        image = result.images[0]
        
        # Add text overlay if title provided
        if title.strip():
            image = add_text_overlay(image, title.strip())
        
        logger.info("✅ Image generated successfully!")
        return image
        
    except Exception as e:
        logger.error(f"❌ Error generating image: {str(e)}")
        # Return error image
        error_img = Image.new('RGB', (768, 768), color='red')
        draw = ImageDraw.Draw(error_img)
        draw.text((50, 350), f"Error: {str(e)}", fill='white')
        return error_img

# Gradio interface
def create_interface():
    """Create Gradio interface"""
    
    with gr.Blocks(title="Crypto News LoRA Generator", theme=gr.themes.Soft()) as demo:
        gr.Markdown("# 🚀 Crypto News Cover Generator")
        gr.Markdown("*Powered by your trained LoRA model*")
        
        with gr.Row():
            with gr.Column(scale=1):
                prompt_input = gr.Textbox(
                    label="📝 Image Prompt",
                    placeholder="Bitcoin reaching new heights, bull market celebration...",
                    lines=3
                )
                title_input = gr.Textbox(
                    label="🏷️ Cover Title (Optional)",
                    placeholder="Bitcoin Breaks $100K!"
                )
                negative_prompt = gr.Textbox(
                    label="🚫 Negative Prompt (Optional)",
                    placeholder="low quality, blurry, text...",
                    lines=2
                )
                
                with gr.Row():
                    steps_slider = gr.Slider(
                        minimum=10, maximum=50, value=20, step=1,
                        label="🔄 Inference Steps"
                    )
                    guidance_slider = gr.Slider(
                        minimum=1.0, maximum=20.0, value=7.5, step=0.5,
                        label="🎯 Guidance Scale"
                    )
                
                generate_btn = gr.Button("🎨 Generate Cover", variant="primary", scale=1)
                
            with gr.Column(scale=1):
                output_image = gr.Image(label="Generated Cover", type="pil", height=400)
        
        # Example prompts
        gr.Markdown("## 💡 Example Prompts")
        examples = [
            ["Bitcoin bull market celebration, golden coins, upward trending chart", "Bitcoin Soars to New Heights"],
            ["Ethereum network visualization, blue digital art, blockchain nodes", "Ethereum 2.0 Launch"],
            ["Cryptocurrency exchange interface, trading charts, neon lights", "Crypto Trading Guide"],
            ["DeFi protocol illustration, interconnected finance, futuristic", "DeFi Revolution"],
        ]
        
        gr.Examples(
            examples=examples,
            inputs=[prompt_input, title_input],
            outputs=output_image,
            fn=generate_crypto_cover,
            cache_examples=False
        )
        
        # Connect generate button
        generate_btn.click(
            fn=generate_crypto_cover,
            inputs=[prompt_input, title_input, negative_prompt, steps_slider, guidance_slider],
            outputs=output_image
        )
    
    return demo

# Launch the app
if __name__ == "__main__":
    logger.info("🌟 Starting Crypto News LoRA Generator...")
    demo = create_interface()
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=True
    )