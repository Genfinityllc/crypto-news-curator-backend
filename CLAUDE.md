# Claude Code Deployment Instructions

## Redeployment URLs
- **Frontend**: https://crypto-news-frontend-ruddy.vercel.app
- **Backend**: https://crypto-news-curator-backend-production.up.railway.app

## Deployment Commands

### Backend Deployment
```bash
export PATH='/Users/valorkopeny/.local/bin:$PATH' && /Users/valorkopeny/.local/bin/railway up
```

### Frontend Deployment  
```bash
cd /Users/valorkopeny/crypto-news-frontend && npx vercel --prod --alias crypto-news-frontend-ruddy.vercel.app
```

## Important Notes
- Always use the `--alias` flag for frontend deployments to maintain consistent URL
- Backend URL should remain stable across deployments
- Both services can be redeployed by Claude automatically

## Recent Changes
- Implemented pure LoRA AI for image generation
- Removed all third-party service dependencies
- Clean LoRA-only implementation
- Fixed .railwayignore to exclude large training files while keeping necessary models

## LoRA Integration Status
✅ Frontend updated to use LoRA API endpoints
✅ Backend LoRA service integrated
✅ Pure LoRA implementation (no fallbacks)
✅ Clean system with only LoRA AI

## PERFECT CONFIGURATION - DO NOT CHANGE ⚠️

### Image Dimensions & Watermark Positioning (LOCKED IN)
**Final Working Configuration:**
- **Output Image Size:** Exactly 1800x900 pixels
- **Watermark Position:** Bottom center with perfect placement
- **Watermark Formula:** 
  ```javascript
  leftPosition = Math.round((1800 - watermarkWidth) / 2);  // Center horizontally
  topPosition = 900 - watermarkHeight + 5;                 // 5px beyond bottom edge
  ```

### Working Process Flow:
1. **RunPod generates image** (any size, usually 1792x1024)
2. **Force resize to 1800x900** using Sharp
3. **Apply watermark at actual size** to 1800x900 canvas
4. **Position:** Center horizontally, 5px beyond bottom edge
5. **Result:** Perfect 1800x900 output with correctly positioned watermark

### Key Files:
- **RunPod Service:** `/src/services/runpodLoraService.js` - Forces resize to 1800x900
- **Watermark Service:** `/src/services/watermarkService.js` - Perfect positioning logic
- **Endpoint:** `/api/news/generate-lora-image` - Uses RunPod + smart network detection

### Network Detection (Working):
- **Aave:** Detects "aave" in title/content → Shows Aave ghost symbol
- **XRP/Ripple:** Detects "ripple" or "xrp" → Shows XRP symbols  
- **Bitcoin:** Only when article actually mentions Bitcoin
- **Strong anti-Bitcoin prompts** for non-Bitcoin articles

✅ **STATUS: PERFECT - DO NOT MODIFY WATERMARK POSITIONING**