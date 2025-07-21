# Multi-stage Dockerfile for Aha MCP Server
# Stage 1: Build stage
FROM oven/bun:1.2-alpine AS builder

# Install build dependencies for native modules (sqlite-vec)
RUN apk add --no-cache \
    python3 \
    python3-dev \
    py3-setuptools \
    make \
    gcc \
    g++ \
    musl-dev \
    sqlite-dev \
    pkgconf

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies including native modules
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN bun run build

# Stage 2: Production stage
FROM oven/bun:1.2-alpine AS production

# Install runtime dependencies and build tools for native modules
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

# Create non-root user
RUN addgroup -g 1001 -S mcp && \
    adduser -S -u 1001 -G mcp mcp

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install only production dependencies in production stage
RUN bun install --frozen-lockfile --production --ignore-scripts

# Install OpenTelemetry auto-instrumentation separately (not in package.json)
RUN bun install @opentelemetry/auto-instrumentations-node

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Copy package.json for runtime metadata
COPY package.json ./
COPY package.json /package.json

# Create directory for configuration with proper permissions
RUN mkdir -p /home/mcp/.config && \
    chown -R mcp:mcp /home/mcp

# Copy the built entry point and make it executable
RUN chmod +x ./build/index.js

# Switch to non-root user
USER mcp

# Set environment variables
ENV NODE_ENV=production
ENV MCP_CONFIG_DIR=/home/mcp/.config

# OpenTelemetry configuration
ENV OTEL_SERVICE_NAME=aha-mcp-server
ENV OTEL_SERVICE_VERSION=1.0.0
ENV OTEL_INSTRUMENTATION_HTTP_ENABLED=true
ENV OTEL_INSTRUMENTATION_EXPRESS_ENABLED=true
ENV OTEL_INSTRUMENTATION_FS_ENABLED=false
ENV OTEL_LOGS_EXPORTER=console
ENV OTEL_TRACES_EXPORTER=console
ENV OTEL_METRICS_EXPORTER=console

# Expose port for SSE mode (default 3001)
EXPOSE 3001

# Health check for SSE mode
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD if [ "$MCP_TRANSPORT_MODE" = "sse" ]; then \
        wget --no-verbose --tries=1 --spider http://localhost:${MCP_PORT:-3001}/health || exit 1; \
      else \
        echo "stdio mode - no health check needed"; \
      fi

# Use tini for proper signal handling with OpenTelemetry auto-instrumentation
ENTRYPOINT ["/sbin/tini", "--", "node", "--require", "@opentelemetry/auto-instrumentations-node/register", "./build/index.js"]

# Default command is now part of entrypoint
CMD []