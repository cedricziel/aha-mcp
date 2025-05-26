# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `bun install` - Install dependencies
- `bun start` - Start the MCP server with stdio transport
- `bun run dev` - Start server in development mode with auto-reload (stdio)
- `bun run start:http` - Start the HTTP server
- `bun run dev:http` - Start HTTP server in development mode with auto-reload
- `bun build` - Build the stdio server for production
- `bun run build:http` - Build the HTTP server for production

## Architecture

This is a Model Context Protocol (MCP) server that provides integration with Aha.io's API. The codebase follows a modular structure:

### Core Architecture

- **Entry Points**: Two transport modes supported - stdio (`src/index.ts`) and HTTP (`src/server/http-server.ts`)
- **Server Factory**: `src/server/server.ts` creates and configures the MCP server instance
- **Core Modules**: Split into tools, resources, and prompts in `src/core/`
- **Service Layer**: `src/core/services/` contains the Aha.io API integration

### Key Components

- **AhaService**: Singleton service class that wraps the `aha-js` library for API interactions
- **Tools**: Six MCP tools for Aha.io operations (initialize, list/get features, list users/epics, create comments)
- **Resources**: Single resource type for accessing ideas via `aha://idea/{id}` URI scheme
- **Authentication**: Supports both environment variables (`AHA_TOKEN`, `AHA_COMPANY`) and runtime initialization

### Transport Layer

The server supports dual transport modes:

- **Stdio**: Primary mode for MCP client integration (default)
- **HTTP**: Alternative transport with Express.js and CORS support

### Configuration Requirements

Environment variables for Aha.io integration:

- `AHA_COMPANY`: Subdomain for your Aha.io instance
- `AHA_TOKEN`: API token for authentication

### Naming Convention

All MCP tools, resources, and prompts use underscore naming (e.g., `aha_list_features`) instead of hyphens for Cursor compatibility.

## MCP Best Practices

When working with this MCP server, follow these key principles from the Model Context Protocol specification:

### Tools

- Provide clear, descriptive names and descriptions for all tools
- Use JSON Schema with Zod for parameter validation
- Include proper error handling with meaningful error messages
- Return structured responses with appropriate content types
- Use annotations to describe tool behaviors and side effects

### Resources

- Use unique URIs for resource identification (e.g., `aha://idea/{id}`)
- Implement proper resource discovery through list/read patterns
- Validate resource access and handle missing resources gracefully
- Support both text and binary content types as needed

### Security & Validation

- Validate all inputs rigorously using Zod schemas
- Implement proper authentication via environment variables
- Rate limit API requests to external services
- Sanitize user inputs before API calls
- Handle errors without exposing internal implementation details

### Development Guidelines

- Use the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`)
- Follow JSON-RPC 2.0 message format for all communications
- Support both stdio and HTTP transports for flexibility
- Log usage appropriately for debugging and monitoring
- Design for human oversight and control of AI interactions
