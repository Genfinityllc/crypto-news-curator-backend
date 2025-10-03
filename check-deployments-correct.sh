#!/bin/bash

# Crypto News Curator - CORRECT Deployment Status Checker
echo "🚀 Crypto News Curator - CORRECT Deployment Status Checker"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# CORRECT URLs
BACKEND_URL="https://crypto-news-curator-backend-production.up.railway.app"
FRONTEND_URL="https://crypto-news-frontend-ruddy.vercel.app"

echo ""
echo "🔍 Checking Backend Deployment..."
echo "================================="

# Check backend health
echo "📡 Testing backend health endpoint..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")

if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend is ONLINE${NC}"
    
    # Get detailed health info
    HEALTH_INFO=$(curl -s "$BACKEND_URL/health")
    echo "📊 Backend Health Details:"
    echo "$HEALTH_INFO" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_INFO"
    
    # Test API endpoint
    echo ""
    echo "🧪 Testing main API endpoint..."
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/news/latest")
    
    if [ "$API_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ Main API is WORKING${NC}"
        
        # Get latest news timestamp
        LATEST_NEWS=$(curl -s "$BACKEND_URL/api/news/latest" | python3 -c "import sys, json; data=json.load(sys.stdin); print('Latest news from:', data['data']['published_at'])" 2>/dev/null)
        echo "📰 $LATEST_NEWS"
    else
        echo -e "${RED}❌ Main API is NOT RESPONDING (HTTP $API_STATUS)${NC}"
    fi
    
else
    echo -e "${RED}❌ Backend is OFFLINE (HTTP $BACKEND_STATUS)${NC}"
fi

echo ""
echo "🔍 Checking CORRECT Frontend Deployment..."
echo "========================================="

# Check frontend
echo "🌐 Testing CORRECT frontend URL..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is ONLINE${NC}"
    
    # Check if it's loading the title
    TITLE=$(curl -s "$FRONTEND_URL" | grep -o "<title>[^<]*" | head -1)
    echo "📄 $TITLE"
else
    echo -e "${RED}❌ Frontend is NOT RESPONDING (HTTP $FRONTEND_STATUS)${NC}"
fi

echo ""
echo "🚀 CORRECT Deployment Commands"
echo "============================="
echo "Backend (Railway):"
echo "   cd /Users/valorkopeny/crypto-news-curator-backend"
echo "   export PATH='/Users/valorkopeny/.local/bin:\$PATH'"
echo "   railway login  # (if needed)"
echo "   railway up"
echo ""
echo "Frontend (Vercel - CORRECT PROJECT):"
echo "   cd /Users/valorkopeny/crypto-news-frontend"
echo "   npx vercel login  # (if needed)"
echo "   npx vercel --prod --yes"
echo "   # Should deploy to: crypto-news-frontend-ruddy.vercel.app"

echo ""
echo "✨ CORRECT URLs"
echo "==============="
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $BACKEND_URL"

echo ""
echo "Last checked: $(date)"