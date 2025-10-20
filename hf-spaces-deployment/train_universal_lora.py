#!/usr/bin/env python3
"""
Universal LoRA Training Script
Trains a single LoRA model on all cover styles and clients
"""
import os
import json
import argparse
from pathlib import Path
import logging
import torch
from accelerate import Accelerator
from accelerate.logging import get_logger
from accelerate.utils import ProjectConfiguration, set_seed
from diffusers import AutoencoderKL, DDPMScheduler, StableDiffusionXLPipeline, UNet2DConditionModel
from diffusers.optimization import get_scheduler
from peft import LoraConfig, get_peft_model, TaskType
from transformers import CLIPTextModel, CLIPTokenizer
import shutil

logger = get_logger(__name__, log_level="INFO")

class UniversalLoRATrainer:
    def __init__(self, config_path: str = None):
        self.config = self.load_config(config_path)
        self.accelerator = None
        
    def load_config(self, config_path: str = None):
        """Load training configuration"""
        default_config = {
            "model_name": "stabilityai/stable-diffusion-xl-base-1.0",
            "dataset_dir": "training_data/universal_lora_dataset",
            "output_dir": "models/lora/universal",
            "resolution": 512,
            "train_batch_size": 1,
            "num_train_epochs": 10,
            "max_train_steps": 1000,
            "learning_rate": 1e-4,
            "lr_scheduler": "cosine",
            "lr_warmup_steps": 100,
            "seed": 42,
            "mixed_precision": "fp16",
            "gradient_checkpointing": True,
            "use_8bit_adam": True,
            "lora_rank": 32,
            "lora_alpha": 32,
            "validation_prompt": "crypto news cover background, professional design, high quality",
            "validation_epochs": 2,
            "save_every": 250,
            "hub_model_id": "crypto-cover-universal-lora"
        }
        
        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                loaded_config = json.load(f)
                default_config.update(loaded_config)
        
        return default_config
    
    def prepare_dataset(self):
        """Prepare dataset for training"""
        dataset_dir = Path(self.config["dataset_dir"])
        
        if not dataset_dir.exists():
            raise ValueError(f"Dataset directory not found: {dataset_dir}")
        
        # Load training manifest
        manifest_path = dataset_dir / "training_manifest.json"
        if manifest_path.exists():
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)
            
            logger.info(f"📚 Dataset loaded: {manifest['dataset_info']['total_images']} images")
            logger.info(f"🏢 Clients: {', '.join(manifest['dataset_info']['clients'])}")
            logger.info(f"🎨 Styles: {', '.join(manifest['dataset_info']['styles'])}")
            
            return manifest['images']
        else:
            # Fallback: scan directory for image/caption pairs
            logger.warning("No manifest found, scanning directory...")
            training_pairs = []
            
            for img_file in dataset_dir.glob("*.png"):
                caption_file = img_file.with_suffix('.txt')
                if caption_file.exists():
                    training_pairs.append({
                        'image': str(img_file),
                        'caption': str(caption_file)
                    })
            
            logger.info(f"📚 Found {len(training_pairs)} training pairs")
            return training_pairs
    
    def create_training_script(self):
        """Create optimized training script for Universal LoRA"""
        
        # Get dataset info
        try:
            training_data = self.prepare_dataset()
            total_images = len(training_data)
        except Exception as e:
            logger.error(f"Dataset preparation failed: {e}")
            total_images = 0
        
        # Calculate optimal training steps
        steps_per_epoch = max(1, total_images // self.config["train_batch_size"])
        total_steps = min(self.config["max_train_steps"], 
                         steps_per_epoch * self.config["num_train_epochs"])
        
        script_content = f'''#!/bin/bash
# Universal LoRA Training Script for Crypto Cover Styles
# Auto-generated for {total_images} training images

export MODEL_NAME="{self.config['model_name']}"
export DATASET_DIR="{self.config['dataset_dir']}"
export OUTPUT_DIR="{self.config['output_dir']}"

echo "🚀 Starting Universal LoRA Training..."
echo "📊 Training Images: {total_images}"
echo "🎯 Max Steps: {total_steps}"
echo "📁 Output: $OUTPUT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Run training with optimized settings
accelerate launch --mixed_precision="{self.config['mixed_precision']}" train_dreambooth_lora_sdxl.py \\
  --pretrained_model_name_or_path="$MODEL_NAME" \\
  --instance_data_dir="$DATASET_DIR" \\
  --output_dir="$OUTPUT_DIR" \\
  --mixed_precision="{self.config['mixed_precision']}" \\
  --instance_prompt="crypto news cover background" \\
  --resolution={self.config['resolution']} \\
  --train_batch_size={self.config['train_batch_size']} \\
  --gradient_accumulation_steps=1 \\
  --learning_rate={self.config['learning_rate']} \\
  --lr_scheduler="{self.config['lr_scheduler']}" \\
  --lr_warmup_steps={self.config['lr_warmup_steps']} \\
  --num_train_epochs={self.config['num_train_epochs']} \\
  --max_train_steps={total_steps} \\
  --validation_prompt="{self.config['validation_prompt']}" \\
  --validation_epochs={self.config['validation_epochs']} \\
  --seed={self.config['seed']} \\
  --rank={self.config['lora_rank']} \\
  --lora_alpha={self.config['lora_alpha']} \\
  --gradient_checkpointing \\
  --use_8bit_adam \\
  --enable_xformers_memory_efficient_attention \\
  --checkpointing_steps={self.config['save_every']} \\
  --resume_from_checkpoint=latest \\
  --report_to="tensorboard" \\
  --push_to_hub \\
  --hub_model_id="{self.config['hub_model_id']}"

echo "✅ Universal LoRA Training Complete!"
echo "📁 Model saved to: $OUTPUT_DIR"
echo "🔗 Hub model: {self.config['hub_model_id']}"
'''
        
        # Save training script
        script_path = "train_universal_lora.sh"
        with open(script_path, 'w') as f:
            f.write(script_content)
        
        os.chmod(script_path, 0o755)  # Make executable
        
        logger.info(f"✅ Training script created: {script_path}")
        logger.info(f"📊 Configured for {total_images} training images")
        logger.info(f"🎯 Will train for {total_steps} steps")
        
        return script_path
    
    def create_requirements_file(self):
        """Create requirements.txt for LoRA training environment"""
        requirements = '''# Universal LoRA Training Requirements
torch>=2.0.0
torchvision>=0.15.0
accelerate>=0.20.0
transformers>=4.30.0
diffusers>=0.18.0
peft>=0.4.0
safetensors>=0.3.0
Pillow>=9.0.0
numpy>=1.21.0
tensorboard>=2.13.0
xformers>=0.0.20  # For memory efficiency
bitsandbytes>=0.39.0  # For 8-bit Adam optimizer
'''
        
        with open("requirements_lora_training.txt", 'w') as f:
            f.write(requirements)
        
        logger.info("✅ Created requirements_lora_training.txt")
        return "requirements_lora_training.txt"
    
    def create_inference_script(self):
        """Create script to test the trained Universal LoRA"""
        
        inference_script = f'''#!/usr/bin/env python3
"""
Test Universal LoRA Model
Generate samples using the trained model
"""
import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import random

def test_universal_lora():
    print("🚀 Loading Universal LoRA model...")
    
    # Load base pipeline
    pipeline = StableDiffusionXLPipeline.from_pretrained(
        "{self.config['model_name']}",
        torch_dtype=torch.float16,
        variant="fp16",
        use_safetensors=True
    )
    
    if torch.cuda.is_available():
        pipeline.to("cuda")
    
    # Load Universal LoRA weights
    lora_path = "{self.config['output_dir']}/pytorch_lora_weights.safetensors"
    pipeline.load_lora_weights(lora_path)
    
    print("✅ Pipeline loaded with Universal LoRA")
    
    # Test prompts for different styles/clients
    test_prompts = [
        "crypto news cover background, hedera energy fields, purple glowing effects, professional design",
        "crypto news cover background, algorand network nodes, teal connections, tech visualization", 
        "crypto news cover background, dark theme, subtle geometric patterns, corporate style",
        "crypto news cover background, particle waves, dynamic motion, cryptocurrency branding",
        "crypto news cover background, bitcoin orange theme, professional gradients, high quality"
    ]
    
    for i, prompt in enumerate(test_prompts):
        print(f"🎨 Generating sample {{i+1}}/{{len(test_prompts)}}...")
        print(f"💭 Prompt: {{prompt}}")
        
        image = pipeline(
            prompt=prompt,
            negative_prompt="text, letters, words, low quality, blurry",
            height=512,
            width=1024,  # 2:1 aspect ratio
            num_inference_steps=30,
            guidance_scale=7.5,
            generator=torch.Generator().manual_seed(42)
        ).images[0]
        
        # Upscale to final size
        image = image.resize((1800, 900), Image.Resampling.LANCZOS)
        image.save(f"universal_lora_test_{{i+1:02d}}.png")
        print(f"💾 Saved: universal_lora_test_{{i+1:02d}}.png")
    
    print("✅ Universal LoRA testing complete!")
    print("📁 Check generated test images")

if __name__ == "__main__":
    test_universal_lora()
'''
        
        with open("test_universal_lora.py", 'w') as f:
            f.write(inference_script)
        
        os.chmod("test_universal_lora.py", 0o755)
        logger.info("✅ Created test_universal_lora.py")
        return "test_universal_lora.py"
    
    def setup_training_environment(self):
        """Set up complete training environment"""
        logger.info("🛠️ Setting up Universal LoRA training environment...")
        
        # Create necessary directories
        os.makedirs(self.config["output_dir"], exist_ok=True)
        os.makedirs("logs", exist_ok=True)
        
        # Create training files
        script_path = self.create_training_script()
        requirements_path = self.create_requirements_file()
        inference_path = self.create_inference_script()
        
        # Save config
        config_path = "universal_lora_config.json"
        with open(config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
        
        logger.info("✅ Training environment setup complete!")
        logger.info("📋 Files created:")
        logger.info(f"  - Training script: {script_path}")
        logger.info(f"  - Requirements: {requirements_path}")
        logger.info(f"  - Test script: {inference_path}")
        logger.info(f"  - Config: {config_path}")
        
        return {
            'training_script': script_path,
            'requirements': requirements_path,
            'inference_script': inference_path,
            'config': config_path
        }

def main():
    """Main training setup function"""
    parser = argparse.ArgumentParser(description="Universal LoRA Training Setup")
    parser.add_argument("--config", type=str, help="Path to config JSON file")
    parser.add_argument("--dataset-dir", type=str, help="Path to training dataset")
    parser.add_argument("--output-dir", type=str, help="Output directory for trained model")
    
    args = parser.parse_args()
    
    # Initialize trainer
    trainer = UniversalLoRATrainer(args.config)
    
    # Override config with command line args
    if args.dataset_dir:
        trainer.config["dataset_dir"] = args.dataset_dir
    if args.output_dir:
        trainer.config["output_dir"] = args.output_dir
    
    # Setup training environment
    files = trainer.setup_training_environment()
    
    print("🎯 Universal LoRA Training Setup Complete!")
    print("=" * 50)
    print()
    print("📋 Next Steps:")
    print("1. Install requirements:")
    print(f"   pip install -r {files['requirements']}")
    print()
    print("2. Run training:")
    print(f"   ./{files['training_script']}")
    print()
    print("3. Test trained model:")
    print(f"   python {files['inference_script']}")
    print()
    print("📊 Training will create a Universal LoRA that learns:")
    print("   ✅ All client styles (hedera, algorand, constellation, etc.)")
    print("   ✅ All visual styles (energy_fields, dark_theme, network_nodes, etc.)")
    print("   ✅ Professional crypto news cover aesthetics")
    print()
    print("🚀 The trained model will work with your existing cover generator!")

if __name__ == "__main__":
    main()