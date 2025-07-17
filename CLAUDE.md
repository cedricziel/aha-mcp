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

## Runtime Configuration

The server supports runtime configuration through three key parameters:

### Configuration Parameters

- **Company**: Aha.io company subdomain (e.g., "mycompany" for mycompany.aha.io)
- **Token**: Aha.io API token for authentication
- **Mode**: Transport mode - either "stdio" or "sse"

### Configuration Sources (Priority Order)

1. **Environment Variables** (highest priority)
   - `AHA_COMPANY` - Company subdomain
   - `AHA_TOKEN` - API token
   - `MCP_TRANSPORT_MODE` - Transport mode
   - `MCP_PORT` - Port for SSE mode (default: 3001)
   - `MCP_HOST` - Host for SSE mode (default: 0.0.0.0)

2. **Configuration File**
   - Located at `~/.aha-mcp-config.json`
   - Automatically created when using configuration tools
   - Token is obfuscated for basic security

3. **Defaults** (lowest priority)
   - Mode: "stdio"
   - Port: 3001
   - Host: "0.0.0.0"

### Command Line Usage

```bash
# Use configuration settings
aha-mcp

# Force stdio mode
aha-mcp --mode stdio

# Force SSE mode
aha-mcp --mode sse

# Custom SSE configuration
aha-mcp --mode sse --port 3000 --host localhost

# Show help
aha-mcp --help
```

### MCP Configuration Tools

The server includes three MCP tools for runtime configuration:

1. **configure_server** - Update server configuration
   ```json
   {
     "company": "mycompany",
     "token": "your-api-token",
     "mode": "sse",
     "port": 3000,
     "host": "localhost"
   }
   ```

2. **get_server_config** - View current configuration and validation status

3. **test_configuration** - Test Aha.io connection with current credentials

## Architecture

This is a Model Context Protocol (MCP) server that provides integration with Aha.io's API. The codebase follows a modular structure:

### Core Architecture

- **Entry Points**: Unified entry point (`src/index.ts`) supports both transport modes
- **Server Factory**: `src/server/server.ts` creates and configures the MCP server instance
- **Core Modules**: Split into tools, resources, prompts, and configuration in `src/core/`
- **Service Layer**: `src/core/services/` contains the Aha.io API integration
- **Configuration**: `src/core/config.ts` handles runtime configuration management

### Key Components

- **AhaService**: Singleton service class that wraps the `aha-js` library for API interactions
- **ConfigService**: Manages runtime configuration with file persistence and validation
- **Tools**: 41 MCP tools for Aha.io operations (CRUD, health checks, configuration)
- **Resources**: 40+ resource types for accessing Aha.io entities via URI schemes
- **Prompts**: 12 domain-specific workflow prompts with context-aware responses
- **Authentication**: Runtime configuration with environment variables and config file support

### Transport Layer

The server supports dual transport modes from a unified entry point:

- **Stdio**: Primary mode for MCP client integration (default)
- **SSE**: HTTP-based Server-Sent Events transport with Express.js and CORS support

### Configuration Management

The server includes comprehensive configuration management:

- **Runtime Updates**: Configuration changes apply immediately without restart
- **Validation**: Input validation and Aha.io connection testing
- **Persistence**: JSON file storage in user's home directory
- **Security**: Token obfuscation and secure credential handling
- **Priority System**: Environment variables → config file → defaults

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
