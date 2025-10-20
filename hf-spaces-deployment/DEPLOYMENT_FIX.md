# HF Spaces Docker Build Fix

## Issue
The Docker build was failing with:
```
E: Unable to locate package software-properties-common
```

## Solution
Updated the Dockerfile to remove the problematic package and use a minimal setup.

## Files to Upload to HF Spaces

### 1. `Dockerfile`
```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install only essential system packages
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY genfinity-watermark.png .

EXPOSE 7860

CMD ["python", "app.py"]
```

### 2. `requirements.txt`
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
Pillow==10.1.0
pydantic==2.5.0
numpy==1.24.3
```

### 3. `app.py`
The enhanced lightweight generator (already uploaded)

### 4. `genfinity-watermark.png`
The watermark file (already uploaded)

## Expected Result
- ✅ Docker build will succeed
- ✅ Enhanced backgrounds with energy fields, nodes, and particles
- ✅ Professional text styling with shadows and boxes
- ✅ Genfinity watermark applied
- ✅ Brand-specific colors (Purple/Teal/Blue-White)
- ✅ 1800x900 high-quality output

## Test After Deployment
```bash
curl -X POST https://ValtronK-crypto-news-lora-generator.hf.space/generate \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Enhanced", "client": "hedera", "style": "energy_fields"}'
```