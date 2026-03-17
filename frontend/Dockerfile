# Frontend Dockerfile (build from repo root: docker build -f frontend/Dockerfile .)
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy source
COPY frontend/ .

EXPOSE 3001

# Dev server; proxy targets set via env in docker-compose (VITE_PROXY_*)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
