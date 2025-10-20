FROM python:3.9-slim

WORKDIR /app

# Install only essential system packages
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY genfinity-watermark.png .

EXPOSE 7860

CMD ["python", "app.py"]