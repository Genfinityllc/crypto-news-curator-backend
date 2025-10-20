#!/usr/bin/env python3
"""
LoRA Training Pipeline for Crypto Cover Backgrounds
Trains on original cover images to learn authentic visual styles
"""
import os
import json
from pathlib import Path
from PIL import Image
import torch
from diffusers import StableDiffusionXLPipeline
from diffusers.training_utils import enable_full_determinism
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CoverStyleLoRATrainer:
    def __init__(self, base_model="stabilityai/stable-diffusion-xl-base-1.0"):
        self.base_model = base_model
        self.training_data_dir = "training_data/cover_images"
        self.output_dir = "models/lora/cover_styles"
        
    def prepare_training_dataset(self, source_images_dir):
        """
        Prepare training dataset from original cover images
        
        Expected directory structure:
        source_images_dir/
        ├── hedera/
        │   ├── energy_fields/
        │   │   ├── image1.png
        │   │   └── image2.png
        │   └── dark_theme/
        │       ├── image1.png
        │       └── image2.png
        ├── algorand/
        │   └── network_nodes/
        │       ├── image1.png
        │       └── image2.png
        └── constellation/
            └── particle_waves/
                ├── image1.png
                └── image2.png
        """
        logger.info("📁 Preparing training dataset...")
        
        os.makedirs(self.training_data_dir, exist_ok=True)
        
        # Process each client and style combination
        metadata = []
        image_count = 0
        
        for client_dir in Path(source_images_dir).iterdir():
            if not client_dir.is_dir():
                continue
                
            client_name = client_dir.name
            logger.info(f"Processing {client_name} images...")
            
            for style_dir in client_dir.iterdir():
                if not style_dir.is_dir():
                    continue
                    
                style_name = style_dir.name
                style_output_dir = Path(self.training_data_dir) / f"{client_name}_{style_name}"
                os.makedirs(style_output_dir, exist_ok=True)
                
                # Process images in this style
                for image_path in style_dir.glob("*.{png,jpg,jpeg}"):
                    try:
                        # Load and preprocess image
                        image = Image.open(image_path).convert("RGB")
                        
                        # Resize to training resolution (512x512 for SDXL LoRA)
                        image = image.resize((512, 512), Image.Resampling.LANCZOS)
                        
                        # Save preprocessed image
                        output_path = style_output_dir / f"image_{image_count:04d}.png"
                        image.save(output_path)
                        
                        # Create caption/prompt for this image
                        caption = self.generate_training_caption(client_name, style_name, image_path.stem)
                        
                        # Save caption
                        caption_path = style_output_dir / f"image_{image_count:04d}.txt"
                        with open(caption_path, 'w') as f:
                            f.write(caption)
                        
                        metadata.append({
                            "image_path": str(output_path),
                            "caption": caption,
                            "client": client_name,
                            "style": style_name,
                            "original_path": str(image_path)
                        })
                        
                        image_count += 1
                        logger.info(f"  ✅ Processed {image_path.name} -> {output_path.name}")
                        
                    except Exception as e:
                        logger.error(f"  ❌ Failed to process {image_path}: {e}")
        
        # Save metadata
        metadata_path = Path(self.training_data_dir) / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"✅ Dataset prepared: {image_count} images processed")
        return metadata_path
    
    def generate_training_caption(self, client, style, image_name):
        """Generate descriptive caption for training"""
        
        style_descriptions = {
            "energy_fields": "glowing energy fields, particle effects, cosmic energy, vibrant auras",
            "dark_theme": "dark professional background, subtle geometric patterns, minimal lighting",
            "network_nodes": "connected network nodes, digital connections, tech visualization",
            "particle_waves": "flowing particle waves, dynamic motion, wave patterns",
            "corporate": "clean corporate design, professional gradients, business style"
        }
        
        client_descriptions = {
            "hedera": "purple and magenta color scheme, hedera branding",
            "algorand": "teal and cyan color scheme, algorand branding", 
            "constellation": "blue and white color scheme, constellation branding"
        }
        
        base_prompt = "crypto news cover background, professional design, high quality"
        style_desc = style_descriptions.get(style, "unique visual style")
        client_desc = client_descriptions.get(client, f"{client} color scheme")
        
        return f"{base_prompt}, {style_desc}, {client_desc}, 1800x900 resolution"
    
    def create_training_config(self, output_name="cover_styles"):
        """Create LoRA training configuration"""
        
        config = {
            "model_name_or_path": self.base_model,
            "instance_data_dir": self.training_data_dir,
            "output_dir": f"{self.output_dir}/{output_name}",
            "instance_prompt": "crypto news cover background",
            "resolution": 512,
            "train_batch_size": 2,
            "gradient_accumulation_steps": 1,
            "learning_rate": 1e-4,
            "lr_scheduler": "constant",
            "lr_warmup_steps": 0,
            "max_train_steps": 1000,
            "validation_prompt": "crypto news cover background, professional design",
            "validation_epochs": 50,
            "seed": 42,
            "rank": 16,  # LoRA rank - controls model size vs quality
            "mixed_precision": "fp16",
            "prior_generation_precision": "fp16",
            "sample_batch_size": 2,
            "gradient_checkpointing": True,
            "use_8bit_adam": True,
            "enable_xformers_memory_efficient_attention": True
        }
        
        config_path = f"configs/lora_training_{output_name}.json"
        os.makedirs("configs", exist_ok=True)
        
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"✅ Training config created: {config_path}")
        return config_path
    
    def generate_training_script(self, config_path):
        """Generate training script for the dataset"""
        
        script_content = f'''#!/bin/bash
# LoRA Training Script for Crypto Cover Styles
# Generated automatically by training pipeline

export MODEL_NAME="{self.base_model}"
export INSTANCE_DIR="{self.training_data_dir}"
export OUTPUT_DIR="{self.output_dir}/cover_styles"

accelerate launch train_dreambooth_lora_sdxl.py \\
  --pretrained_model_name_or_path=$MODEL_NAME \\
  --instance_data_dir=$INSTANCE_DIR \\
  --output_dir=$OUTPUT_DIR \\
  --mixed_precision="fp16" \\
  --instance_prompt="crypto news cover background" \\
  --resolution=512 \\
  --train_batch_size=2 \\
  --gradient_accumulation_steps=1 \\
  --learning_rate=1e-4 \\
  --lr_scheduler="constant" \\
  --lr_warmup_steps=0 \\
  --max_train_steps=1000 \\
  --validation_prompt="crypto news cover background, professional design, high quality" \\
  --validation_epochs=50 \\
  --seed=42 \\
  --rank=16 \\
  --gradient_checkpointing \\
  --use_8bit_adam \\
  --enable_xformers_memory_efficient_attention \\
  --report_to="wandb" \\
  --push_to_hub
'''
        
        script_path = "train_cover_styles.sh"
        with open(script_path, 'w') as f:
            f.write(script_content)
        
        os.chmod(script_path, 0o755)  # Make executable
        logger.info(f"✅ Training script created: {script_path}")
        return script_path

class TrainedLoRAIntegration:
    """Integration class for using trained cover style LoRA models"""
    
    def __init__(self):
        self.pipeline = None
        self.current_lora = None
        
    def load_pipeline(self, base_model="stabilityai/stable-diffusion-xl-base-1.0"):
        """Load the base SDXL pipeline"""
        logger.info(f"🚀 Loading SDXL pipeline: {base_model}")
        
        self.pipeline = StableDiffusionXLPipeline.from_pretrained(
            base_model,
            torch_dtype=torch.float16,
            variant="fp16",
            use_safetensors=True
        )
        
        if torch.cuda.is_available():
            self.pipeline.to("cuda")
        
        # Enable memory efficient attention
        self.pipeline.enable_xformers_memory_efficient_attention()
        
        logger.info("✅ Pipeline loaded successfully")
    
    def load_cover_style_lora(self, client, style):
        """Load specific LoRA model for client/style combination"""
        lora_path = f"models/lora/cover_styles/{client}_{style}_lora.safetensors"
        
        if not os.path.exists(lora_path):
            logger.warning(f"⚠️ LoRA not found: {lora_path}")
            return False
        
        try:
            # Unload previous LoRA if any
            if self.current_lora:
                self.pipeline.unload_lora_weights()
            
            # Load new LoRA
            self.pipeline.load_lora_weights(lora_path)
            self.current_lora = f"{client}_{style}"
            
            logger.info(f"✅ Loaded LoRA: {self.current_lora}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load LoRA {lora_path}: {e}")
            return False
    
    def generate_cover_background(self, client, style, title, width=1800, height=900):
        """Generate cover background using trained LoRA"""
        
        if not self.pipeline:
            raise ValueError("Pipeline not loaded. Call load_pipeline() first.")
        
        # Load appropriate LoRA
        lora_loaded = self.load_cover_style_lora(client, style)
        if not lora_loaded:
            logger.warning(f"Using base model without LoRA for {client}/{style}")
        
        # Create style-specific prompt
        prompts = {
            "energy_fields": f"{client} crypto news background, glowing energy fields, particle effects, vibrant {client} colors, professional design",
            "dark_theme": f"{client} crypto news background, dark professional theme, subtle geometric patterns, {client} branding colors",
            "network_nodes": f"{client} crypto news background, connected network nodes, digital visualization, {client} color scheme",
            "particle_waves": f"{client} crypto news background, flowing particle waves, dynamic motion, {client} brand colors"
        }
        
        prompt = prompts.get(style, f"{client} crypto news background, professional design")
        negative_prompt = "text, letters, words, watermark, signature, blurry, low quality, distorted"
        
        logger.info(f"🎨 Generating {client} {style} background with LoRA")
        
        try:
            # Generate image
            image = self.pipeline(
                prompt=prompt,
                negative_prompt=negative_prompt,
                height=512,  # Generate at 512x512 then upscale
                width=512,
                num_inference_steps=30,
                guidance_scale=7.5,
                generator=torch.Generator().manual_seed(42)
            ).images[0]
            
            # Upscale to target resolution
            image = image.resize((width, height), Image.Resampling.LANCZOS)
            
            logger.info(f"✅ Generated {width}x{height} background")
            return image
            
        except Exception as e:
            logger.error(f"❌ Generation failed: {e}")
            return None

# Usage example and training workflow
if __name__ == "__main__":
    trainer = CoverStyleLoRATrainer()
    
    print("🎯 LoRA Training Pipeline for Cover Styles")
    print("==========================================")
    print()
    print("📋 Training Steps:")
    print("1. Organize your original cover images in this structure:")
    print("   original_covers/")
    print("   ├── hedera/")
    print("   │   ├── energy_fields/")
    print("   │   └── dark_theme/")
    print("   ├── algorand/")
    print("   │   └── network_nodes/")
    print("   └── constellation/")
    print("       └── particle_waves/")
    print()
    print("2. Run dataset preparation:")
    print("   trainer.prepare_training_dataset('path/to/original_covers')")
    print()
    print("3. Create training configuration:")
    print("   trainer.create_training_config('cover_styles')")
    print()
    print("4. Generate and run training script:")
    print("   trainer.generate_training_script('config.json')")
    print("   ./train_cover_styles.sh")
    print()
    print("5. Integrate trained models:")
    print("   lora_gen = TrainedLoRAIntegration()")
    print("   lora_gen.load_pipeline()")
    print("   bg_image = lora_gen.generate_cover_background('hedera', 'energy_fields', 'Bitcoin News')")