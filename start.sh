#!/bin/bash

echo "🚀 Starting Crypto News Curator Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if MongoDB is running
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB is not installed locally. Make sure you have MongoDB running or update MONGODB_URI in .env"
else
    if ! pgrep -x "mongod" > /dev/null; then
        echo "⚠️  MongoDB is not running. Starting MongoDB..."
        mongod --dbpath ./data/db &
        sleep 3
    fi
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please update .env with your configuration before continuing"
    echo "   - Set JWT_SECRET to a secure random string"
    echo "   - Update MONGODB_URI if using remote MongoDB"
    echo "   - Add API keys for external services"
    read -p "Press Enter to continue after updating .env..."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create logs directory
mkdir -p logs

# Start the application
echo "🌟 Starting the application..."
npm run dev
