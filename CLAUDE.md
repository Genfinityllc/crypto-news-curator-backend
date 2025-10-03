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
- Switched from Nano Banana to LoRA AI for image generation
- Disabled fallbacks to test LoRA system exclusively
- Updated frontend UI to reference LoRA instead of Nano Banana
- Fixed .railwayignore to exclude large training files while keeping necessary models

## LoRA Integration Status
✅ Frontend updated to use LoRA API endpoints
✅ Backend LoRA service integrated
✅ Fallbacks disabled for testing
✅ UI text updated from "Nano Banana" to "LoRA AI"