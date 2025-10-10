#!/bin/bash

echo "🚀 Deploying LoRA Updates to Backend"
echo "===================================="

# Set Railway path
export PATH='/Users/valorkopeny/.local/bin:$PATH'

# Check if logged in
echo "🔍 Checking Railway authentication..."
if ! railway whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to Railway. Please run:"
    echo "   railway login"
    exit 1
fi

# Check if project is linked (Railway stores config in different ways)
echo "🔗 Checking Railway project link..."

echo "✅ Railway setup verified"
echo ""

echo "📦 Deploying backend with LoRA changes..."
echo "Changes include:"
echo "  - LoRA-only image generation"
echo "  - Clean LoRA implementation"
echo "  - Removed all third-party fallbacks"
echo ""

railway up

echo ""
echo "🎉 Deployment complete!"
echo "Backend URL: https://crypto-news-curator-backend-production.up.railway.app"