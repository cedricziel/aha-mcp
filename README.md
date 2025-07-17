# Aha MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6)
![MCP](https://img.shields.io/badge/MCP-1.7+-green)

A Model Context Protocol (MCP) server that provides seamless integration with Aha.io's product management platform.

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

### Development Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables:
   ```bash
   export AHA_COMPANY="your-company"  # Your Aha.io subdomain
   export AHA_TOKEN="your-api-token"   # Your Aha.io API token
   ```

3. Start the server:
   ```bash
   # Start the stdio server (for MCP clients)
   bun start

   # Or start the HTTP server
   bun run start:http
   ```

4. For development with auto-reload:
   ```bash
   # Development mode with stdio
   bun run dev

   # Development mode with HTTP
   bun run dev:http
   ```

## 🔌 Aha.io Integration

This MCP server includes integration with the Aha.io API, allowing you to access features, ideas, users, and more from your Aha.io account.

### Configuration

The Aha.io integration can be configured using multiple methods, with the following priority order:

1. **Environment Variables** (highest priority)
2. **Configuration File** (`~/.aha-mcp-config.json`)
3. **Default Values** (lowest priority)

#### Environment Variables

- `AHA_COMPANY`: Your Aha.io subdomain (e.g., `mycompany` for `mycompany.aha.io`)
- `AHA_TOKEN`: Your Aha.io API token
- `MCP_TRANSPORT_MODE`: Transport mode (`stdio` or `sse`)
- `MCP_PORT`: Port number for SSE mode (default: 3001)
- `MCP_HOST`: Host address for SSE mode (default: 0.0.0.0)

#### Runtime Configuration

The server supports runtime configuration through MCP tools, allowing you to set up credentials without restarting:

```bash
# Configure server settings
aha_mcp --mode stdio
> Use the `configure_server` tool to set:
> - company: "your-company-subdomain"
> - token: "your-api-token"
> - mode: "stdio" or "sse"
> - port: 3001 (for SSE mode)
> - host: "0.0.0.0" (for SSE mode)

# Check current configuration
> Use the `get_server_config` tool to view current settings

# Test your configuration
> Use the `test_configuration` tool to verify API connectivity
```

#### Command Line Arguments

You can override configuration settings using command line arguments:

```bash
# Force stdio mode
aha-mcp --mode stdio

# Force SSE mode with custom port
aha-mcp --mode sse --port 3000 --host localhost

# Get help
aha-mcp --help
```

#### Configuration File

The server automatically creates and manages a configuration file at `~/.aha-mcp-config.json`. This file stores your settings with basic token obfuscation for security.

Example configuration file:
```json
{
  "company": "your-company",
  "token": "base64-encoded-token",
  "mode": "stdio",
  "port": 3001,
  "host": "0.0.0.0"
}
```

#### Transport Modes

The server supports two transport modes:

1. **stdio**: Standard input/output mode for MCP client integration (default)
2. **sse**: Server-Sent Events mode for HTTP-based integration

Example usage:
```bash
# Stdio mode (default)
aha-mcp

# SSE mode
aha-mcp --mode sse --port 3001
```

#### Configuration Management Tools

The server provides three MCP tools for configuration management:

1. **configure_server**: Update server settings at runtime
2. **get_server_config**: View current configuration and validation status
3. **test_configuration**: Test API connectivity with current settings

These tools allow you to manage configuration without restarting the server, making it easy to switch between different Aha.io accounts or update credentials.

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
- `aha_ideas_by_product`: List ideas for a product using `aha://ideas/{product_id}?query=...&spam=false&sort=recent`
- `aha_competitors`: List competitors for a product using `aha://competitors/{product_id}`

#### Comment Resources
- `aha_epic_comments`: Access comments for an epic using `aha://comments/epic/{epic_id}`
- `aha_idea_comments`: Access comments for an idea using `aha://comments/idea/{idea_id}`
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
aha://ideas/PROJ-001?query=search&spam=false&sort=recent&tag=enhancement # List ideas with filters
aha://competitors/PROJ-001        # List competitors for product

# Comment Resources
aha://comments/epic/EPIC-123      # Get comments for epic
aha://comments/idea/IDEA-456      # Get comments for idea
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
```

### Available Tools

#### Core Tools
- `aha_initialize`: Initialize the Aha.io API client (optional if environment variables are set)

#### Feature & Product Tools
- `aha_list_features`: List features from Aha.io with advanced filtering
- `aha_get_feature`: Get a specific feature by ID
- `aha_list_users`: List users from Aha.io
- `aha_list_epics`: List epics in a product

#### Comment Tools
- `aha_create_feature_comment`: Create a comment on a feature
- `aha_get_requirement_comments`: Get comments for a specific requirement
- `aha_get_todo_comments`: Get comments for a specific todo
- `aha_get_initiative_comments`: Get comments for a specific initiative

#### Initiative Management Tools
- `aha_list_initiatives`: List initiatives with filtering options
- `aha_get_initiative`: Get a specific initiative by ID
- `aha_get_initiative_comments`: Get comments for a specific initiative
- `aha_get_initiative_epics`: Get epics associated with an initiative
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

**Note**: All MCP resources provide comprehensive access to Aha.io entities with advanced filtering capabilities. Most functionality is exposed through the resource system rather than individual tools, allowing for more flexible queries through URI parameters.

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

#### Phase 8B - Competitor & Initiative Management (7 Tools)
**Competitor Management (3 Tools)**
- `aha_create_competitor`: Create competitors in products
- `aha_update_competitor`: Update existing competitors
- `aha_delete_competitor`: Delete competitors

**Initiative Management (4 Tools)**
- `aha_list_initiatives`: List initiatives with filtering
- `aha_get_initiative`: Get specific initiatives
- `aha_get_initiative_comments`: Get initiative comments
- `aha_get_initiative_epics`: Get epics associated with initiatives

#### Phase 8C - Portal Integration & Advanced Features (2 Tools)
**Portal Integration**
- `aha_create_idea_by_portal_user`: Create ideas by portal users
- `aha_create_idea_with_portal_settings`: Create ideas with portal settings

#### Enhanced Filtering & Resources
- **Initiative Filtering**: Enhanced with `query`, `updatedSince`, `assignedToUser`, `onlyActive` parameters
- **Portal Configuration**: Support for `skip_portal` and `submitted_idea_portal_id` settings
- **Comprehensive Entity Coverage**: Full CRUD operations for features, epics, ideas, and competitors

#### Technical Achievements
- **36 total MCP tools** (up from 12 in Phase 7)
- **24 CRUD operation tools** for complete lifecycle management
- **127 tests passing** with full TypeScript type safety
- **Portal integration** for advanced workflow management
- **Comprehensive error handling** with proper Zod schema validation
- **Professional-grade implementation** following MCP best practices

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

Run the test suite:

```bash
# Run all tests
bun test

# Run tests in watch mode
bun run test:watch
```

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
