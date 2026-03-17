# Master Service Dockerfile (build from repo root: docker build -f services/master-service/Dockerfile .)
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY services/master-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and shared module
COPY services/master-service/ .
COPY shared /app/shared

# Environment variables
ENV PYTHONPATH=/app:/app/shared
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8001

# Run the service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

