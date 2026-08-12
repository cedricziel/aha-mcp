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
  with `bun run manifest:sync`, which spawns the real server and copies `tools/list`
  verbatim, rather than editing by hand - `bun run manifest:check` fails without writing,
  for CI. Changing a tool's description in `src/core/tools.ts` and forgetting this leaves
  the desktop extension advertising the old behaviour. Keep prompts as
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

### Error handling

Aha's REST failures are mapped by `src/core/services/aha-errors.ts` rather than surfaced
raw. `aha-js` throws axios errors whose message is `Request failed with status code 403`,
which names neither what was refused nor why, and reads like a bug in this server.

- Tools call `describeAhaError(error)` in their catch branch. The existing per-tool prefix
  already names the operation, so the mapper only explains the status.
- Resources throw `toMcpError(error, uri.toString())`. A record the token cannot reach is
  `InvalidParams` (-32602), matching the SDK's own code for an unrecognised URI; only
  genuine server-side or unclassified failures stay `InternalError` (-32603). Letting a raw
  error escape produced -32603 for everything, which claims a server bug for what is
  usually a permissions problem.
- **404 must not be reported as "does not exist".** Aha returns 404 both for a missing
  record and for one the token cannot see, so the message says so. Do not tighten it.
- Errors this server raises itself (missing credentials and the like) pass through
  untouched - they already say what to do.
- Nothing retries. A 429 is reported with Aha's `retry_after` and the documented limits;
  whether to wait belongs to the caller.

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
- **Prompts**: 17 workflow prompts. Twelve template a question; five (`idea_triage`,
  `release_readiness`, `feature_description_draft`, `quarterly_roadmap_review`,
  `customer_demand_rollup`) instead tell the agent which tools and resources to reach for,
  and in what order. Those five deliberately fetch nothing themselves, so a prompt cannot
  fail or stall on the network
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
extension - regenerate that list with `bun run manifest:sync` rather than editing it by hand.

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

Tools carry a display title in **both** spec locations: top-level `title` (the current
field) and `annotations.title` (what pre-2025-06-18 clients read, and what the spec gives
precedence over `name`). They must stay identical; the e2e suite asserts it.

#### Tool output: `outputSchema` and `structuredContent`

Every tool declares an `outputSchema` and returns `structuredContent`. Schemas live in
`src/core/tool-output.ts`. Two rules there are load-bearing:

- **Anything wrapping an Aha record uses `z.looseObject`.** A raw Zod shape converts to
  `additionalProperties: false`, and the SDK *client* rejects a result carrying keys the
  schema does not list - which would break every record-returning tool on the first field
  Aha adds. Payloads the server builds itself (deletions, search, the server/config tools)
  are closed objects.
- **Only describe fields Aha reliably returns, permissively typed.** The server validates
  its own `structuredContent` and turns a mismatch into a protocol error, so a wrong guess
  about a field's type fails the call rather than degrading. Undescribed fields still reach
  the client verbatim.

`structuredContent` is always the record itself, never Aha's wrapper: `unwrapRecord()`
flattens the `{ idea: ... }` / `{ initiative: ... }` responses so one contract covers every
record type. A response with no body becomes `{}` - every record field is optional, whereas
a missing `structuredContent` fails output validation and sinks the call.

Tools that touch a single record also return a `resource_link` to its `aha://` URI via
`recordLinks()`, so a client can re-read current state instead of trusting the point-in-time
copy. No identifier, no link: a link to an unreadable URI is worse than none. Each link sets
`title` as well as `name` - hosts display `title` in preference - plus
`annotations.audience`, `priority: 1` and, when Aha's `updated_at` is plainly Zulu ISO 8601,
`lastModified`. The timestamp guard is deliberate: the SDK types that annotation as
`z.iso.datetime()`, which rejects a numeric offset, and a rejected annotation fails the whole
call where an omitted one costs only a hint.

`aha_search` deliberately emits **no** `resource_link`s. `recordLinks()` can only build URIs
for the five types with a single-record template in `resources.ts`, while search returns a
dozen or more - so linking would cover some hits and silently skip others in the same result
set, for no reason a client could see. Its hits already carry an absolute `url`, and `perPage`
goes to 200, so the alternative was up to 200 content blocks of partial coverage. Reconsider
only if the missing record types gain resource templates.

**The text block is a one-line summary, not a copy of the record.** `recordSummary()` builds
`Updated feature PRJ1-123 "Name" - https://...`; `aha_search` renders its hits as a markdown
link list. This block used to be the payload re-serialised with `JSON.stringify(x, null, 2)`,
which duplicated `structuredContent` verbatim - double the tokens, and nothing a client could
present as anything but a blob. The record still travels in `structuredContent` and the
`resource_link` is the durable pointer, so the text block's job is to say what happened in a
form a person and a model can both read. Building the search links server-side also keeps the
model from re-emitting - and mangling - URLs it only ever needed to pass through.

Tool descriptions state what comes back ("Returns the updated feature and a link to it").
Host-side rendering is decided by a model reading tool contracts, so a description that names
its output is the cheapest lever this server has over how a result is presented.

#### Tool errors

Failures return `isError: true` with a plain-text message, never a success-shaped result
whose body says `success: false` - clients render the latter as a successful call. Output
validation is skipped for `isError` results at both ends, which is what lets a tool with an
`outputSchema` report a failure at all.

#### Tool rate limiting

`src/core/rate-limit.ts` wraps `server.registerTool` so every tool spends a token from a
process-wide bucket first; refusals come back as `isError` results naming the seconds to
wait. It is installed in `startServer()` **before** any registration - tools registered
earlier would not be covered. The bucket is deliberately global rather than per-session:
what it protects is Aha's API, which all sessions share. Default 120/minute, set
`MCP_TOOL_RATE_LIMIT_PER_MINUTE` to change it or `0` to disable.

#### Schema dialects

Input and output schemas are advertised as draft-07, because `toJsonSchemaCompat` in the
SDK converts Zod with a hardcoded `draft-7` target and never passes `target` for tools. The
spec permits an explicit dialect and only *recommends* 2020-12, so this conforms; it changes
when the SDK lets the target through, not before. Zero-argument tools use
`z.strictObject({}).optional()` and emit no `$schema`, so they default to 2020-12 - and,
unlike the raw `{}` shape they replaced, they accept a `tools/call` with `arguments` omitted
entirely, which the spec allows. An e2e test pins the dialects so an SDK upgrade surfaces
here rather than in a client.

### Resources

- Use unique URIs for resource identification (e.g., `aha://idea/{id}`)
- Implement proper resource discovery through list/read patterns
- Validate resource access and handle missing resources gracefully
- Support both text and binary content types as needed

### Security & Validation

- Validate all inputs rigorously using Zod schemas
- Implement proper authentication via environment variables
- Rate limit tool invocations (`src/core/rate-limit.ts`), which the tools spec requires
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
