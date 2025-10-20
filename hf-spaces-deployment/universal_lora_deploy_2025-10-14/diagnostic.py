#!/usr/bin/env python3
"""
Diagnostic script to check HF Spaces environment
"""
import sys
import os

print("🔍 HF Spaces Diagnostic Report")
print("=" * 50)

print(f"🐍 Python: {sys.version}")
print(f"🖥️ Platform: {sys.platform}")
print(f"📁 Working directory: {os.getcwd()}")
print(f"📂 Files in directory: {os.listdir('.')}")

# Check PyTorch
try:
    import torch
    print(f"🔥 PyTorch: {torch.__version__}")
    print(f"⚡ CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"🎮 GPU count: {torch.cuda.device_count()}")
        print(f"🎯 GPU name: {torch.cuda.get_device_name(0)}")
        print(f"💾 GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")
except Exception as e:
    print(f"❌ PyTorch error: {e}")

# Check Diffusers
try:
    import diffusers
    print(f"🌀 Diffusers: {diffusers.__version__}")
except Exception as e:
    print(f"❌ Diffusers error: {e}")

# Check app type
if os.path.exists("app.py"):
    with open("app.py", "r") as f:
        content = f.read()
        if "lightweight" in content.lower():
            print("⚠️ WARNING: Running LIGHTWEIGHT version!")
        elif "StableDiffusionXLPipeline" in content:
            print("✅ Running REAL SDXL version")
        else:
            print("❓ Unknown app version")

print("=" * 50)