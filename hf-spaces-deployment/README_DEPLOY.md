# HF Spaces Deployment Instructions

## Quick Fix for Current Error

Your HF Space is failing because the dependencies are too heavy. Use the minimal version:

### 1. Update Your HF Space Files

Replace these files in your HF Space:

1. **Replace `app.py`** with `app_minimal.py` (rename it to `app.py`)
2. **Replace `requirements.txt`** with `requirements_minimal.txt` (rename it to `requirements.txt`)  
3. **Replace `Dockerfile`** with `Dockerfile_minimal` (rename it to `Dockerfile`)

### 2. Files to Upload

```
📁 Your HF Space Repository
├── app.py                    (use app_minimal.py content)
├── requirements.txt          (use requirements_minimal.txt content)
├── Dockerfile               (use Dockerfile_minimal content)
└── README.md               (optional)
```

### 3. The Minimal Version Features

✅ **Lightweight**: Only FastAPI + Pillow (no PyTorch/diffusers)  
✅ **Fast startup**: Deploys in under 2 minutes  
✅ **Client branding**: Color schemes for each crypto client  
✅ **Multiple styles**: energy_fields, network_nodes, geometric_patterns  
✅ **Base64 images**: Returns data URLs for immediate use  
✅ **Gradient backgrounds**: Professional crypto-themed designs  

### 4. Test After Deployment

```bash
curl -X POST "https://ValtronK-crypto-news-lora-generator.hf.space/generate" \
  -H "Content-Type: application/json" \
  -d '{"title": "Algorand Innovation", "client": "algorand", "style": "energy_fields"}'
```

### 5. Expected Response

```json
{
  "success": true,
  "image_url": "data:image/png;base64,iVBOR...",
  "metadata": {
    "client": "algorand",
    "style": "energy_fields",
    "title": "Algorand Innovation",
    "method": "minimal_generation"
  }
}
```

## Why This Works

- **No AI models**: Uses PIL for fast image generation
- **Small container**: Only ~200MB vs 5GB+ with PyTorch
- **CPU efficient**: Generates in seconds, not minutes
- **Reliable**: No model loading failures or memory issues

This gives you real generated images with proper client branding while your HF Space stays stable!