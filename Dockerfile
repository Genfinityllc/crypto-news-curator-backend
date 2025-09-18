# Use a more complete Node.js image with better Playwright support
FROM node:20-bullseye

# Install system dependencies required for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libgconf-2-4 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrender1 \
    libxtst6 \
    libglib2.0-0 \
    libnss3 \
    fonts-liberation \
    libappindicator3-1 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright and browsers with extensive debugging
RUN echo "=== Installing Playwright ===" && \
    npx playwright install chromium && \
    echo "=== Installing system dependencies ===" && \
    npx playwright install-deps chromium && \
    echo "=== Verifying installation ===" && \
    ls -la /root/.cache/ms-playwright/ || echo "No playwright cache found" && \
    npx playwright --version && \
    echo "=== Testing browser launch ===" && \
    node -e "const { chromium } = require('playwright'); chromium.launch().then(() => console.log('✅ Chromium can launch')).catch(e => console.log('❌ Chromium failed:', e.message))" || echo "Browser test failed"

# Copy the rest of the application code
COPY . .

# Set environment variables for Railway detection
ENV RAILWAY_DOCKERFILE_BUILD=true
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Expose the port the app runs on
EXPOSE 3001

# Start the application with comprehensive debugging
CMD ["sh", "-c", "echo '🚀 Starting Railway deployment...' && echo 'Node version:' $(node --version) && echo 'NPM version:' $(npm --version) && echo 'Playwright version:' $(npx playwright --version || echo 'Not found') && echo 'Playwright browsers:' && ls -la /root/.cache/ms-playwright/ || echo 'No cache found' && echo 'Starting server...' && npm start"]