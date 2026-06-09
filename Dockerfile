# Multi-stage Dockerfile for Aha MCP Server + Portal
# Stage 1: Build MCP server TypeScript
FROM oven/bun:1.2-alpine AS mcp-builder

RUN apk add --no-cache python3 python3-dev py3-setuptools make gcc g++ musl-dev sqlite-dev pkgconf

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json ./
RUN bun run build

# Stage 2: Build Portal (React + Vite)
FROM node:20-alpine AS portal-builder

WORKDIR /portal
COPY portal/package.json portal/package-lock.json* ./
RUN npm install

COPY portal/ ./
RUN npm run build

# Stage 3: Production image
FROM oven/bun:1.2-alpine AS production

# Install runtime and build deps for native modules
RUN apk add --no-cache \
    tini \
    wget \
    sqlite \
    sqlite-libs \
    python3 \
    py3-setuptools \
    make \
    gcc \
    g++ \
    musl-dev \
    sqlite-dev \
    pkgconf

# Non-root user
RUN addgroup -g 1001 -S mcp && adduser -S -u 1001 -G mcp mcp

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

# Copy pre-built sqlite-vec and rebuild sqlite3
COPY --from=mcp-builder /app/node_modules/sqlite-vec ./node_modules/sqlite-vec/
RUN cd node_modules/sqlite3 && bun run install --build-from-source

# SQLite binding symlinks
RUN mkdir -p /app/lib/binding/node-v137-linux-arm64/ /app/lib/binding/node-v137-linux-x64/ && \
    ln -sf /app/node_modules/sqlite3/build/Release/node_sqlite3.node /app/lib/binding/node-v137-linux-arm64/node_sqlite3.node && \
    ln -sf /app/node_modules/sqlite3/build/Release/node_sqlite3.node /app/lib/binding/node-v137-linux-x64/node_sqlite3.node

# OpenTelemetry
RUN bun install @opentelemetry/auto-instrumentations-node

# Copy MCP server build
COPY --from=mcp-builder /app/build ./build
COPY --from=mcp-builder /app/src/core/database/schema.sql ./build/schema.sql

# Copy portal build (served by portal-server.ts Express static middleware)
COPY --from=portal-builder /portal/dist ./portal/dist

COPY package.json ./
COPY package.json /package.json

# Data dir for SQLite + config
RUN mkdir -p /home/mcp/.config /app/data && chown -R mcp:mcp /home/mcp /app/data /app/portal

RUN chmod +x ./build/index.js

# Environment
ENV NODE_ENV=production
ENV MCP_CONFIG_DIR=/home/mcp/.config
ENV PORTAL_PORT=3000
ENV MCP_PORT=3001
ENV OTEL_SERVICE_NAME=aha-mcp-server
ENV OTEL_SERVICE_VERSION=1.0.0
ENV OTEL_INSTRUMENTATION_HTTP_ENABLED=true
ENV OTEL_INSTRUMENTATION_EXPRESS_ENABLED=true
ENV OTEL_INSTRUMENTATION_FS_ENABLED=false
ENV OTEL_LOGS_EXPORTER=console
ENV OTEL_TRACES_EXPORTER=console
ENV OTEL_METRICS_EXPORTER=console

# Copy startup script
COPY scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

USER mcp

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${MCP_PORT:-3001}/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./start.sh"]
