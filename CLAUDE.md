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