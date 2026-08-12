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
- `bun run test` - Run the test suite. Prefer this over a bare `bun test`: it passes
  `--env-file=/dev/null`, because Bun auto-loads `.env` and a populated `AHA_TOKEN` makes the
  suite issue live API calls against a real Aha account.
- `bun run mcpb:validate` - Validate `manifest.json` against the MCP bundle schema
- `bun run mcpb:pack` - Build and pack the Claude Desktop extension to `dist/aha-mcp.mcpb`

### Notes for changing the build

- There are **no native dependencies**, and it should stay that way. The bundle produced by
  `bun build` runs on its own; nothing is resolved from `node_modules` at runtime. Adding a
  native module reintroduces the failure that made every packaged artifact crash on startup,
  because `bindings` resolves the compiled `.node` relative to `build/index.js`. Verify with
  `node build/index.js --help` after any build change.
- Do not run the tests with a `--preload` setup file. Forcing `MockAhaService` in-process
  breaks the unit tests that patch the real `AhaService`; the e2e tests get the mock via
  `AHA_TOKEN=test-token` in the spawned server's environment instead.
- `src/core/uri-template.ts` vendors the still-unmerged upstream fix from
  modelcontextprotocol/typescript-sdk#1083. Delete it once that lands, not before -
  without it, resource URIs carrying query parameters do not match.
- `manifest.json`'s tool list must match what the server actually registers. Regenerate it
  from a running server rather than editing by hand, and keep prompts as
  `prompts_generated: true` - the schema requires a `text` field on any statically declared
  prompt, which the server generates at runtime instead.

### Search

Search goes through Aha's GraphQL API (`POST /api/v2/graphql`, `searchDocuments`), wrapped by
`src/core/services/aha-graphql.ts` and exposed as `aha_search`. GraphQL is undocumented in
Aha's REST docs and is not covered by `aha-js`, so `scripts/check-graphql.ts` exists to probe
what a given account and token can actually reach.

Behaviours measured against a live account, not documented upstream - keep the constants in
`aha-graphql.ts` in step if they change:

- `per` defaults to 20 and is clamped server-side to 10..200. Requests below 10 come back
  with 10, so the client raises them rather than promising something it will not deliver.
- `totalCount` saturates at 10000; surfaced as `total_count_is_capped`.
- `url` on a search hit is an app path (`/features/PRJ1-1`), not a URL. The client resolves
  it against the account host so `SearchHit.url` is always absolute and a client can open
  it. REST responses differ here - they already carry an absolute `url` (the web page) plus
  `resource` (the API endpoint), so nothing rewrites those.
- Argument and scoping errors arrive as GraphQL errors with an HTTP **200**. A genuine
  permission or licensing problem is an HTTP **403** - do not conflate them.
- Most other list queries (`goals`, `initiatives`, `keyResults`, ...) require a `filters`
  argument *and* a scoping id inside it; `filters: {}` is rejected.

A previous local-cache implementation (SQLite plus a placeholder embedding that hashed
character codes through `Math.sin()`) was removed in favour of this. Do not reintroduce
client-side "semantic" ranking without a real embedding model.

## Runtime Configuration

The server supports runtime configuration through three key parameters:

### Configuration Parameters

- **Company**: Aha.io company subdomain (e.g., "mycompany" for mycompany.aha.io)
- **Token**: Aha.io API token for authentication
- **Mode**: Transport mode - "stdio" or "streamable-http"

### Configuration Sources (Priority Order)

1. **Environment Variables** (highest priority)
   - `AHA_COMPANY` - Company subdomain
   - `AHA_TOKEN` - API token
   - `MCP_TRANSPORT_MODE` - Transport mode (stdio, streamable-http)
   - `MCP_PORT` - Port for HTTP-based transports (default: 3001)
   - `MCP_HOST` - Host for HTTP-based transports (default: 0.0.0.0)

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

# Force stdio mode (default, for local MCP clients)
aha-mcp --mode stdio

# Force Streamable HTTP mode (recommended for remote/web clients)
aha-mcp --mode streamable-http

# Custom Streamable HTTP configuration
aha-mcp --mode streamable-http --port 3000 --host localhost

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
     "mode": "streamable-http",
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

- **AhaService**: Singleton service class that wraps the `aha-js` library for REST interactions
- **AhaGraphQLClient**: `src/core/services/aha-graphql.ts`, for the GraphQL API that `aha-js`
  does not cover. Reads credentials via `AhaService.getCredentials()` so `configure_server`
  applies at runtime
- **ConfigService**: Manages runtime configuration with file persistence and validation
- **Tools**: 31 MCP tools (CRUD, search, health checks, configuration), none of which keep
  local state
- **Resources**: 40+ resource types for accessing Aha.io entities via URI schemes
- **Prompts**: 14 domain-specific workflow prompts with context-aware responses
- **Instructions**: `src/core/instructions.ts`, passed to `McpServer` and returned in the
  `initialize` response. The only always-on context the server gets - prompts need
  invoking and tool descriptions are per-tool - so it is where session-wide guidance
  lives: what Aha is, that `reference_num` rather than `id` is the identifier people
  recognise, and that records should be linked by their absolute `url`. It costs context
  in every session, so keep it to what a client cannot infer from the tool list, and treat
  it as guidance: clients differ in how prominently they surface it, and anything that
  must hold belongs in the data instead. `buildServerInstructions()` interpolates the
  configured company subdomain, which is fixed at `initialize` time - a later
  `configure_server` cannot revise instructions the client already holds, so never let
  anything depend on that host being current. Record `url`s always reflect live
  credentials.
- **Authentication**: Runtime configuration with environment variables and config file support

Tool, resource and prompt counts are also mirrored in `manifest.json` for the desktop
extension - regenerate that list from a running server rather than editing it by hand.

### Transport Layer

The server supports two transport modes from a unified entry point:

- **Stdio**: Primary mode for local MCP client integration (default)
- **Streamable HTTP**: Modern HTTP-based transport (recommended for remote/web clients)
  - Protocol version: 2025-06-18
  - Single `/mcp` endpoint for all communication
  - Supports both POST (client → server) and GET (server-sent event streaming)
  - Origin validation for security
  - Session management with cryptographic session IDs
  - Optional Bearer auth via `MCP_AUTH_TOKEN` (see `src/server/middleware/auth.ts`)

The legacy `sse` transport was removed. `--mode sse` and `MCP_TRANSPORT_MODE=sse` are mapped
to `streamable-http` with a warning by `normalizeTransportMode()` in `src/core/config.ts`, so
existing setups keep starting rather than failing. Do not reintroduce it: the SDK marks
`SSEServerTransport` as `@deprecated`, and the MCP spec deprecated it in 2025-03-26.

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

#### Tool annotations

Every tool is registered with an annotations argument, and the e2e suite fails if one is
missing. Conventions used here:

- `title` is a short human-readable label for client UIs.
- `readOnlyHint` is true only for tools that never write: `aha_search`, `server_status`,
  `get_server_config`, `server_health_check`, `test_configuration`.
- `destructiveHint` and `idempotentHint` are **omitted** when `readOnlyHint` is true - the
  spec only gives them meaning for writers.
- `destructiveHint: true` covers the deletes plus the two PUT endpoints that replace a whole
  collection: `aha_update_feature_tags` and `aha_associate_feature_with_goals` drop anything
  left out of the request.
- `openWorldHint: true` for anything that reaches Aha.io. That includes
  `server_health_check`, which calls `/me` when credentials are configured.
- `idempotentHint` is false for the `create_*` tools (a repeated call creates another record)
  and true for updates and associations.

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
- Support multiple transports (stdio, streamable-http) for flexibility
- Log usage appropriately for debugging and monitoring
- Design for human oversight and control of AI interactions

## Transport Migration

`sse` was removed after being deprecated in MCP spec 2025-03-26. If you have an old
configuration:

```bash
export MCP_TRANSPORT_MODE=streamable-http   # instead of sse
```

The server accepts `sse` and warns, mapping it to `streamable-http`. If you were talking HTTP
directly, the two SSE endpoints (`/sse` for GET, `/messages` for POST) are replaced by a
single `/mcp` endpoint handling both, with a `MCP-Protocol-Version: 2025-06-18` header and
session ids taken from the response headers.
