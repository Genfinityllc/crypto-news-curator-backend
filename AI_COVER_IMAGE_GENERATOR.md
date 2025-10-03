# 🖼️ AI Cover Image Generator – Build Plan

## 🎯 **Project Overview**
This project generates **cover images for crypto news articles** with two workflows:
1. **Automated API** → integrates with the existing app to auto-generate cover images
2. **Manual Web App** → frontend interface for creating/editing images before publishing

## 🏗️ **Tech Stack**
- **AI Model**: Stable Diffusion XL + LoRA (fine-tuned for crypto/brand logos)
- **Backend**: FastAPI (Python) for image generation
- **Frontend**: React (existing crypto news app integration)
- **Storage**: Supabase Storage
- **Deployment**: Railway (API + Frontend)
- **Hardware**: Mac Studio (Metal acceleration for local development)

## 📊 **Image Specifications**
- **Dimensions**: 1800×900px (or 1920×1080px)
- **Format**: PNG/JPEG
- **Elements**: Title text overlay + optional brand watermark
- **Style**: Crypto/financial themes with brand consistency

## 🔄 **Workflows**

### 1️⃣ **Automated API Workflow**
```
News Article → API Call → AI Generation → Supabase Storage → URL Return
```

### 2️⃣ **Manual Web App Workflow**
```
User Input → Preview Generation → Manual Editing → Final Export → Supabase Storage
```

## 🛠️ **Implementation Plan**

### Phase 1: FastAPI Backend Setup
- [ ] Create FastAPI project structure
- [ ] Set up Stable Diffusion XL with Metal acceleration
- [ ] Create image generation endpoints
- [ ] Integrate Supabase storage
- [ ] Add LoRA training pipeline

### Phase 2: Database Schema (Supabase)
- [ ] Client/Logo mapping table
- [ ] Generated images metadata table
- [ ] LoRA model versions table

### Phase 3: API Integration
- [ ] Automated generation endpoint `/api/generate-cover`
- [ ] Manual generation endpoint `/api/manual-generate`
- [ ] Image storage and retrieval system

### Phase 4: Frontend Integration
- [ ] Add cover image generation to existing React app
- [ ] Create manual editing interface
- [ ] Implement preview and approval workflow

## 🚀 **Deployment Architecture**
```
Railway Frontend ← API Calls → Railway FastAPI Backend ← Storage → Supabase
                                      ↓
                            Stable Diffusion XL + LoRA
                                  (Metal GPU)
```

## 🔑 **Key Features**
- **Brand Recognition**: LoRA fine-tuning for crypto company logos
- **Text Overlay**: Dynamic title positioning and styling
- **Quality Control**: Preview before publishing
- **Batch Processing**: Generate multiple variations
- **Caching**: Store popular templates for faster generation