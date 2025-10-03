# 🖼️ AI Cover Image Generator – Build Plan

## 1. Overview
This project generates **cover images for crypto news articles** with two workflows:  

1. **Automated API** → integrates with the existing app to auto-generate cover images.  
2. **Manual Web App** → frontend interface for creating/editing images before publishing.  

Images include:  
- Backgrounds generated with **Stable Diffusion XL + LoRA fine-tuned logos**.  
- **Centered titles/subtitles**.  
- **Optional watermark overlay**.  
- Output size: **1800×900 px** (default) or **1920×1080 px** (optional).  

---

## 2. Tech Stack
- **Image Generation**: Stable Diffusion XL (Diffusers/ComfyUI) on Mac Studio (Metal acceleration).  
- **LoRA Training**: Kohya LoRA trainer for brand logos.  
- **Backend**: FastAPI (Python).  
- **Frontend (Manual Workflow)**: React + Tailwind CSS.  
- **Storage/Delivery**: Supabase (storage bucket + DB for client/logo mapping).  
- **Deployment**: Railway (API + frontend).  
- **Development**: VS Code + Claude Code.  

---

## 3. Workflows

### A. Automated API Workflow
1. Existing app sends POST to `/generate-cover`:
   ```json
   {
     "title": "Ethereum ETF Approved by SEC",
     "subtitle": "Historic milestone for crypto adoption",
     "client_id": "eth_foundation",
     "size": "1800x900"
   }
   ```

2. FastAPI processes request:
   - Maps `client_id` → LoRA model (if available)
   - Generates background with SDXL + LoRA
   - Overlays title/subtitle text with Pillow
   - Uploads final image to Supabase storage
   - Returns image URL

### B. Manual Web App Workflow
1. User opens React frontend interface
2. Inputs:
   - Title + subtitle text
   - Logo selection (dropdown of trained LoRAs)
   - Optional watermark upload (PNG/SVG)
   - Image size selection (1800×900 or 1920×1080)
3. Preview generation
4. User approval/editing
5. Final export to Supabase storage

---

## 4. Development Phases

### Phase 1: Local Prototype ⚡
- [ ] Set up SDXL inference with Metal acceleration
- [ ] Train sample logo LoRA
- [ ] Build FastAPI `/generate-cover` endpoint
- [ ] Implement text overlay with Pillow
- [ ] Local image generation testing

### Phase 2: Manual Web App 🎨
- [ ] Scaffold React + Tailwind frontend
- [ ] Create form components (title, subtitle, logo selector)
- [ ] File upload for watermarks
- [ ] Preview generation and approval workflow
- [ ] Connect frontend to FastAPI backend

### Phase 3: Storage & Database 🗄️
- [ ] Set up Supabase storage bucket
- [ ] Create client/logo mapping table
- [ ] Implement image metadata storage
- [ ] Integration with existing app database

### Phase 4: Deployment 🚀
- [ ] Deploy FastAPI backend to Railway
- [ ] Deploy React frontend to Railway/Vercel
- [ ] Configure production environment variables
- [ ] Set up monitoring and logging

### Phase 5: Integration 🔗
- [ ] Integrate automated API with existing crypto news app
- [ ] Create admin interface for logo management
- [ ] Implement batch generation capabilities
- [ ] Performance optimization and caching

---

## 5. LoRA Training Pipeline

### Logo Collection
- **Target**: 30+ crypto company/project logos
- **Format**: High-quality PNG/SVG files
- **Variations**: 20-30 images per logo on different backgrounds
- **Storage**: `./models/lora/` directory

### Training Process
1. **Kohya LoRA Trainer** setup on Mac Studio
2. **Training parameters**:
   - Base model: Stable Diffusion XL
   - LoRA rank: 64-128
   - Learning rate: 1e-4
   - Training steps: 1000-2000 per logo
3. **Validation**: Generate test images per LoRA
4. **Storage**: Trained LoRA weights in `./models/lora/`

---

## 6. API Endpoints

### Core Generation
- `POST /api/generate-cover` - Automated generation
- `POST /api/manual-generate` - Manual workflow generation
- `GET /api/preview/{job_id}` - Preview generated image

### Management
- `GET /api/logos` - List available LoRA models
- `POST /api/upload-watermark` - Upload custom watermarks
- `GET /api/storage/images` - List generated images

### Health & Status
- `GET /health` - Service health check
- `GET /api/models/status` - SDXL model loading status

---

## 7. Database Schema (Supabase)

### Tables
```sql
-- Client/Logo mapping
CREATE TABLE client_logos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(100) UNIQUE NOT NULL,
    logo_name VARCHAR(100) NOT NULL,
    lora_model_path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Generated images metadata
CREATE TABLE generated_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    client_id VARCHAR(100),
    image_url TEXT NOT NULL,
    image_size VARCHAR(20) NOT NULL,
    generation_params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- LoRA model versions
CREATE TABLE lora_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    version VARCHAR(20) NOT NULL,
    file_path TEXT NOT NULL,
    training_steps INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Deployment Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │───▶│   FastAPI API    │───▶│   Supabase      │
│  (Railway/      │    │   (Railway)      │    │   (Storage +    │
│   Vercel)       │    │                  │    │    Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Stable Diffusion │
                       │ XL + LoRA        │
                       │ (Mac Studio)     │
                       └──────────────────┘
```

---

## 9. Cost Breakdown

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| **Mac Studio** | Local development | $0 |
| **Supabase** | Free tier (10GB storage) | $0 |
| **Railway** | Free tier ($5 credits) | $0-5 |
| **Frontend Hosting** | Vercel/Netlify free | $0 |
| **Total** | | **$0-5/month** |

---

## 10. Success Metrics

### Performance
- Image generation time: < 30 seconds
- API response time: < 5 seconds (excluding generation)
- Storage upload time: < 3 seconds

### Quality
- Brand logo recognition accuracy: > 90%
- Text overlay positioning: Consistently centered
- Image resolution: Sharp 1800×900 or 1920×1080 output

### Integration
- Automated API uptime: > 99%
- Manual workflow completion rate: > 95%
- User satisfaction with generated images: > 85%

---

## 11. Future Enhancements

### Phase 6: Advanced Features 🚀
- **Batch generation** for social media formats (square, story)
- **Interactive text positioning** in manual workflow
- **ControlNet integration** for precise logo placement
- **Prompt templates** per client for consistent style

### Phase 7: Enterprise Features 🏢
- **Multi-tenant support** for different organizations
- **Advanced analytics** and usage tracking
- **A/B testing** for different generation parameters
- **Custom style training** for brand-specific aesthetics

---

## 12. Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Mac Studio with Metal support
- Supabase account
- Railway account

### Quick Start
```bash
# Clone and setup backend
cd ai-cover-generator
pip install -r requirements.txt
cp .env.example .env  # Configure environment variables

# Setup frontend
cd frontend
npm install
npm run dev

# Start development
uvicorn app.main:app --reload
```

---

**🎯 This plan provides a comprehensive roadmap for building a production-ready AI cover image generator that integrates seamlessly with your existing crypto news application while providing powerful manual editing capabilities.**