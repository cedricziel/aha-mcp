#!/bin/bash
# Start both the Portal server (port 3000) and the MCP HTTP server (port 3001)
# Uses the shell & operator to run both processes; tini handles signal forwarding.

set -e

echo "Starting Aha MCP Portal on port ${PORTAL_PORT:-3000}..."
node --require @opentelemetry/auto-instrumentations-node/register ./build/portal/portal-server.js &
PORTAL_PID=$!

echo "Starting Aha MCP Server on port ${MCP_PORT:-3001}..."
node --require @opentelemetry/auto-instrumentations-node/register ./build/index.js --mode sse &
MCP_PID=$!

echo "Both services started (portal: $PORTAL_PID, mcp: $MCP_PID)"

# Wait for either process to exit
wait -n $PORTAL_PID $MCP_PID
EXIT_CODE=$?

echo "A service exited with code $EXIT_CODE — shutting down..."
kill $PORTAL_PID $MCP_PID 2>/dev/null || true
exit $EXIT_CODE
