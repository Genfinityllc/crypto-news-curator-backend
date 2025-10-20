---
title: LoRA Crypto News Image Generator
emoji: 🎨
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# LoRA Crypto News Image Generator

This Hugging Face Space provides a LoRA-based image generation service for crypto news articles with client-specific branding.

## Features

- **Client-Specific Branding**: Supports Hedera, Algorand, Constellation, and generic crypto themes
- **Multiple Style Variations**: Energy fields, network nodes, abstract flow, geometric patterns, particle waves, crystalline structures
- **High-Quality Output**: 1792x896 images optimized for news articles
- **FastAPI Interface**: RESTful API for easy integration

## API Endpoints

### POST /generate
Generate a new LoRA image for a crypto news article.

**Request Body:**
```json
{
  "title": "Revolutionary DeFi Protocol Launches",
  "subtitle": "ALGORAND NEWS", 
  "client": "algorand",
  "style": "energy_fields"
}
```

**Response:**
```json
{
  "success": true,
  "image_url": "/download/algorand.png",
  "metadata": {
    "client": "algorand",
    "style": "energy_fields",
    "title": "Revolutionary DeFi Protocol Launches"
  }
}
```

### GET /health
Health check endpoint.

### GET /download/{client}.png
Download the generated image file.

## Supported Clients

- `hedera` - Hedera Hashgraph themed images
- `algorand` - Algorand themed images  
- `constellation` - Constellation Network themed images
- `bitcoin` - Bitcoin themed images
- `ethereum` - Ethereum themed images
- `generic` - General crypto themed images

## Integration

This service is designed to work with the crypto-news-curator backend. Configure your backend to call this HF Space instead of local generation:

```javascript
const response = await axios.post('https://YOUR-HF-SPACE.hf.space/generate', {
  title: articleData.title,
  client: clientId,
  subtitle: subtitle
});
```

## Model Information

Uses Stable Diffusion XL with custom LoRA adapters trained on crypto news imagery and client-specific branding elements.