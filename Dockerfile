# Multi-stage Dockerfile for Aha MCP Server
# Stage 1: Build stage
FROM oven/bun:1.2-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN bun run build

# Stage 2: Production stage
FROM oven/bun:1.2-alpine AS production

# Install necessary packages for production
RUN apk add --no-cache tini wget

# Create non-root user
RUN addgroup -g 1001 -S mcp && \
    adduser -S -u 1001 -G mcp mcp

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production --ignore-scripts

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

# Expose port for SSE mode (default 3001)
EXPOSE 3001

# Health check for SSE mode
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD if [ "$MCP_TRANSPORT_MODE" = "sse" ]; then \
        wget --no-verbose --tries=1 --spider http://localhost:${MCP_PORT:-3001}/health || exit 1; \
      else \
        echo "stdio mode - no health check needed"; \
      fi

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "bun", "./build/index.js"]

# Default command is now part of entrypoint
CMD []