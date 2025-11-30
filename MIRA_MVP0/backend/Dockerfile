# Dockerfile for WebSocket service (AWS App Runner)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir uvicorn[standard] gunicorn boto3

# Copy application code
COPY . .

# Expose port (App Runner uses PORT env var)
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV USE_DYNAMODB=true

# Run with uvicorn (production-grade ASGI server)
CMD uvicorn websocket_app:app --host 0.0.0.0 --port ${PORT} --workers 1

