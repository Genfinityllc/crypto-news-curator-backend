#!/bin/bash

# Backend Redeploy Script
echo "🚀 Redeploying Crypto News Backend"
echo "=================================="

# Add Railway CLI to PATH
export PATH="/Users/valorkopeny/.local/bin:$PATH"

# Check if logged in to Railway
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway first:"
    echo "   railway login"
    exit 1
fi

echo "📦 Deploying to Railway..."

# Deploy to Railway
railway up

if [ $? -eq 0 ]; then
    echo "✅ Backend redeployed successfully!"
    echo "🌐 Your backend should be live at: https://crypto-news-curator-backend-production.up.railway.app"
    
    # Test the deployment
    echo ""
    echo "🧪 Testing deployment..."
    sleep 5
    
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://crypto-news-curator-backend-production.up.railway.app/health")
    
    if [ "$HEALTH_STATUS" = "200" ]; then
        echo "✅ Backend is responding correctly!"
    else
        echo "⚠️  Backend might still be starting up. Check in a minute."
    fi
else
    echo "❌ Deployment failed. Please check the error messages above."
fi

echo ""
echo "📊 You can check deployment status at:"
echo "   https://railway.app/dashboard"