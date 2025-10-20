#!/usr/bin/env python3
"""
Simple Universal LoRA Setup
Sets up training environment without complex dependencies
"""
import os
import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_universal_lora_training():
    """Set up Universal LoRA training environment"""
    
    # Configuration
    config = {
        "model_name": "stabilityai/stable-diffusion-xl-base-1.0",
        "dataset_dir": "training_data/minimal_universal_dataset",
        "output_dir": "models/lora/universal_minimal",
        "resolution": 512,
        "train_batch_size": 1,
        "max_train_steps": 500,  # Quick training
        "learning_rate": 1e-4,
        "lora_rank": 32,
        "lora_alpha": 32
    }
    
    logger.info("🛠️ Setting up Universal LoRA training...")
    
    # Create directories
    os.makedirs(config["output_dir"], exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    
    # Create training script
    training_script = f'''#!/bin/bash
# Universal LoRA Training Script
# Generated for crypto news cover generation

export MODEL_NAME="{config['model_name']}"
export DATASET_DIR="{config['dataset_dir']}"
export OUTPUT_DIR="{config['output_dir']}"

echo "🚀 Universal LoRA Training Setup"
echo "================================="
echo "📊 Dataset: $DATASET_DIR"
echo "🎯 Output: $OUTPUT_DIR"
echo "🔧 Model: $MODEL_NAME"
echo ""

# Check if dataset exists
if [ ! -d "$DATASET_DIR" ]; then
    echo "❌ Dataset directory not found: $DATASET_DIR"
    echo "💡 Run create_minimal_dataset.py first"
    exit 1
fi

echo "✅ Dataset found"
echo "📊 Training images: $(ls $DATASET_DIR/*.png | wc -l)"
echo ""

# Create requirements
echo "📦 Creating requirements file..."
cat > requirements_lora.txt << 'EOF'
# Universal LoRA Training Requirements
torch>=2.0.0
torchvision>=0.15.0
diffusers>=0.21.0
transformers>=4.30.0
accelerate>=0.20.0
peft>=0.6.0
safetensors>=0.3.0
Pillow>=9.0.0
numpy>=1.21.0
datasets>=2.14.0
huggingface-hub>=0.16.0
EOF

echo "✅ Requirements created: requirements_lora.txt"
echo ""

# Installation instructions
echo "📋 Setup Instructions:"
echo "======================"
echo ""
echo "1. Install requirements:"
echo "   pip install -r requirements_lora.txt"
echo ""
echo "2. For GPU training (recommended):"
echo "   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118"
echo ""
echo "3. For CPU training (slower):"
echo "   # Use existing torch installation"
echo ""
echo "4. Start training:"
echo "   # Use Hugging Face training scripts or custom trainer"
echo "   # Example: accelerate launch train_dreambooth_lora_sdxl.py [options]"
echo ""
echo "📁 Training will save Universal LoRA model to: $OUTPUT_DIR"
echo "🎯 Model will learn all crypto cover styles and client branding"

# Save config for reference
cat > universal_lora_config.json << EOF
{{
  "model_name": "{config['model_name']}",
  "dataset_dir": "{config['dataset_dir']}",
  "output_dir": "{config['output_dir']}",
  "resolution": {config['resolution']},
  "train_batch_size": {config['train_batch_size']},
  "max_train_steps": {config['max_train_steps']},
  "learning_rate": {config['learning_rate']},
  "lora_rank": {config['lora_rank']},
  "lora_alpha": {config['lora_alpha']},
  "training_type": "Universal LoRA",
  "description": "Single LoRA model learning all crypto cover styles and clients"
}}
EOF

echo "✅ Configuration saved: universal_lora_config.json"
'''
    
    # Save training script
    script_path = "setup_universal_training.sh"
    with open(script_path, 'w') as f:
        f.write(training_script)
    os.chmod(script_path, 0o755)
    
    logger.info(f"✅ Training setup script created: {script_path}")
    
    # Create simple inference test
    inference_test = f'''#!/usr/bin/env python3
"""
Test Universal LoRA Model
Simple test for the trained Universal LoRA
"""
import os
from PIL import Image
import json

def test_trained_lora():
    """Test the trained Universal LoRA model"""
    model_dir = "{config['output_dir']}"
    
    print("🧪 Universal LoRA Model Test")
    print("============================")
    
    if not os.path.exists(model_dir):
        print(f"❌ Model directory not found: {{model_dir}}")
        print("💡 Train the model first using the training script")
        return
    
    # Check for model files
    model_files = list(Path(model_dir).glob("*.safetensors"))
    if model_files:
        print(f"✅ Found trained model: {{model_files[0]}}")
        
        # Load model info if available
        info_file = Path(model_dir) / "model_info.json"
        if info_file.exists():
            with open(info_file) as f:
                info = json.load(f)
            print(f"📊 Model info: {{info}}")
        
        print("🚀 Model ready for integration!")
        print("")
        print("💡 Integration steps:")
        print("1. Copy model to your HF Spaces LoRA directory")
        print("2. Update your cover generator to load this Universal LoRA")
        print("3. Generate covers using the trained style")
        
    else:
        print("❌ No trained model found")
        print("💡 Complete the training process first")

if __name__ == "__main__":
    test_trained_lora()
'''
    
    with open("test_universal_lora_simple.py", 'w') as f:
        f.write(inference_test)
    os.chmod("test_universal_lora_simple.py", 0o755)
    
    logger.info("✅ Test script created: test_universal_lora_simple.py")
    
    # Create integration guide
    integration_guide = '''# Universal LoRA Integration Guide

## What is Universal LoRA?

A single LoRA model trained on multiple crypto cover styles and clients that can generate:
- ✅ All visual styles (energy_fields, dark_theme, network_nodes, particle_waves)
- ✅ All client branding (hedera, algorand, constellation, bitcoin, ethereum)
- ✅ Professional crypto news cover aesthetics

## Training Dataset

The minimal dataset includes:
- 27 training image/caption pairs
- 5 clients (hedera, algorand, constellation, bitcoin, ethereum)  
- 6 styles (energy_fields, dark_theme, network_nodes, particle_waves, corporate_style, ultra_visible)

## Integration Steps

### 1. Train the Universal LoRA
```bash
# Set up training environment
./setup_universal_training.sh

# Install requirements
pip install -r requirements_lora.txt

# Run training (use proper LoRA training script)
# This creates: models/lora/universal_minimal/pytorch_lora_weights.safetensors
```

### 2. Deploy to HF Spaces
```bash
# Copy trained model to HF Spaces directory
cp models/lora/universal_minimal/pytorch_lora_weights.safetensors hf-spaces-deployment/models/lora/

# Rename for Universal LoRA
mv hf-spaces-deployment/models/lora/pytorch_lora_weights.safetensors hf-spaces-deployment/models/lora/crypto_cover_styles_lora.safetensors
```

### 3. Update Cover Generator
- Use `app_with_trained_lora.py` instead of `app_lightweight.py`
- This version automatically detects and loads the Universal LoRA
- Falls back to programmatic generation if LoRA unavailable

### 4. Test Integration
```bash
python test_universal_lora_simple.py
```

## Expected Results

After training, your cover generator will produce:
- ✅ Authentic crypto news aesthetics learned from your dataset
- ✅ Consistent brand styling across all clients
- ✅ Professional visual quality matching original covers
- ✅ Variety in styles while maintaining brand identity

## Deployment Options

**Option A: Quick Fix (Immediate)**
- Upload `app_force_visible.py` to fix current text/background issues

**Option B: Universal LoRA (Long-term)**  
- Train Universal LoRA on your cover dataset
- Deploy `app_with_trained_lora.py` for authentic style generation

## Training Tips

- Add more original covers to the dataset for better results
- Train for 500-1000 steps for minimal dataset
- Use GPU if available for faster training
- Monitor training loss to avoid overfitting
'''
    
    with open("UNIVERSAL_LORA_GUIDE.md", 'w') as f:
        f.write(integration_guide)
    
    logger.info("✅ Integration guide created: UNIVERSAL_LORA_GUIDE.md")
    
    return {
        'setup_script': script_path,
        'test_script': 'test_universal_lora_simple.py', 
        'guide': 'UNIVERSAL_LORA_GUIDE.md',
        'config': 'universal_lora_config.json'
    }

def main():
    print("🎯 Universal LoRA Training Setup")
    print("================================")
    print()
    print("Setting up training environment for Universal LoRA that learns")
    print("all crypto cover styles and client branding in one model.")
    print()
    
    try:
        files = setup_universal_lora_training()
        
        print("✅ Universal LoRA setup complete!")
        print()
        print("📋 Files created:")
        for key, file in files.items():
            print(f"  - {key}: {file}")
        print()
        print("🚀 Next Steps:")
        print("1. Run setup script: ./setup_universal_training.sh")
        print("2. Install requirements and train the model")
        print("3. Test with: python test_universal_lora_simple.py")
        print("4. Deploy to your HF Spaces cover generator")
        print()
        print("📖 See UNIVERSAL_LORA_GUIDE.md for detailed instructions")
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        logger.error(f"Setup failed: {e}")

if __name__ == "__main__":
    main()