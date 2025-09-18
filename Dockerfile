# Use the official Node.js runtime as the base image
FROM node:20-slim

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
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright browsers with extensive debugging
RUN echo "Installing Playwright browsers..." && \
    npx playwright install chromium --with-deps && \
    echo "Playwright installation completed" && \
    ls -la ~/.cache/ms-playwright/ || echo "No playwright cache found" && \
    which chromium-browser || which google-chrome || echo "No chrome binary found"

# Copy the rest of the application code
COPY . .

# Set environment variables for Railway detection
ENV RAILWAY_DOCKERFILE_BUILD=true

# Expose the port the app runs on
EXPOSE 3001

# Start the application with debugging
CMD ["sh", "-c", "echo 'Starting with Dockerfile...' && ls -la ~/.cache/ms-playwright/ || echo 'No playwright cache at startup' && npm start"]