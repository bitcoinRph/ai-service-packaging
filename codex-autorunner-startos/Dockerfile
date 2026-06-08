# ---------------------------------------------------------------------------
# Stage 1: build the Svelte web UI into src/codex_autorunner/web_static
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS web
WORKDIR /build
RUN corepack enable
# The whole source tree is needed because the web build is a pnpm workspace
# rooted at the repo and the static output lands in src/codex_autorunner/web_static.
COPY codex-autorunner/ ./
RUN pnpm install --frozen-lockfile \
  && CODEX_WEB_STATIC_VERSION="$(awk -F'\"' '/^version = /{print $2; exit}' pyproject.toml)" pnpm web:build

# ---------------------------------------------------------------------------
# Stage 2: install the Python package and assemble the runtime image
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS app

# git is required at runtime (CAR clones and manages repos); tini reaps the
# uvicorn/agent child processes cleanly.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the source, then overlay the prebuilt web assets from the web stage so
# pip packages them via setuptools package-data (web_static/**).
COPY codex-autorunner/ ./
COPY --from=web /build/src/codex_autorunner/web_static ./src/codex_autorunner/web_static

RUN pip install --no-cache-dir .

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Trust the StartOS reverse proxy's X-Forwarded-Proto so the web UI sees
    # the request as HTTPS (required for the secure session cookie + remote
    # bootstrap browser auth flow).
    FORWARDED_ALLOW_IPS=*

ENTRYPOINT ["tini", "--"]
CMD ["car", "--help"]
