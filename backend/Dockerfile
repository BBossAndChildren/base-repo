FROM ghcr.io/astral-sh/uv:0.10.9 AS uv

FROM python:3.12.13-slim-bookworm AS dependencies
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_PYTHON_DOWNLOADS=never \
    UV_LINK_MODE=copy
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./
RUN uv sync --locked --no-dev --no-install-project

FROM python:3.12.13-slim-bookworm AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    GUNICORN_BIND=0.0.0.0:8000
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home app \
    && mkdir -p /app/backend/staticfiles \
    && chown -R app:app /app
WORKDIR /app/backend
COPY --from=dependencies /opt/venv /opt/venv
COPY --chown=app:app backend/ ./
COPY --chown=app:app docs/game/ /app/docs/game/
COPY --chown=app:app docs/unity/contracts/realtime-v002/realtime-contract.json /app/docs/unity/contracts/realtime-v002/
COPY --chown=app:app docs/unity/contracts/reconciliation-v003/resolution-response.schema.json docs/unity/contracts/reconciliation-v003/acceptance-cases.json /app/docs/unity/contracts/reconciliation-v003/
COPY --chown=app:app docs/unity/builds/production-ai-build-catalog.json docs/unity/builds/production-supported-manifest.json /app/docs/unity/builds/
USER app
EXPOSE 8000
CMD ["sh", "scripts/start_container.sh", "gunicorn", "-c", "gunicorn.conf.py", "config.wsgi:application"]
