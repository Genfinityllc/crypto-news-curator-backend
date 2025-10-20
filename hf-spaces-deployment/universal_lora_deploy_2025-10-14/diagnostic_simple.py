#!/usr/bin/env python3
"""
Simple diagnostic script to test SD 1.5 + LoRA compatibility
Run this BEFORE the main app to identify issues
"""
import os
import sys
import traceback

# Fix HuggingFace Spaces cache permissions
os.environ['HF_HOME'] = '/tmp/huggingface'
os.environ['TRANSFORMERS_CACHE'] = '/tmp/huggingface/transformers'
os.environ['HF_DATASETS_CACHE'] = '/tmp/huggingface/datasets'

def test_basic_imports():
    """Test basic library imports"""
    print("🔍 Testing basic imports...")
    try:
        import torch
        print(f"✅ PyTorch: {torch.__version__}")
        print(f"✅ CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"✅ GPU: {torch.cuda.get_device_name(0)}")
    except Exception as e:
        print(f"❌ PyTorch import failed: {e}")
        return False
    
    try:
        import diffusers
        print(f"✅ Diffusers: {diffusers.__version__}")
    except Exception as e:
        print(f"❌ Diffusers import failed: {e}")
        return False
    
    return True

def test_sd15_loading():
    """Test SD 1.5 model loading"""
    print("\n🔍 Testing SD 1.5 model loading...")
    try:
        from diffusers import StableDiffusionPipeline
        import torch
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        
        print(f"Loading SD 1.5 on {device} with {dtype}...")
        pipeline = StableDiffusionPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            torch_dtype=dtype,
            safety_checker=None,
            requires_safety_checker=False,
            low_cpu_mem_usage=True
        )
        
        if torch.cuda.is_available():
            pipeline = pipeline.to("cuda")
        
        print("✅ SD 1.5 model loaded successfully")
        return pipeline
        
    except Exception as e:
        print(f"❌ SD 1.5 loading failed: {e}")
        print(f"📍 Full error: {traceback.format_exc()}")
        return None

def test_lora_loading(pipeline):
    """Test LoRA loading with SD 1.5"""
    print("\n🔍 Testing LoRA loading...")
    try:
        lora_path = "models/lora/crypto_cover_styles_lora.safetensors"
        
        if not os.path.exists(lora_path):
            print(f"❌ LoRA file not found: {lora_path}")
            return False
        
        print(f"Loading LoRA from: {lora_path}")
        pipeline.load_lora_weights(lora_path)
        print("✅ LoRA loaded successfully")
        return True
        
    except Exception as e:
        print(f"❌ LoRA loading failed: {e}")
        print(f"📍 Full error: {traceback.format_exc()}")
        return False

def test_generation(pipeline):
    """Test minimal generation"""
    print("\n🔍 Testing minimal generation...")
    try:
        import torch
        
        result = pipeline(
            "crypto background test",
            height=512,
            width=512,
            num_inference_steps=1,
            guidance_scale=1.0,
            generator=torch.Generator().manual_seed(42)
        )
        
        print("✅ Generation test successful")
        return True
        
    except Exception as e:
        print(f"❌ Generation failed: {e}")
        print(f"📍 Full error: {traceback.format_exc()}")
        return False

def main():
    print("🚀 SD 1.5 + LoRA Diagnostic Test")
    print("=" * 50)
    
    # Test 1: Basic imports
    if not test_basic_imports():
        print("\n❌ DIAGNOSTIC FAILED: Basic imports")
        sys.exit(1)
    
    # Test 2: SD 1.5 loading
    pipeline = test_sd15_loading()
    if pipeline is None:
        print("\n❌ DIAGNOSTIC FAILED: SD 1.5 loading")
        sys.exit(1)
    
    # Test 3: LoRA loading
    if not test_lora_loading(pipeline):
        print("\n❌ DIAGNOSTIC FAILED: LoRA loading")
        sys.exit(1)
    
    # Test 4: Generation
    if not test_generation(pipeline):
        print("\n❌ DIAGNOSTIC FAILED: Generation")
        sys.exit(1)
    
    print("\n🎉 ALL TESTS PASSED!")
    print("✅ SD 1.5 + LoRA system is working correctly")
    print("✅ Ready to run main application")

if __name__ == "__main__":
    main()