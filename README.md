# Aha MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6)
![MCP](https://img.shields.io/badge/MCP-1.7+-green)

A Model Context Protocol (MCP) server that provides seamless integration with Aha.io's product management platform. Features offline database synchronization, vector embeddings for semantic search, and comprehensive workflow automation.

## 🔧 Client Configuration

### Claude Desktop Extension (easiest)

Download `aha-mcp-v<version>.mcpb` from the [latest release](https://github.com/cedricziel/aha-mcp/releases/latest)
and open it with Claude Desktop, which will prompt you for your Aha.io subdomain and API
token. No Node.js or Docker setup and no manual JSON editing required.

The extension exposes 39 tools that query Aha.io directly, so results are always current and
nothing is stored locally. Cross-record search is served by Aha.io's own index — see
[Search](#-search).

### Claude Desktop Configuration

To use this MCP server with Claude Desktop, add the following to your `claude_desktop_config.json`:

**Using npx:**
```json
{
  "mcpServers": {
    "aha": {
      "command": "npx",
      "args": ["@cedricziel/aha-mcp"],
      "env": {
        "AHA_COMPANY": "your-company",
        "AHA_TOKEN": "your-api-token"
      }
    }
  }
}
```

**Using Docker:**
```json
{
  "mcpServers": {
    "aha": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "AHA_COMPANY=your-company",
        "-e", "AHA_TOKEN=your-api-token",
        "ghcr.io/cedricziel/aha-mcp"
      ]
    }
  }
}
```

> **Note:** Replace `your-company` and `your-api-token` with your actual Aha.io subdomain and API token.

## 🚀 Getting Started

### Quick Start with npx

You can run the MCP server directly using npx without installing it globally:

```bash
# Set environment variables
export AHA_COMPANY="your-company"  # Your Aha.io subdomain
export AHA_TOKEN="your-api-token"   # Your Aha.io API token

# Run the server
npx @cedricziel/aha-mcp
```

### Quick Start with Docker

You can also run the MCP server using Docker:

```bash
# Set environment variables
export AHA_COMPANY="your-company"  # Your Aha.io subdomain
export AHA_TOKEN="your-api-token"   # Your Aha.io API token

# Run in stdio mode (default)
docker run --rm -e AHA_COMPANY="$AHA_COMPANY" -e AHA_TOKEN="$AHA_TOKEN" ghcr.io/cedricziel/aha-mcp

# Run in Streamable HTTP mode (recommended for remote access)
docker run --rm -p 3001:3001 -e AHA_COMPANY="$AHA_COMPANY" -e AHA_TOKEN="$AHA_TOKEN" ghcr.io/cedricziel/aha-mcp --mode streamable-http

```

### Development Setup

1. Install [Bun](https://bun.sh/) if you haven't already:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Configure environment variables:
   ```bash
   export AHA_COMPANY="your-company"  # Your Aha.io subdomain
   export AHA_TOKEN="your-api-token"   # Your Aha.io API token
   ```

4. Start the server:
   ```bash
   # Start the stdio server (for MCP clients - default)
   bun start

   # Or start with Streamable HTTP (recommended for remote access)
   bun start -- --mode streamable-http

   # Or start the HTTP server (legacy entry point)
   bun run start:http
   ```

5. For development with auto-reload:
   ```bash
   # Development mode with stdio
   bun run dev

   # Development mode with Streamable HTTP
   bun run dev -- --mode streamable-http

   # Development mode with HTTP (legacy)
   bun run dev:http
   ```

## 🔌 Aha.io Integration

This MCP server provides hybrid integration with Aha.io through both live API access and offline database synchronization. The server automatically maintains a local SQLite database with your Aha.io data, enabling faster queries, offline access, and advanced semantic search capabilities.

### Architecture Overview

- **Hybrid Data Access**: Live API calls for real-time data + offline SQLite database for performance
- **Background Sync**: Automatic synchronization of Aha.io entities to local database
- **Vector Embeddings**: Semantic search using sentence transformers and SQLite vector extensions
- **Real-time Progress**: Background job monitoring with detailed progress tracking
- **Configuration Management**: Runtime configuration without server restarts

### Configuration

The Aha.io integration can be configured using multiple methods, with the following priority order:

1. **Environment Variables** (highest priority)
2. **Configuration File** (`~/.aha-mcp-config.json`)
3. **Default Values** (lowest priority)

#### Environment Variables

- `AHA_COMPANY`: Your Aha.io subdomain (e.g., `mycompany` for `mycompany.aha.io`)
- `AHA_TOKEN`: Your Aha.io API token (for API token authentication)
- `AHA_ACCESS_TOKEN`: Your OAuth 2.0 access token (for OAuth authentication)
- `MCP_TRANSPORT_MODE`: Transport mode (`stdio` or `streamable-http`)
- `MCP_PORT`: Port number for HTTP-based modes (default: 3001)
- `MCP_HOST`: Host address for HTTP-based modes (default: 0.0.0.0)
- `MCP_AUTH_TOKEN`: Authentication token for HTTP-based modes (optional)
- `MCP_TOOL_RATE_LIMIT_PER_MINUTE`: Tool calls allowed per minute (default: 120, `0` disables)

#### Transport Modes

The server supports two transport modes:

1. **stdio**: Standard input/output mode for MCP client integration (default)
2. **streamable-http**: HTTP transport (MCP protocol 2025-06-18), for remote and web clients

Example usage:
```bash
# Stdio mode (default)
aha-mcp

# Streamable HTTP mode
aha-mcp --mode streamable-http --port 3001
```

> **Removed:** the `sse` transport was deprecated in MCP spec 2025-03-26 and has been
> removed. `MCP_TRANSPORT_MODE=sse` and `--mode sse` now fall back to `streamable-http`
> with a warning, so existing configurations keep starting.

#### Authentication (HTTP transport)

The `streamable-http` transport supports optional Bearer token authentication:

##### Environment Variable Configuration

```bash
# Set authentication token
export MCP_AUTH_TOKEN="your-secure-token-here"

# Start server with authentication
aha-mcp --mode streamable-http --port 3001
```

##### Client Authentication

When authentication is enabled, clients must include a Bearer token in the Authorization
header. All MCP traffic goes to the single `/mcp` endpoint:

```bash
curl -X POST \
     -H "Authorization: Bearer your-secure-token-here" \
     -H "Content-Type: application/json" \
     -H "MCP-Protocol-Version: 2025-06-18" \
     -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' \
     http://localhost:3001/mcp
```

Most callers should use an MCP client library rather than raw HTTP; pass the token as an
`Authorization` header when constructing the transport.

##### Security Notes

- **Opt-in**: Authentication is optional. If `MCP_AUTH_TOKEN` is not set, all requests are allowed.
- **Token Security**: Use strong, randomly generated tokens (minimum 8 characters).
- **HTTPS**: In production, always use HTTPS to protect tokens in transit.
- **Token Storage**: Tokens are obfuscated (base64 encoded) in the configuration file but should be treated as sensitive data.

##### Checking Authentication Status

```bash
curl http://localhost:3001/

# Response includes:
# {
#   "authentication": {
#     "enabled": true,
#     "type": "Bearer token"
#   }
# }
```

#### Configuration Management Tools

The server provides three MCP tools for configuration management:

1. **configure_server**: Update server settings at runtime
2. **get_server_config**: View current configuration and validation status
3. **test_configuration**: Test API connectivity with current settings

These tools allow you to manage configuration without restarting the server, making it easy to switch between different Aha.io accounts or update credentials.

### Database Synchronization

The server maintains a local SQLite database with your Aha.io data for improved performance and offline access.

#### Sync Management Tools

- `aha_sync_start`: Start background synchronization of specified entity types
- `aha_sync_status`: Check the status and progress of sync jobs
- `aha_sync_stop`: Stop a running sync job
- `aha_sync_pause`: Pause a sync job (can be resumed later)
- `aha_sync_resume`: Resume a paused sync job
- `aha_sync_history`: View detailed history of sync operations
- `aha_sync_health`: Get overall sync service health status
- `aha_database_health`: Check database connectivity and statistics
- `aha_database_cleanup`: Clean up old sync jobs and optimize database

#### Sync Features

- **Entity Types**: Sync features, products, ideas, epics, initiatives, releases, goals, users, comments
- **Progress Tracking**: Real-time progress updates with detailed statistics
- **Error Handling**: Comprehensive error logging and recovery mechanisms
- **Batch Processing**: Configurable batch sizes for optimal performance
- **Incremental Updates**: Support for `updatedSince` filtering to sync only recent changes
- **Concurrent Operations**: Multiple sync jobs can run simultaneously

#### Example Sync Workflow

```bash
# Start syncing features and products
aha_sync_start --entities features,products --batchSize 50

# Check progress
aha_sync_status --jobId sync-abc123

# View sync history
aha_sync_history --jobId sync-abc123 --limit 20

# Check overall health
aha_sync_health
```

### Semantic Search & Embeddings

The server includes advanced semantic search capabilities using vector embeddings.

#### Embedding Management Tools

- `aha_generate_embeddings`: Generate vector embeddings for entity text content
- `aha_embedding_status`: Check the status of embedding generation jobs
- `aha_semantic_search`: Search entities using natural language queries
- `aha_generate_entity_embedding`: Generate embedding for a specific entity
- `aha_find_similar`: Find entities similar to a given entity
- `aha_pause_embeddings`: Pause embedding generation jobs
- `aha_stop_embeddings`: Stop embedding generation jobs

#### Semantic Search Features

- **Vector Storage**: Embeddings stored in SQLite with sqlite-vec extension
- **Multiple Models**: Support for different embedding models (default: all-MiniLM-L6-v2)
- **Similarity Search**: Cosine similarity search with configurable thresholds
- **Cross-Entity Search**: Find similar content across different entity types
- **Real-time Generation**: Background embedding generation with progress tracking

#### Example Embedding Workflow

```bash
# Generate embeddings for features and ideas
aha_generate_embeddings --entities features,ideas --batchSize 25

# Search for similar content
aha_semantic_search --query "user authentication security" --threshold 0.7

# Find similar features to a specific feature
aha_find_similar --entityType features --entityId FEAT-123 --limit 5

# Check embedding job progress
aha_embedding_status --jobId embed-xyz789
```

### Available Resources

#### Individual Entity Resources
- `aha_idea`: Access individual ideas using `aha://idea/{id}`
- `aha_feature`: Access individual features using `aha://feature/{id}`
- `aha_user`: Access individual users using `aha://user/{id}`
- `aha_epic`: Access individual epics using `aha://epic/{id}`
- `aha_product`: Access individual products using `aha://product/{id}`
- `aha_initiative`: Access individual initiatives using `aha://initiative/{id}`
- `aha_requirement`: Access individual requirements using `aha://requirement/{id}`
- `aha_competitor`: Access individual competitors using `aha://competitor/{id}`
- `aha_todo`: Access individual todos using `aha://todo/{id}`

#### Collection Resources
- `aha_features`: List features with optional filtering using `aha://features?query=...&tag=...`
- `aha_users`: List all users using `aha://users`
- `aha_epics`: List epics for a product using `aha://epics/{product_id}`
- `aha_products`: List all products using `aha://products?updatedSince=...`
- `aha_initiatives`: List all initiatives using `aha://initiatives?query=...&onlyActive=true`
- `aha_ideas`: List all ideas globally using `aha://ideas?query=...&status=...&category=...`
- `aha_ideas_by_product`: List ideas for a product using `aha://ideas/{product_id}?query=...&spam=false&sort=recent`
- `aha_competitors`: List competitors for a product using `aha://competitors/{product_id}`
- `aha_product_releases`: List releases for a product using `aha://releases/{product_id}?query=...&status=...`
- `aha_initiative_epics`: List epics for an initiative using `aha://initiative/{initiative_id}/epics`

#### Comment Resources
- `aha_feature_comments`: Access comments for a feature using `aha://comments/feature/{feature_id}`
- `aha_epic_comments`: Access comments for an epic using `aha://comments/epic/{epic_id}`
- `aha_idea_comments`: Access an idea's **internal** comments using `aha://comments/idea/{idea_id}`
- `aha_idea_portal_comments`: Access an idea's **ideas-portal** comments using `aha://idea-comments/{idea_id}` — different records from the above, including anything a customer wrote
- `aha_initiative_comments`: Access comments for an initiative using `aha://comments/initiative/{initiative_id}`
- `aha_product_comments`: Access comments for a product using `aha://comments/product/{product_id}`
- `aha_goal_comments`: Access comments for a goal using `aha://comments/goal/{goal_id}`
- `aha_release_comments`: Access comments for a release using `aha://comments/release/{release_id}`
- `aha_release_phase_comments`: Access comments for a release phase using `aha://comments/release-phase/{release_phase_id}`
- `aha_requirement_comments`: Access comments for a requirement using `aha://comments/requirement/{requirement_id}`
- `aha_todo_comments`: Access comments for a todo using `aha://comments/todo/{todo_id}`

#### Goal Resources
- `aha_goal`: Access individual goals using `aha://goal/{goal_id}`
- `aha_goals`: List all goals using `aha://goals`
- `aha_goal_epics`: Access epics associated with a goal using `aha://goal/{goal_id}/epics`

#### Release Resources
- `aha_release`: Access individual releases using `aha://release/{release_id}`
- `aha_releases`: List all releases using `aha://releases`
- `aha_release_features`: Access features associated with a release using `aha://release/{release_id}/features`
- `aha_release_epics`: Access epics associated with a release using `aha://release/{release_id}/epics`
- `aha_release_phase`: Access individual release phases using `aha://release-phase/{release_phase_id}`
- `aha_release_phases`: List all release phases using `aha://release-phases`

#### Custom Fields Resources
- `aha_custom_fields`: List all custom field definitions using `aha://custom-fields`
- `aha_custom_field_options`: Access options for a custom field using `aha://custom-field/{custom_field_id}/options`

#### Resource URI Examples
```
# Individual Entity Resources
aha://idea/IDEA-123               # Get specific idea
aha://feature/PROJ-456            # Get specific feature
aha://user/USER-789               # Get specific user
aha://epic/EPIC-101               # Get specific epic
aha://product/PROD-001            # Get specific product
aha://initiative/INIT-202         # Get specific initiative
aha://requirement/REQ-666         # Get specific requirement
aha://competitor/COMP-444         # Get specific competitor
aha://todo/TODO-777               # Get specific todo

# Collection Resources (enhanced with filtering)
aha://features?query=auth&tag=api&assignedToUser=user@example.com # Search features
aha://users                       # List all users
aha://epics/PROJ-001              # List epics for product
aha://products?updatedSince=2024-01-01T00:00:00Z # List products with filter
aha://initiatives?query=mobile&onlyActive=true&assignedToUser=user@example.com # Search initiatives
aha://ideas?query=nodejs&status=new&category=enhancement # List ideas globally with filters
aha://ideas/PROJ-001?query=search&spam=false&sort=recent&tag=enhancement # List ideas with filters
aha://competitors/PROJ-001        # List competitors for product
aha://releases/PROJ-001?query=mobile&status=shipped # List releases for product
aha://initiative/INIT-123/epics   # List epics for initiative

# Comment Resources
aha://comments/feature/PRJ1-123   # Get comments for feature
aha://comments/epic/EPIC-123      # Get comments for epic
aha://comments/idea/IDEA-456      # Get an idea's internal comments
aha://idea-comments/IDEA-456      # Get an idea's ideas-portal comments
aha://comments/initiative/INIT-789 # Get comments for initiative
aha://comments/product/PROD-001   # Get comments for product
aha://comments/goal/GOAL-555      # Get comments for goal
aha://comments/release/REL-333    # Get comments for release
aha://comments/release-phase/RP-444 # Get comments for release phase
aha://comments/requirement/REQ-666 # Get comments for requirement
aha://comments/todo/TODO-777      # Get comments for todo

# Goal Resources
aha://goal/GOAL-123               # Get specific goal
aha://goals                       # List all goals
aha://goal/GOAL-456/epics         # Get epics for goal

# Release Resources
aha://release/REL-123             # Get specific release
aha://releases                    # List all releases
aha://release/REL-456/features    # Get features for release
aha://release/REL-456/epics       # Get epics for release
aha://release-phase/RP-123        # Get specific release phase
aha://release-phases              # List all release phases

# Custom Fields Resources
aha://custom-fields               # List all custom field definitions
aha://custom-field/CF-123/options # Get options for custom field
```

### Available Tools

**Note**: List operations are handled through MCP resources. Tools cover search, single-record
reads, write operations and relationship management.

#### Record Read Tools
- `aha_get_feature`: Read one feature, including workflow status, release, assignee, tags, score and custom field values
- `aha_get_epic`: Read one epic
- `aha_get_idea`: Read one idea
- `aha_get_initiative`: Read one initiative
- `aha_get_release`: Read one release

These return the full record as `structuredContent`. They duplicate what
`aha://feature/{id}` and friends already serve, deliberately: a client is free to surface
resources to its model or not, and several do not — on those, every read here was
unreachable, leaving write tools with no way to see what they were about to replace.
`aha_search` is not a substitute, as it cannot return per-record fields.

#### Write Operation Tools
- `aha_create_feature_comment`: Create a comment on a feature
- `aha_create_initiative_in_product`: Create an initiative within a specific product

#### Feature CRUD Tools
- `aha_create_feature`: Create a feature within a specific release
- `aha_update_feature`: Update a feature
- `aha_delete_feature`: Delete a feature
- `aha_update_feature_progress`: Update a feature's progress
- `aha_update_feature_score`: Update a feature's score
- `aha_update_feature_custom_fields`: Update a feature's custom fields

#### Epic CRUD Tools
- `aha_update_epic`: Update an epic
- `aha_delete_epic`: Delete an epic
- `aha_create_epic_in_product`: Create an epic within a specific product
- `aha_create_epic_in_release`: Create an epic within a specific release

#### Idea CRUD Tools
- `aha_create_idea`: Create an idea in a product
- `aha_create_idea_with_category`: Create an idea with a category
- `aha_create_idea_with_score`: Create an idea with a score
- `aha_delete_idea`: Delete an idea

#### Competitor Management Tools
- `aha_create_competitor`: Create a competitor in a product
- `aha_update_competitor`: Update a competitor
- `aha_delete_competitor`: Delete a competitor

#### Portal Integration Tools
- `aha_create_idea_by_portal_user`: Create an idea by a portal user
- `aha_create_idea_with_portal_settings`: Create an idea with enhanced portal settings

#### Relationship Management Tools
- `aha_associate_feature_with_epic`: Associate a feature with an epic
- `aha_move_feature_to_release`: Move a feature to a different release
- `aha_associate_feature_with_goals`: Associate a feature with multiple goals
- `aha_update_feature_tags`: Update tags for a feature

**Note**: reads are offered through both interfaces, by design:
- **Resources** cover the full read surface — every entity type, with filtering through URI parameters, and lists as well as single records
- **Tools** cover writes (create/update/delete), relationship management (associate/move), search, and single-record reads for the five most-written types

The overlap is deliberate. Resources are the richer read surface, but the MCP spec leaves it
to each client whether to expose them to its model, and tool-only clients are common. Keeping
reads tool-accessible for the types that have write tools is what stops an agent from changing
a field it cannot see.

### 🚀 Phase 8 - Complete CRUD Operations & Advanced Features

The MCP server now provides comprehensive lifecycle management for Aha.io entities with complete CRUD operations, portal integration, and advanced workflow features:

#### Phase 8A - Core CRUD Operations (18 Tools)
**Feature Management (6 Tools)**
- `aha_create_feature`: Create features within releases
- `aha_update_feature`: Update existing features
- `aha_delete_feature`: Delete features
- `aha_update_feature_progress`: Update feature progress (0-100%)
- `aha_update_feature_score`: Update feature scores
- `aha_update_feature_custom_fields`: Update feature custom fields

**Epic Management (2 Tools)**
- `aha_update_epic`: Update existing epics
- `aha_delete_epic`: Delete epics

**Idea Management (4 Tools)**
- `aha_create_idea`: Create ideas in products
- `aha_create_idea_with_category`: Create ideas with categories
- `aha_create_idea_with_score`: Create ideas with scores
- `aha_delete_idea`: Delete ideas

#### Phase 8B - Competitor Management (3 Tools)
**Competitor Management (3 Tools)**
- `aha_create_competitor`: Create competitors in products
- `aha_update_competitor`: Update existing competitors
- `aha_delete_competitor`: Delete competitors

**Note**: Initiative data access is now handled through MCP resources (`aha_initiative`, `aha_initiatives`, `aha_initiative_comments`, `aha_initiative_epics`) for a cleaner separation between read and write operations.

#### Phase 8C - Portal Integration & Advanced Features (2 Tools)
**Portal Integration**
- `aha_create_idea_by_portal_user`: Create ideas by portal users
- `aha_create_idea_with_portal_settings`: Create ideas with portal settings

#### Enhanced Filtering & Resources
- **Initiative Filtering**: Enhanced with `query`, `updatedSince`, `assignedToUser`, `onlyActive` parameters
- **Portal Configuration**: Support for `skip_portal` and `submitted_idea_portal_id` settings
- **Comprehensive Entity Coverage**: Full CRUD operations for features, epics, ideas, and competitors

#### Technical Achievements
- **39 MCP tools**, all querying Aha.io directly — no local state
- **17 listed MCP resources** covering the entity set, plus templated resource URIs
- **17 domain-specific prompts** (workflow automation)
- **25 core CRUD and write operation tools** for complete lifecycle management
- **Cross-record search** over Aha's own index, covering 20 record types
- **5 single-record read tools**, so a write can be checked against the record's current state on clients that do not surface resources
- **Comment reads and writes** on every record type Aha supports, with an idea's ideas-portal conversation handled as its own stream
- **5 server configuration tools** for runtime configuration
- **457 tests passing** with comprehensive service coverage
- **No native dependencies**, so the server runs anywhere Node does
- **Comprehensive error handling** with proper Zod schema validation

## 🔍 Search

`aha_search` queries Aha.io's own search index through the GraphQL API
(`POST /api/v2/graphql`, `searchDocuments`). Nothing is cached locally, so results are
always current and no native dependencies or writable storage are required.

```jsonc
// Everything matching "alerting", any record type
{ "query": "alerting" }

// Ideas only, within one workspace
{ "query": "alerting", "recordTypes": ["Idea"], "workspaceId": "7387509120724661690" }

// Sweep a workspace broadly: alternatives, because there is no match-all
{ "query": "a* OR e* OR i* OR o* OR u*", "recordTypes": ["Idea"], "workspaceId": "7387509120724661690" }
```

**What it matches:** record names and descriptions. Comment bodies match too, surfacing as
`Comment` hits that link to their parent record.

**Query syntax:** `term*` for prefix matching, `AND` / `OR` / `NOT`, and `"quoted phrases"`.

**There is no match-all query.** A bare `*` is rejected: on its own Aha returns an arbitrary
subset for it, and combined with `workspaceId` it returns nothing at all — an empty result
that reads like an empty workspace. Search for a term, or enumerate a workspace through the
list resources (`aha://features`, `aha://ideas/{product_id}`) instead of searching it.

**What it does not return:** workflow status, release membership, assignee or custom field
values. Aha's `searchDocuments` cannot select per-type fields, so a hit carries only its
name, type, id, workspace, URL and `updated_at`. Read the record itself for anything else:

```jsonc
{ "featureId": "PRJ1-123" }   // aha_get_feature — full record, including custom fields
```

**Record types** (`recordTypes`, omit to search all):

```
BusinessModel · Comment · Competitor · Epic · Feature · Goal · Idea · IdeaOrganization
IdeaTheme · IdeaUser · Initiative · KeyResult · Page · Persona · Project · Release
ReleasePhase · Requirement · StrategicPositioning · Task
```

**Paging:** `perPage` accepts 10–200 and defaults to 20 — Aha raises anything below 10.
`total_count` stops counting at 10,000, reported as `total_count_is_capped: true`.

Use `scripts/check-graphql.ts` to confirm what your own account and token can reach:

```bash
AHA_COMPANY=mycompany AHA_TOKEN=... bun run scripts/check-graphql.ts
```

### Why not local embeddings?

Earlier versions synced Aha into SQLite and ranked results with a local "semantic search".
That has been removed. The embedding function hashed character codes through `Math.sin()`,
so it carried no semantic signal and its similarity scores were not interpretable. It also
required the native `sqlite3` module and a writable data directory, which is what broke it
in packaged installs. Aha's server-side index is keyword-based but real, always current, and
free of all that machinery.

Aha also hosts its own MCP server at `https://<yourcompany>.aha.io/api/v1/mcp`.

## 🛠️ Adding Custom Tools and Resources

When adding custom tools, resources, or prompts to your MCP server:

1. Use underscores (`_`) instead of hyphens (`-`) in all resource, tool, and prompt names
   ```typescript
   // Good: Uses underscores
   server.tool(
     "my_custom_tool",
     "Description of my custom tool",
     {
       param_name: z.string().describe("Parameter description")
     },
     async (params) => {
       // Tool implementation
     }
   );

   // Bad: Uses hyphens, may cause issues with Cursor
   server.tool(
     "my-custom-tool",
     "Description of my custom tool",
     {
       param-name: z.string().describe("Parameter description")
     },
     async (params) => {
       // Tool implementation
     }
   );
   ```

2. This naming convention ensures compatibility with Cursor and other AI tools that interact with your MCP server

## 🐳 Docker Usage

### Docker Images

The Aha MCP server is available as Docker images on GitHub Container Registry:

- **GitHub Container Registry**: `ghcr.io/cedricziel/aha-mcp`

### Running with Docker

#### Basic Usage

```bash
# Run in stdio mode (default)
docker run --rm \
  -e AHA_COMPANY="your-company" \
  -e AHA_TOKEN="your-api-token" \
  ghcr.io/cedricziel/aha-mcp

# Run in Streamable HTTP mode
docker run --rm \
  -p 3001:3001 \
  -e AHA_COMPANY="your-company" \
  -e AHA_TOKEN="your-api-token" \
  ghcr.io/cedricziel/aha-mcp --mode streamable-http

# Run in Streamable HTTP mode with authentication
docker run --rm \
  -p 3001:3001 \
  -e AHA_COMPANY="your-company" \
  -e AHA_TOKEN="your-api-token" \
  -e MCP_AUTH_TOKEN="your-secure-token" \
  ghcr.io/cedricziel/aha-mcp --mode streamable-http
```

#### Persistent Configuration

To persist configuration between runs:

```bash
# Create a named volume for configuration
docker volume create aha-mcp-config

# Run with persistent configuration
docker run --rm \
  -v aha-mcp-config:/home/mcp/.config \
  -e AHA_COMPANY="your-company" \
  -e AHA_TOKEN="your-api-token" \
  ghcr.io/cedricziel/aha-mcp
```

#### Using Docker Compose

The repository includes a `docker-compose.yml` file for easy setup:

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your credentials
AHA_COMPANY=your-company
AHA_TOKEN=your-api-token

# Run in stdio mode
docker-compose --profile stdio up

# Run in Streamable HTTP mode
docker-compose --profile http up

# Run in detached mode
docker-compose --profile http up -d
```

Example `.env` file:
```env
AHA_COMPANY=mycompany
AHA_TOKEN=your-api-token-here
MCP_AUTH_TOKEN=your-secure-token-here
```

### Docker Environment Variables

The Docker image supports all the same environment variables as the npm package:

| Variable | Description | Default |
|----------|-------------|---------|
| `AHA_COMPANY` | Aha.io company subdomain | - |
| `AHA_TOKEN` | Aha.io API token | - |
| `MCP_TRANSPORT_MODE` | Transport mode (`stdio` or `streamable-http`) | `stdio` |
| `MCP_PORT` | Port for streamable-http mode | `3001` |
| `MCP_HOST` | Host for streamable-http mode | `0.0.0.0` |
| `MCP_AUTH_TOKEN` | Bearer token for the streamable-http transport | - |
| `MCP_TOOL_RATE_LIMIT_PER_MINUTE` | Tool calls allowed per minute (`0` disables) | `120` |
| `MCP_CONFIG_DIR` | Configuration directory | `/home/mcp/.config` |

### Health Checks

The Docker image includes health checks for streamable-http mode:

```bash
# Check if the HTTP server is healthy
curl http://localhost:3001/health

# Get detailed server status
curl http://localhost:3001/status
```

### Building from Source

To build the Docker image locally:

```bash
# Build the image
npm run docker:build

# Test the image
npm run docker:test

# Run the image
npm run docker:run

# Run in Streamable HTTP mode
npm run docker:run:http
```

### Multi-Architecture Support

The Docker images are built for multiple architectures:

- `linux/amd64` (x86_64)
- `linux/arm64` (Apple Silicon, ARM64)

Docker will automatically pull the correct image for your platform.

### Docker Security

The Docker image follows security best practices:

- Runs as non-root user (`mcp`)
- Uses minimal Alpine Linux base image
- Includes tini for proper signal handling
- Configuration directory has proper permissions
- Uses multi-stage builds to reduce attack surface

## 🏗️ Development

### Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to ensure consistent commit messages and enable automated versioning.

**Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files

**Examples:**
```bash
feat: add new MCP tool for listing projects
fix: resolve authentication issue with API tokens
docs: update README with installation instructions
feat!: change API response format (breaking change)
```

Commit messages are validated using commitlint on every commit and in CI.

### Testing

#### Local Testing

Run the test suite:

```bash
# Run all tests
bun test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun test --coverage
```

#### Docker Testing

The Docker environment includes all necessary dependencies for testing:

```bash
# Test the Docker build
docker build -t aha-mcp-test .

# Run tests inside Docker container
docker run --rm aha-mcp-test bun test

# Test with environment variables
docker run --rm \
  -e AHA_COMPANY="test-company" \
  -e AHA_TOKEN="test-token" \
  aha-mcp-test bun test

# Verify all dependencies are available
docker run --rm aha-mcp-test bun install --dry-run

# Test database functionality (SQLite)
docker run --rm aha-mcp-test node -e "
  const sqlite3 = require('sqlite3');
  const db = new sqlite3.Database(':memory:');
  console.log('SQLite available:', !!db);
  db.close();
"

# Test if sqlite-vec extension loads (graceful fallback if not available)
docker run --rm aha-mcp-test bun run start --help
```

#### Testing Database Features

The Docker environment includes:
- **SQLite3**: Core database functionality
- **Node.js sqlite packages**: Database drivers and utilities
- **Graceful fallback**: sqlite-vec extension warnings are suppressed in test environments
- **Temporary databases**: Each test uses isolated temporary database files
- **Proper cleanup**: Database connections and files are cleaned up after tests

#### Verifying Docker Environment

```bash
# Check all key components are available
docker run --rm aha-mcp-test sh -c "
  echo 'Checking Bun...'; bun --version
  echo 'Checking Node.js...'; node --version  
  echo 'Checking SQLite...'; node -e 'console.log(require(\"sqlite3\"))'
  echo 'Checking dependencies...'; bun install --dry-run
  echo 'Running basic tests...'; bun test --reporter=dot
"

# Test MCP server startup
docker run --rm -d --name aha-test \
  -e AHA_COMPANY="test" \
  -e AHA_TOKEN="test" \
  aha-mcp-test

# Check if server started successfully
docker logs aha-test

# Cleanup
docker stop aha-test
```

The Docker environment supports the full test suite including:
- **194+ test cases** across all services
- **Database service tests** (25 test cases)
- **Background sync service tests** (16 test cases)  
- **MCP accessibility tests** (172 test cases)
- **SQLite extension warnings** are automatically suppressed in test mode

### Building

To build for production:

```bash
# Build stdio server
bun run build

# Build HTTP server
bun run build:http
```

### Publishing

#### Automated Release Process (Recommended)

This project uses [release-please](https://github.com/googleapis/release-please-action) for automated versioning and publishing:

1. **Make changes** using [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` for new features (minor version bump)
   - `fix:` for bug fixes (patch version bump)
   - `feat!:` or `fix!:` for breaking changes (major version bump)

2. **Push to main** - release-please will automatically:
   - Create a release PR with updated version and changelog
   - Once the release PR is merged, it will create a GitHub release
   - The release will trigger automatic publication to npm

#### Manual Publishing

To publish the package manually:

```bash
# 1. Ensure you're logged in to npm
npm login

# 2. Build the package
bun run build

# 3. Publish to npm
npm publish --access public
```

**Note**: Make sure to set the `NPM_TOKEN` secret in your repository settings for automated publishing.

## 📚 Documentation

- [CLAUDE.md](CLAUDE.md) - Development guidance for Claude Code when working with this repository
- [MCP Documentation](https://modelcontextprotocol.io/introduction) - Official Model Context Protocol documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
