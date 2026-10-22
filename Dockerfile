# Seega: React frontend + FastAPI + SWI-Prolog in one container.
# The image serves the game and the API on port 8000.

# ---------- 1. build the React frontend ----------
FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- 2. runtime: Python + SWI-Prolog ----------
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SEEGA_BRIDGE=subprocess \
    STATIC_DIR=/app/static \
    PORT=8000

RUN apt-get update \
    && apt-get install -y --no-install-recommends swi-prolog-nox curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY prolog/ prolog/
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist/ static/

# Check the rules engine at build time.
RUN swipl -g run_tests -t halt prolog/tests.pl

RUN useradd --create-home --uid 1000 seega && chown -R seega /app
USER seega

WORKDIR /app/backend
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

# One worker: each worker owns one Prolog process; searches take well under a second.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
