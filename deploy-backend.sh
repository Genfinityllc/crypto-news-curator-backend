#!/bin/bash

echo "🚀 Deploying crypto-news-curator-backend to Railway..."
echo "📁 Current directory: $(pwd)"
echo "🔧 Checking Railway CLI..."

# Set PATH to include Railway CLI
export PATH='/Users/valorkopeny/.local/bin:$PATH'

# Check if railway command exists
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found in PATH"
    exit 1
fi

echo "✅ Railway CLI found"

# Deploy with verbose output
echo "📤 Starting deployment..."
railway up --verbose

echo "✅ Deployment completed!"
echo "🌐 Backend URL: https://crypto-news-curator-backend-production.up.railway.app"