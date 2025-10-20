#!/usr/bin/env python3
"""
MINIMAL SD 1.5 + LoRA Cover Generator
Focuses only on getting SD 1.5 + LoRA working
"""
import os
import sys

# Fix HuggingFace Spaces cache permissions
os.environ['HF_HOME'] = '/tmp/huggingface'
os.environ['TRANSFORMERS_CACHE'] = '/tmp/huggingface/transformers'
os.environ['HF_DATASETS_CACHE'] = '/tmp/huggingface/datasets'

import random
import base64
import io
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn
import logging
from PIL import Image, ImageDraw, ImageFont
import torch
from diffusers import StableDiffusionPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GenerationRequest(BaseModel):
    client: str
    style: str
    title: str

class LoRAGenerator:
    def __init__(self):
        self.pipeline = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        
        logger.info(f"🖥️ Device: {self.device}")
        logger.info(f"🔢 Dtype: {self.dtype}")
        
        # Load everything
        self.load_pipeline()
        self.load_lora()
    
    def load_pipeline(self):
        """Load SD 1.5 pipeline"""
        logger.info("🚀 Loading SD 1.5 pipeline...")
        try:
            self.pipeline = StableDiffusionPipeline.from_pretrained(
                "runwayml/stable-diffusion-v1-5",
                torch_dtype=self.dtype,
                safety_checker=None,
                requires_safety_checker=False,
                low_cpu_mem_usage=True
            )
            
            if torch.cuda.is_available():
                self.pipeline = self.pipeline.to("cuda")
                self.pipeline.enable_attention_slicing()
                self.pipeline.enable_vae_slicing()
            
            logger.info("✅ SD 1.5 pipeline loaded")
            
        except Exception as e:
            logger.error(f"❌ Pipeline loading failed: {e}")
            raise
    
    def load_lora(self):
        """Load LoRA weights"""
        logger.info("🔗 Loading LoRA weights...")
        try:
            lora_path = "models/lora/crypto_cover_styles_lora.safetensors"
            
            if not os.path.exists(lora_path):
                raise FileNotFoundError(f"LoRA file not found: {lora_path}")
            
            self.pipeline.load_lora_weights(lora_path)
            logger.info("✅ LoRA weights loaded")
            
        except Exception as e:
            logger.error(f"❌ LoRA loading failed: {e}")
            raise
    
    def generate(self, client: str, style: str, title: str):
        """Generate cover with LoRA"""
        logger.info(f"🎨 Generating: {client}/{style}")
        
        # Simple prompt
        prompt = f"crypto financial cover, {client} style, professional design, high quality"
        negative_prompt = "text, letters, words, blurry, low quality"
        
        try:
            # Generate image
            image = self.pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                height=512,
                width=1024,
                num_inference_steps=20,
                guidance_scale=7.5,
                generator=torch.Generator(device=self.device).manual_seed(random.randint(1, 1000000))
            ).images[0]
            
            # Add title overlay
            draw = ImageDraw.Draw(image)
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
            except:
                font = ImageFont.load_default()
            
            # Simple title positioning
            text_bbox = draw.textbbox((0, 0), title, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            
            x = (image.width - text_width) // 2
            y = (image.height - text_height) // 2
            
            # Add text with outline
            for dx in [-2, 0, 2]:
                for dy in [-2, 0, 2]:
                    if dx != 0 or dy != 0:
                        draw.text((x + dx, y + dy), title, font=font, fill="black")
            draw.text((x, y), title, font=font, fill="white")
            
            # Convert to base64
            buffered = io.BytesIO()
            image.save(buffered, format="PNG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode()
            
            logger.info("✅ Generation successful")
            return img_base64
            
        except Exception as e:
            logger.error(f"❌ Generation failed: {e}")
            raise

# Initialize generator
logger.info("🚀 Initializing LoRA Generator...")
generator = LoRAGenerator()

# FastAPI app
app = FastAPI(title="SD 1.5 LoRA Generator")

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model": "SD 1.5",
        "lora": "loaded",
        "device": generator.device
    }

@app.post("/generate")
async def generate_cover(request: GenerationRequest):
    try:
        img_base64 = generator.generate(request.client, request.style, request.title)
        return {
            "success": True,
            "image": img_base64,
            "model": "SD 1.5 + LoRA"
        }
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)