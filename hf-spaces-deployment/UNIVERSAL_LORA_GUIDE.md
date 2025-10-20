# Universal LoRA Integration Guide

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
