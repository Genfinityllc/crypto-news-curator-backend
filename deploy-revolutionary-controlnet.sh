#!/bin/bash

echo "🚀 DEPLOYING REVOLUTIONARY TWO-STAGE DEPTH-AWARE CONTROLNET SYSTEM"
echo "================================================================"
echo ""
echo "✨ Features being deployed:"
echo "- Stage 1: Generate high-quality 3D environments"  
echo "- Stage 2: Depth-aware logo integration using MiDaS"
echo "- Perspective-correct logo placement with environmental interaction"
echo "- Multiple logo instances at various depths and angles"
echo "- Cinematic quality scenes matching XRP reference standards"
echo ""
echo "🔧 Technical Implementation:"
echo "- Two-stage generation process"
echo "- SDXL ControlNet Depth integration"
echo "- Enhanced prompts for 3D logo integration" 
echo "- Depth map estimation and control"
echo "- Environmental lighting interaction"
echo ""

# Set PATH for Railway CLI
export PATH='/Users/valorkopeny/.local/bin:$PATH'

# Check if logged in
echo "🔐 Checking Railway authentication..."
if ! /Users/valorkopeny/.local/bin/railway whoami >/dev/null 2>&1; then
    echo "❌ Not logged into Railway. Please run:"
    echo "   export PATH='/Users/valorkopeny/.local/bin:\$PATH'"
    echo "   railway login"
    echo ""
    echo "🔑 Authentication Options:"
    echo "1. Run 'railway login' and complete browser authentication"
    echo "2. Use project token: RAILWAY_TOKEN=your-token railway up"
    echo "3. Set up service token in Railway dashboard"
    exit 1
fi

echo "✅ Railway authentication confirmed"
echo ""

# Deploy
echo "🚀 Deploying revolutionary ControlNet system..."
/Users/valorkopeny/.local/bin/railway up

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo "================================="
    echo ""
    echo "🌐 Backend URL: https://crypto-news-curator-backend-production.up.railway.app"
    echo ""
    echo "🧪 Test the new system:"
    echo "1. Generate an image from your frontend"
    echo "2. Look for these improvements:"
    echo "   ✅ True 3D logo integration (not flat overlays)"
    echo "   ✅ Perspective-correct placement"
    echo "   ✅ Environmental interaction" 
    echo "   ✅ Professional quality backgrounds"
    echo "   ✅ Multiple logo instances with depth variation"
    echo ""
    echo "📊 Monitor deployment:"
    echo "   railway logs --lines 50"
    echo ""
else
    echo "❌ Deployment failed. Check logs:"
    echo "   railway logs --lines 20"
fi