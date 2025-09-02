#!/bin/bash

# Firebase Installation Script
# Run this script to install Firebase dependencies

echo "Installing Firebase dependencies..."

# Try different installation methods
if npm install firebase-admin@latest --save; then
    echo "✅ firebase-admin installed successfully with npm"
elif yarn add firebase-admin@latest; then
    echo "✅ firebase-admin installed successfully with yarn"
else
    echo "❌ Failed to install firebase-admin"
    echo "Please install manually with: npm install firebase-admin --save"
fi

# Install Firebase CLI globally (optional)
if npm install -g firebase-tools; then
    echo "✅ Firebase CLI installed globally"
    echo "You can now use: firebase login and firebase init"
else
    echo "⚠️  Firebase CLI installation failed (this is optional)"
    echo "You can install it manually with: npm install -g firebase-tools"
fi

echo "Firebase installation script completed!"
echo ""
echo "Next steps:"
echo "1. Go to https://console.firebase.google.com"
echo "2. Create a new project or select existing one"
echo "3. Enable Authentication and Firestore"
echo "4. Download service account key from Project Settings > Service accounts"
echo "5. Update .env file with your Firebase credentials"