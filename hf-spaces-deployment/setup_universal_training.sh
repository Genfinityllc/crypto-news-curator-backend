#!/bin/bash
# Universal LoRA Training Script
# Generated for crypto news cover generation

export MODEL_NAME="stabilityai/stable-diffusion-xl-base-1.0"
export DATASET_DIR="training_data/minimal_universal_dataset"
export OUTPUT_DIR="models/lora/universal_minimal"

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
{
  "model_name": "stabilityai/stable-diffusion-xl-base-1.0",
  "dataset_dir": "training_data/minimal_universal_dataset",
  "output_dir": "models/lora/universal_minimal",
  "resolution": 512,
  "train_batch_size": 1,
  "max_train_steps": 500,
  "learning_rate": 0.0001,
  "lora_rank": 32,
  "lora_alpha": 32,
  "training_type": "Universal LoRA",
  "description": "Single LoRA model learning all crypto cover styles and clients"
}
EOF

echo "✅ Configuration saved: universal_lora_config.json"
