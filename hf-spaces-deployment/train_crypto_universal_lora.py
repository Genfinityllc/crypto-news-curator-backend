#!/usr/bin/env python3
"""
Universal LoRA Training Script for Crypto News Covers
Trains a single LoRA model that learns all crypto cover styles and clients
"""
import os
import json
import torch
import argparse
from pathlib import Path
from PIL import Image
import logging
from typing import Dict, List
from datasets import Dataset
from accelerate import Accelerator
from accelerate.logging import get_logger
from accelerate.utils import set_seed
from transformers import CLIPTextModel, CLIPTokenizer
from diffusers import (
    AutoencoderKL,
    DDPMScheduler, 
    StableDiffusionXLPipeline,
    UNet2DConditionModel
)
from diffusers.optimization import get_scheduler
from diffusers.training_utils import compute_snr
from peft import LoraConfig, get_peft_model, TaskType
from transformers import CLIPTextModelWithProjection
from diffusers.loaders import AttnProcsLayers
from diffusers.utils import convert_state_dict_to_diffusers
import random
from tqdm.auto import tqdm

logger = get_logger(__name__)

class UniversalLoRATrainer:
    def __init__(self, args):
        self.args = args
        self.accelerator = Accelerator(
            gradient_accumulation_steps=args.gradient_accumulation_steps,
            mixed_precision=args.mixed_precision,
            log_with="tensorboard",
            project_dir=args.logging_dir,
        )
        
        # Set seed for reproducibility
        if args.seed is not None:
            set_seed(args.seed)
    
    def load_dataset(self):
        """Load the crypto cover dataset"""
        logger.info(f"📚 Loading dataset from {self.args.dataset_dir}")
        
        # Load manifest
        manifest_path = Path(self.args.dataset_dir) / "training_manifest.json"
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        # Prepare dataset entries
        dataset_entries = []
        for item in manifest['images']:
            # Load image
            image_path = item['image']
            if not os.path.isabs(image_path):
                image_path = Path(self.args.dataset_dir) / Path(image_path).name
            
            # Load caption
            caption_path = item['caption']
            if not os.path.isabs(caption_path):
                caption_path = Path(self.args.dataset_dir) / Path(caption_path).name
            
            if os.path.exists(image_path) and os.path.exists(caption_path):
                with open(caption_path, 'r') as f:
                    caption = f.read().strip()
                
                dataset_entries.append({
                    'image_path': str(image_path),
                    'caption': caption,
                    'client': item.get('client', 'generic'),
                    'style': item.get('style', 'default')
                })
        
        logger.info(f"✅ Loaded {len(dataset_entries)} training samples")
        return Dataset.from_list(dataset_entries)
    
    def preprocess_images(self, examples):
        """Preprocess images and captions for training"""
        images = []
        captions = []
        
        for image_path, caption in zip(examples['image_path'], examples['caption']):
            # Load and preprocess image
            image = Image.open(image_path).convert('RGB')
            image = image.resize((self.args.resolution, self.args.resolution), Image.Resampling.LANCZOS)
            images.append(image)
            captions.append(caption)
        
        # Convert to tensors
        pixel_values = torch.stack([torch.tensor(
            (torch.from_numpy(torch.tensor(image).numpy()) / 127.5) - 1.0
        ).permute(2, 0, 1) for image in images])
        
        return {
            'pixel_values': pixel_values,
            'input_ids': captions
        }
    
    def encode_prompt(self, prompt, text_encoder, tokenizer, device):
        """Encode text prompt to embeddings"""
        text_inputs = tokenizer(
            prompt,
            padding="max_length",
            max_length=tokenizer.model_max_length,
            truncation=True,
            return_tensors="pt",
        )
        
        text_input_ids = text_inputs.input_ids
        if hasattr(text_encoder.config, "use_attention_mask") and text_encoder.config.use_attention_mask:
            attention_mask = text_inputs.attention_mask.to(device)
        else:
            attention_mask = None

        prompt_embeds = text_encoder(
            text_input_ids.to(device),
            attention_mask=attention_mask,
        )
        prompt_embeds = prompt_embeds[0]
        
        return prompt_embeds
    
    def setup_models(self):
        """Initialize models for training"""
        logger.info(f"🚀 Loading models: {self.args.pretrained_model_name_or_path}")
        
        # Load tokenizer and text encoder
        tokenizer = CLIPTokenizer.from_pretrained(
            self.args.pretrained_model_name_or_path,
            subfolder="tokenizer",
            revision=self.args.revision,
        )
        
        text_encoder = CLIPTextModel.from_pretrained(
            self.args.pretrained_model_name_or_path,
            subfolder="text_encoder",
            revision=self.args.revision,
        )
        
        # Load VAE
        vae = AutoencoderKL.from_pretrained(
            self.args.pretrained_model_name_or_path,
            subfolder="vae",
            revision=self.args.revision,
        )
        
        # Load UNet
        unet = UNet2DConditionModel.from_pretrained(
            self.args.pretrained_model_name_or_path,
            subfolder="unet",
            revision=self.args.revision,
        )
        
        # Freeze base models
        vae.requires_grad_(False)
        text_encoder.requires_grad_(False)
        unet.requires_grad_(False)
        
        # Set up LoRA for UNet
        unet_lora_config = LoraConfig(
            r=self.args.rank,
            lora_alpha=self.args.rank,
            init_lora_weights="gaussian",
            target_modules=["to_k", "to_q", "to_v", "to_out.0"],
        )
        
        # Add LoRA adapters
        unet.add_adapter(unet_lora_config)
        
        # Enable training mode for LoRA layers only
        unet.train()
        for param in unet.parameters():
            param.requires_grad = False
        for param in unet.get_adapter().parameters():
            param.requires_grad = True
        
        # Set up noise scheduler
        noise_scheduler = DDPMScheduler.from_pretrained(
            self.args.pretrained_model_name_or_path,
            subfolder="scheduler"
        )
        
        return tokenizer, text_encoder, vae, unet, noise_scheduler
    
    def train(self):
        """Main training loop"""
        logger.info("🎯 Starting Universal LoRA training for crypto covers")
        
        # Load dataset
        train_dataset = self.load_dataset()
        
        # Setup models
        tokenizer, text_encoder, vae, unet, noise_scheduler = self.setup_models()
        
        # Prepare optimizer
        optimizer = torch.optim.AdamW(
            unet.get_adapter().parameters(),
            lr=self.args.learning_rate,
            betas=(self.args.adam_beta1, self.args.adam_beta2),
            weight_decay=self.args.adam_weight_decay,
            eps=self.args.adam_epsilon,
        )
        
        # Calculate training steps
        num_update_steps_per_epoch = len(train_dataset) // self.args.gradient_accumulation_steps
        max_train_steps = self.args.num_train_epochs * num_update_steps_per_epoch
        
        # Prepare scheduler
        lr_scheduler = get_scheduler(
            self.args.lr_scheduler,
            optimizer=optimizer,
            num_warmup_steps=self.args.lr_warmup_steps * self.accelerator.num_processes,
            num_training_steps=max_train_steps * self.accelerator.num_processes,
        )
        
        # Prepare for training
        unet, optimizer, lr_scheduler = self.accelerator.prepare(unet, optimizer, lr_scheduler)
        
        # Move models to device
        vae.to(self.accelerator.device, dtype=torch.float32)
        text_encoder.to(self.accelerator.device)
        
        logger.info("🚀 Training starting...")
        logger.info(f"📊 Dataset size: {len(train_dataset)}")
        logger.info(f"🎯 Training steps: {max_train_steps}")
        logger.info(f"📱 Device: {self.accelerator.device}")
        
        global_step = 0
        progress_bar = tqdm(range(max_train_steps), disable=not self.accelerator.is_local_main_process)
        progress_bar.set_description("Universal LoRA Training")
        
        # Training loop
        for epoch in range(self.args.num_train_epochs):
            unet.train()
            
            for step, batch in enumerate(train_dataset):
                with self.accelerator.accumulate(unet):
                    # Process batch
                    images = []
                    captions = []
                    
                    # Handle single sample
                    if isinstance(batch['image_path'], str):
                        batch = {k: [v] for k, v in batch.items()}
                    
                    for img_path, caption in zip(batch['image_path'], batch['caption']):
                        image = Image.open(img_path).convert('RGB')
                        image = image.resize((self.args.resolution, self.args.resolution), Image.Resampling.LANCZOS)
                        images.append(image)
                        captions.append(caption)
                    
                    # Convert images to tensors
                    pixel_values = torch.stack([
                        (torch.from_numpy(torch.tensor(img).numpy().transpose(2, 0, 1)) / 127.5) - 1.0 
                        for img in images
                    ]).to(self.accelerator.device, dtype=torch.float32)
                    
                    # Encode images
                    latents = vae.encode(pixel_values).latent_dist.sample()
                    latents = latents * vae.config.scaling_factor
                    
                    # Sample noise
                    noise = torch.randn_like(latents)
                    bsz = latents.shape[0]
                    
                    # Sample timesteps
                    timesteps = torch.randint(
                        0, noise_scheduler.config.num_train_timesteps, (bsz,), device=latents.device
                    )
                    timesteps = timesteps.long()
                    
                    # Add noise to latents
                    noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)
                    
                    # Encode captions
                    encoder_hidden_states = []
                    for caption in captions:
                        prompt_embeds = self.encode_prompt(caption, text_encoder, tokenizer, self.accelerator.device)
                        encoder_hidden_states.append(prompt_embeds)
                    
                    encoder_hidden_states = torch.cat(encoder_hidden_states, dim=0)
                    
                    # Predict noise
                    model_pred = unet(noisy_latents, timesteps, encoder_hidden_states).sample
                    
                    # Calculate loss
                    target = noise
                    loss = torch.nn.functional.mse_loss(model_pred.float(), target.float(), reduction="mean")
                    
                    # Backpropagate
                    self.accelerator.backward(loss)
                    optimizer.step()
                    lr_scheduler.step()
                    optimizer.zero_grad()
                
                # Update progress
                if self.accelerator.sync_gradients:
                    progress_bar.update(1)
                    global_step += 1
                    
                    # Log metrics
                    if global_step % self.args.logging_steps == 0:
                        logs = {
                            "loss": loss.detach().item(),
                            "lr": lr_scheduler.get_last_lr()[0],
                            "epoch": epoch,
                            "step": global_step
                        }
                        progress_bar.set_postfix(**logs)
                        self.accelerator.log(logs, step=global_step)
                    
                    # Save checkpoint
                    if global_step % self.args.save_steps == 0:
                        self.save_model(unet, global_step)
                
                if global_step >= max_train_steps:
                    break
            
            if global_step >= max_train_steps:
                break
        
        # Final save
        self.save_model(unet, global_step, final=True)
        logger.info("✅ Universal LoRA training complete!")
    
    def save_model(self, unet, step, final=False):
        """Save the trained LoRA model"""
        save_path = Path(self.args.output_dir)
        save_path.mkdir(parents=True, exist_ok=True)
        
        if final:
            model_path = save_path / "crypto_cover_universal_lora.safetensors"
            logger.info(f"💾 Saving final Universal LoRA model: {model_path}")
        else:
            model_path = save_path / f"checkpoint-{step}"
            model_path.mkdir(exist_ok=True)
            model_path = model_path / "pytorch_lora_weights.safetensors"
            logger.info(f"💾 Saving checkpoint: {model_path}")
        
        # Extract LoRA weights
        unet = self.accelerator.unwrap_model(unet)
        unet_lora_state_dict = convert_state_dict_to_diffusers(unet.get_adapter().state_dict())
        
        # Save with safetensors
        from safetensors.torch import save_file
        save_file(unet_lora_state_dict, model_path)
        
        # Save model info
        model_info = {
            "model_type": "Universal LoRA",
            "training_step": step,
            "description": "Universal LoRA for crypto news covers - all styles and clients",
            "styles": ["energy_fields", "dark_theme", "network_nodes", "particle_waves", "corporate_style"],
            "clients": ["hedera", "algorand", "constellation", "bitcoin", "ethereum"],
            "base_model": self.args.pretrained_model_name_or_path,
            "resolution": self.args.resolution,
            "rank": self.args.rank
        }
        
        info_path = save_path / "model_info.json"
        with open(info_path, 'w') as f:
            json.dump(model_info, f, indent=2)

def parse_args():
    parser = argparse.ArgumentParser(description="Train Universal LoRA for crypto covers")
    
    # Model arguments
    parser.add_argument(
        "--pretrained_model_name_or_path",
        type=str,
        default="stabilityai/stable-diffusion-xl-base-1.0",
        help="Path to pretrained model"
    )
    parser.add_argument("--revision", type=str, default=None, help="Model revision")
    
    # Dataset arguments
    parser.add_argument(
        "--dataset_dir",
        type=str,
        default="training_data/minimal_universal_dataset",
        help="Path to training dataset"
    )
    
    # Training arguments
    parser.add_argument("--output_dir", type=str, default="models/lora/universal", help="Output directory")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--resolution", type=int, default=512, help="Training resolution")
    parser.add_argument("--num_train_epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--gradient_accumulation_steps", type=int, default=1, help="Gradient accumulation")
    parser.add_argument("--learning_rate", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--lr_scheduler", type=str, default="constant", help="LR scheduler")
    parser.add_argument("--lr_warmup_steps", type=int, default=0, help="LR warmup steps")
    parser.add_argument("--rank", type=int, default=32, help="LoRA rank")
    
    # Optimizer arguments
    parser.add_argument("--adam_beta1", type=float, default=0.9, help="Adam beta1")
    parser.add_argument("--adam_beta2", type=float, default=0.999, help="Adam beta2")
    parser.add_argument("--adam_weight_decay", type=float, default=1e-2, help="Adam weight decay")
    parser.add_argument("--adam_epsilon", type=float, default=1e-08, help="Adam epsilon")
    
    # Logging and saving
    parser.add_argument("--logging_dir", type=str, default="logs", help="Logging directory")
    parser.add_argument("--logging_steps", type=int, default=10, help="Log every N steps")
    parser.add_argument("--save_steps", type=int, default=100, help="Save every N steps")
    parser.add_argument("--mixed_precision", type=str, default="fp16", choices=["no", "fp16", "bf16"])
    
    return parser.parse_args()

def main():
    args = parse_args()
    
    print("🎯 Universal LoRA Training for Crypto News Covers")
    print("=" * 50)
    print(f"📊 Dataset: {args.dataset_dir}")
    print(f"🎯 Output: {args.output_dir}")
    print(f"🔧 Base model: {args.pretrained_model_name_or_path}")
    print(f"📐 Resolution: {args.resolution}")
    print(f"🏃 Epochs: {args.num_train_epochs}")
    print(f"📈 Learning rate: {args.learning_rate}")
    print(f"🎲 Rank: {args.rank}")
    print()
    
    # Create trainer and start training
    trainer = UniversalLoRATrainer(args)
    trainer.train()
    
    print("✅ Universal LoRA training completed!")
    print(f"📁 Model saved to: {args.output_dir}")
    print("🚀 Ready for deployment to HF Spaces!")

if __name__ == "__main__":
    main()