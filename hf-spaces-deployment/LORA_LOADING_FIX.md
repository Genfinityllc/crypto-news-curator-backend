# 🔧 LoRA Loading Fix for HF Spaces

## Problems Identified

1. **Multiple safetensors files** in `models/lora/` causing ambiguity
2. **Missing weight_name specification** in `load_lora_weights()`
3. **Possible SDXL vs SD 1.5 LoRA mismatch**
4. **Directory vs file path confusion**

## Error Analysis

From your logs:
```
Provided path contains more than one weights file in the .safetensors format. 
`crypto_cover_styles_lora.safetensors` is going to be loaded, 
for precise control, specify a `weight_name` in `load_lora_weights`.

⚠️ LoRA loading failed: Unable to load weights from checkpoint file
```

## Solution

### Fix 1: Specify weight_name explicitly

```python
# ❌ OLD (ambiguous)
pipeline.load_lora_weights("models/lora/crypto_cover_styles_lora.safetensors")

# ✅ NEW (explicit file path + weight_name)
pipeline.load_lora_weights(
    "models/lora",  # Directory
    weight_name="crypto_cover_styles_lora.safetensors"  # Specific file
)
```

### Fix 2: Use full file path if only one LoRA

```python
# ✅ Alternative: Use full file path directly
lora_path = "models/lora/crypto_cover_styles_lora.safetensors"
if os.path.exists(lora_path):
    pipeline.load_lora_weights(lora_path)
```

### Fix 3: Verify LoRA format matches pipeline

**Check which LoRA file you have:**
- `crypto_cover_styles_lora.safetensors` → SDXL LoRA
- `crypto_cover_styles_sd15_lora.safetensors` → SD 1.5 LoRA

**Your pipeline:** SDXL (from logs: `StableDiffusionXLPipeline`)

**You need:** SDXL-compatible LoRA file

## Recommended Fix Code

```python
def load_lora_weights_safe(self, pipeline):
    """Load LoRA weights with proper error handling"""
    lora_dir = "models/lora"
    lora_file = "crypto_cover_styles_lora.safetensors"
    lora_path = os.path.join(lora_dir, lora_file)
    
    if not os.path.exists(lora_path):
        logger.warning(f"⚠️ LoRA file not found: {lora_path}")
        return False
    
    try:
        # Method 1: Load from directory with explicit weight_name
        logger.info(f"🔧 Loading LoRA from directory with weight_name...")
        pipeline.load_lora_weights(
            lora_dir,
            weight_name=lora_file
        )
        logger.info(f"✅ LoRA loaded successfully using weight_name")
        return True
    except Exception as e1:
        logger.warning(f"⚠️ Method 1 failed: {e1}")
        try:
            # Method 2: Load from full file path
            logger.info(f"🔧 Trying full file path...")
            pipeline.load_lora_weights(lora_path)
            logger.info(f"✅ LoRA loaded successfully using file path")
            return True
        except Exception as e2:
            logger.error(f"❌ LoRA loading failed with both methods:")
            logger.error(f"   Method 1 error: {e1}")
            logger.error(f"   Method 2 error: {e2}")
            return False
```

## Immediate Actions

1. **Remove duplicate files** from `models/lora/`:
   - Keep only: `crypto_cover_styles_lora.safetensors` (SDXL version)
   - Remove: `crypto_cover_styles_sd15_lora.safetensors` (wrong format)
   - Remove: `trained_crypto_lora.safetensors` (if duplicate)

2. **Update app.py** to use the fixed loading code above

3. **Verify LoRA file is SDXL-compatible**:
   ```python
   # Check file size - SDXL LoRA should be ~7-10MB
   import os
   file_size = os.path.getsize("models/lora/crypto_cover_styles_lora.safetensors")
   print(f"LoRA file size: {file_size / (1024*1024):.1f} MB")
   ```

4. **Check adapter_config.json exists**:
   ```bash
   # Should have adapter_config.json in models/lora/
   ls -la models/lora/
   ```

