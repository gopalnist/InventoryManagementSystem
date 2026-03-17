# Report Service Dockerfile (build from repo root: docker build -f services/report-service/Dockerfile .)
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY services/report-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application and shared module
COPY services/report-service/ .
COPY shared /app/shared

ENV PYTHONPATH=/app:/app/shared
ENV PYTHONUNBUFFERED=1

EXPOSE 8005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005"]
