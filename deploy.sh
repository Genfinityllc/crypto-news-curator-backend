#!/bin/bash

echo "🚀 Starting Railway deployment..."

# Add and commit changes
git add .
git commit -m "Auto-deploy: $(date '+%Y-%m-%d %H:%M:%S')" || echo "No changes to commit"

# Push to trigger Railway deploy
git push origin main

echo "✅ Pushed to main branch - Railway will auto-deploy"
echo "🔗 Check deployment at: https://railway.app"

# Wait a moment and check deployment status
sleep 10
echo "📡 Testing production health check..."
curl -s "https://crypto-news-curator-backend-production.up.railway.app/health" | head -5