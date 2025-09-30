#!/bin/bash
set -e

echo "Setting up Copilot environment for aha-mcp..."

# Install Bun (using the official installation script)
echo "Installing Bun..."
curl -fsSL https://bun.sh/install | bash

# Add Bun to PATH for the current session
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Verify Bun installation
echo "Verifying Bun installation..."
bun --version

# Install project dependencies
echo "Installing project dependencies..."
bun install --frozen-lockfile

# Set up test environment variables
echo "Setting up test environment variables..."
export NODE_ENV=test
export AHA_COMPANY=test-company
export AHA_TOKEN=test-token

echo "✓ Copilot environment setup complete!"
echo "  - Bun version: $(bun --version)"
echo "  - Node version: $(node --version)"
echo "  - Dependencies installed"
echo "  - Test environment configured"
