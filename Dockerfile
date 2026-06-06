FROM node:24-alpine AS frontend-build
WORKDIR /frontend

# Better caching for npm
COPY frontend/package*.json ./
RUN npm ci --frozen-lockfile --production=false

COPY frontend/ ./
RUN npm run build

FROM python:3.14-alpine AS backend-build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock ./

ENV VIRTUAL_ENV=/app/.venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

RUN uv sync --frozen --no-install-project --no-dev --no-cache

COPY backend/src /app/src

FROM python:3.14-alpine

COPY --from=backend-build /app/.venv /app/.venv
COPY --from=backend-build /app/src /app/src
COPY --from=frontend-build /frontend/dist /app/frontend

ENV PATH="/app/.venv/bin:$PATH" \
    FRONTEND_DIR="/app/frontend" \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0

WORKDIR /app/src
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["python", "main.py"]
