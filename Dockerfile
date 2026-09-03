# ---- Stage 1: build the two React (Vite) frontends ----
FROM node:20-alpine AS frontend-build
WORKDIR /app

COPY frontend/driver-app/package*.json frontend/driver-app/
RUN cd frontend/driver-app && npm ci
COPY frontend/driver-app frontend/driver-app
RUN cd frontend/driver-app && npm run build

COPY frontend/admin-dashboard/package*.json frontend/admin-dashboard/
RUN cd frontend/admin-dashboard && npm ci
COPY frontend/admin-dashboard frontend/admin-dashboard
RUN cd frontend/admin-dashboard && npm run build

# ---- Stage 2: Python runtime (FastAPI serves API + both built frontends) ----
FROM python:3.12-slim AS runtime
WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY backend backend
COPY main.py .
COPY --from=frontend-build /app/frontend/driver-app/dist frontend/driver-app/dist
COPY --from=frontend-build /app/frontend/admin-dashboard/dist frontend/admin-dashboard/dist

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --app-dir backend"]
