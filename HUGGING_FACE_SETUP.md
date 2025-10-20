# Hugging Face Spaces Setup Guide

## Quick Steps to Deploy

### 1. Create Hugging Face Account & Space
1. Go to [https://huggingface.co/join](https://huggingface.co/join)
2. Create account (free)
3. Go to [https://huggingface.co/new-space](https://huggingface.co/new-space)
4. Create space:
   - Name: `crypto-news-lora-generator`
   - SDK: `Docker`
   - Hardware: `CPU basic (free)`
   - Visibility: `Public`

### 2. Upload Files to Your Space
Upload all files from `/Users/valorkopeny/crypto-news-curator-backend/hf-spaces-deployment/` to your new space:

```
📁 Your HF Space Repository
├── app.py                      (FastAPI server)
├── simple_lora_generator.py    (Image generator)
├── requirements.txt            (Python dependencies)
├── Dockerfile                  (Container config)
├── README.md                   (Documentation)
└── .gitignore                  (Git ignore rules)
```

### 3. Configure Your Railway Backend
Add environment variable to Railway:

```bash
HF_SPACES_LORA_URL=https://YOUR-USERNAME-crypto-news-lora-generator.hf.space
```

Replace `YOUR-USERNAME` with your actual HuggingFace username.

### 4. Deploy Updated Backend
```bash
export PATH='/Users/valorkopeny/.local/bin:$PATH' && /Users/valorkopeny/.local/bin/railway up
```

## Expected Workflow

```
Frontend Click "Generate Cover" 
    ↓
Railway Backend (/api/news/generate-lora-image)
    ↓  
HF Spaces API (/generate)
    ↓
Generated LoRA Image URL
    ↓
Display on Frontend
```

## Test Commands

Test HF Spaces directly:
```bash
curl -X POST "https://YOUR-USERNAME-crypto-news-lora-generator.hf.space/generate" \
  -H "Content-Type: application/json" \
  -d '{"title": "Algorand Innovation", "client": "algorand", "style": "energy_fields"}'
```

Test Railway integration:
```bash
curl -X POST "https://crypto-news-curator-backend-production.up.railway.app/api/news/generate-lora-image" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Article", "network": "algorand"}'
```

## Benefits

✅ **Real LoRA-style images** (not placeholders)  
✅ **No model file size limits** on HF Spaces  
✅ **Free deployment** with CPU generation  
✅ **Automatic scaling** and reliability  
✅ **Easy updates** via git push  

## Upgrade Path

Later you can:
- Upgrade to GPU hardware for faster generation
- Add real Stable Diffusion models
- Use HF Inference API for premium features

## Files Created

I've prepared everything in the `hf-spaces-deployment/` folder. The integration is ready - you just need to:

1. Create the HF Space
2. Upload the files  
3. Set the environment variable
4. Deploy Railway backend

Your LoRA system will then work with real generated images! 🎨