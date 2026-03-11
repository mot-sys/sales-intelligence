# ── Stage 1: Build Vite frontend ─────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --include=dev
COPY frontend/ .
RUN npm run build

# ── Stage 2: FastAPI backend + bundled frontend ───────────────────────────────
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y gcc postgresql-client && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /frontend/dist /app/frontend_dist

EXPOSE 8000
# Use $PORT from Railway if set, otherwise default to 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
