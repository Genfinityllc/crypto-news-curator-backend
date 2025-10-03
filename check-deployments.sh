#!/bin/bash

# Crypto News Curator - Deployment Status Checker
echo "🚀 Crypto News Curator - Deployment Status Checker"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# URLs
BACKEND_URL="https://crypto-news-curator-backend-production.up.railway.app"
FRONTEND_URL="https://crypto-news-frontend.vercel.app"

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
    else
        echo -e "${RED}❌ Main API is NOT RESPONDING (HTTP $API_STATUS)${NC}"
    fi
    
else
    echo -e "${RED}❌ Backend is OFFLINE (HTTP $BACKEND_STATUS)${NC}"
fi

echo ""
echo "🔍 Checking Frontend Deployment..."
echo "=================================="

# Check frontend
echo "🌐 Testing frontend URL..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is ONLINE${NC}"
else
    echo -e "${RED}❌ Frontend is NOT RESPONDING (HTTP $FRONTEND_STATUS)${NC}"
fi

echo ""
echo "📅 Last Deployment Information"
echo "=============================="

# Check backend deployment date (from health endpoint uptime)
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "🔧 Backend deployment info:"
    echo "   URL: $BACKEND_URL"
    echo "   Status: Online and healthy"
fi

# Check frontend last update
if [ -f "/Users/valorkopeny/crypto-news-frontend/vercel-redeploy.txt" ]; then
    echo "🎨 Frontend last redeploy info:"
    tail -1 "/Users/valorkopeny/crypto-news-frontend/vercel-redeploy.txt"
fi

echo ""
echo "🔧 Available Deployment Tools"
echo "============================="

# Check Railway CLI
if command -v /Users/valorkopeny/.local/bin/railway &> /dev/null; then
    echo -e "${GREEN}✅ Railway CLI is available${NC}"
else
    echo -e "${YELLOW}⚠️  Railway CLI not found${NC}"
fi

# Check npm for Vercel
if command -v npm &> /dev/null; then
    echo -e "${GREEN}✅ NPM is available (can use npx vercel)${NC}"
else
    echo -e "${RED}❌ NPM not found${NC}"
fi

echo ""
echo "🚀 Deployment Commands"
echo "====================="
echo "Backend (Railway):"
echo "   cd /Users/valorkopeny/crypto-news-curator-backend"
echo "   export PATH='/Users/valorkopeny/.local/bin:\$PATH'"
echo "   railway deploy"
echo ""
echo "Frontend (Vercel):"
echo "   cd /Users/valorkopeny/crypto-news-frontend"
echo "   npx vercel --prod"
echo ""
echo "AI Cover Generator (Railway):"
echo "   cd /Users/valorkopeny/crypto-news-curator-backend/ai-cover-generator"
echo "   export PATH='/Users/valorkopeny/.local/bin:\$PATH'"
echo "   railway deploy"

echo ""
echo "✨ Summary"
echo "========="
if [ "$BACKEND_STATUS" = "200" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}🎉 All systems are OPERATIONAL!${NC}"
elif [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${YELLOW}⚠️  Backend is working, frontend needs attention${NC}"
elif [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${YELLOW}⚠️  Frontend is working, backend needs attention${NC}"
else
    echo -e "${RED}🚨 Both systems need attention${NC}"
fi

echo ""
echo "Last checked: $(date)"