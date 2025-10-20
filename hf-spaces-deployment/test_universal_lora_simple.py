#!/usr/bin/env python3
"""
Test Universal LoRA Model
Simple test for the trained Universal LoRA
"""
import os
from PIL import Image
import json

def test_trained_lora():
    """Test the trained Universal LoRA model"""
    model_dir = "models/lora/universal_minimal"
    
    print("🧪 Universal LoRA Model Test")
    print("============================")
    
    if not os.path.exists(model_dir):
        print(f"❌ Model directory not found: {model_dir}")
        print("💡 Train the model first using the training script")
        return
    
    # Check for model files
    model_files = list(Path(model_dir).glob("*.safetensors"))
    if model_files:
        print(f"✅ Found trained model: {model_files[0]}")
        
        # Load model info if available
        info_file = Path(model_dir) / "model_info.json"
        if info_file.exists():
            with open(info_file) as f:
                info = json.load(f)
            print(f"📊 Model info: {info}")
        
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
