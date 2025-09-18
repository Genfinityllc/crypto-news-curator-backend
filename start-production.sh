#!/bin/bash

# Production startup script for Railway deployment
echo "🚀 Starting production server..."

# Ensure Playwright browsers are installed
echo "📦 Installing Playwright browsers..."
npx playwright install chromium --with-deps

# Check if installation was successful
if npx playwright install chromium --dry-run > /dev/null 2>&1; then
    echo "✅ Playwright browsers installed successfully"
else
    echo "⚠️ Playwright installation may have issues, but continuing..."
fi

# Start the Node.js server
echo "🎯 Starting Node.js server..."
exec node src/server.js