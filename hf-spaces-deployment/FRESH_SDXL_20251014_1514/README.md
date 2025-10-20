---
title: Crypto News LoRA Generator
emoji: 🎨
colorFrom: purple
colorTo: blue
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# 🚀 SDXL Universal LoRA Cover Generator

Generate crypto news covers using SDXL + Universal LoRA models.

## Features

- **SDXL Pipeline** with GPU acceleration
- **Universal LoRA** for crypto branding
- **30 style/client combinations**
- **Professional cover generation**

## Usage

Send POST requests to `/generate` with:
```json
{
  "title": "Your Article Title",
  "subtitle": "CRYPTO NEWS", 
  "client": "hedera",
  "style": "energy_fields",
  "use_trained_lora": true
}
```

## Supported Clients
- hedera, algorand, constellation, bitcoin, ethereum

## Supported Styles  
- energy_fields, dark_theme, network_nodes, particle_waves, corporate_style, ultra_visible