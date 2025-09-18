#!/bin/bash

# Production startup script for Railway deployment
echo "🚀 Starting production server..."

# Environment info
echo "📋 Environment info:"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "OS: $(uname -a)"
echo "Available disk space: $(df -h)"

# Ensure Playwright browsers are installed
echo "📦 Installing Playwright browsers..."
npx playwright install chromium --with-deps

# Check if installation was successful
echo "🔍 Checking Playwright installation..."
if command -v chromium-browser &> /dev/null; then
    echo "✅ Chromium binary found"
elif command -v google-chrome &> /dev/null; then
    echo "✅ Chrome binary found"
else
    echo "⚠️ No Chrome/Chromium binary found in PATH"
fi

# Try to verify Playwright can run
echo "🧪 Testing Playwright..."
if timeout 10s npx playwright install chromium --dry-run 2>&1; then
    echo "✅ Playwright dry-run successful"
else
    echo "⚠️ Playwright dry-run failed"
fi

# Check if browsers directory exists
if [ -d ~/.cache/ms-playwright ]; then
    echo "✅ Playwright cache directory exists"
    ls -la ~/.cache/ms-playwright/
else
    echo "⚠️ Playwright cache directory not found"
fi

# Start the Node.js server
echo "🎯 Starting Node.js server..."
exec node src/server.js