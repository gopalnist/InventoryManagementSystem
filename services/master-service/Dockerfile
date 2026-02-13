# Master Service Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy shared module
COPY ../../shared /app/shared

# Environment variables
ENV PYTHONPATH=/app:/app/shared
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8001

# Run the service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

