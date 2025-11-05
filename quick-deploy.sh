#!/bin/bash

# Quick Deploy Script for Railway
# Usage: ./quick-deploy.sh "commit message"

set -e

echo "🚀 Quick Railway Deploy Script"
echo "================================"

# Check if message provided
if [ -z "$1" ]; then
    echo "❌ Please provide a commit message"
    echo "Usage: ./quick-deploy.sh \"your commit message\""
    exit 1
fi

COMMIT_MSG="$1"

echo "📝 Staging all changes..."
git add .

echo "💾 Committing with message: $COMMIT_MSG"
git commit -m "$COMMIT_MSG

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo "🚀 Pushing to trigger Railway auto-deploy..."
git push origin main

echo "✅ Deploy initiated! Check Railway dashboard for progress."
echo "🔗 Backend URL: https://crypto-news-curator-backend-production.up.railway.app"