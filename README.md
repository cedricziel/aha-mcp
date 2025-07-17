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

The Aha.io integration can be configured using environment variables:

- `AHA_COMPANY`: Your Aha.io subdomain (e.g., `mycompany` for `mycompany.aha.io`)
- `AHA_TOKEN`: Your Aha.io API token

You can set these environment variables in your MCP settings configuration file or in your environment before starting the server.

### Available Resources

#### Individual Entity Resources
- `aha_idea`: Access individual ideas using `aha://idea/{id}`
- `aha_feature`: Access individual features using `aha://feature/{id}`
- `aha_user`: Access individual users using `aha://user/{id}`
- `aha_epic`: Access individual epics using `aha://epic/{id}`
- `aha_product`: Access individual products using `aha://product/{id}`
- `aha_initiative`: Access individual initiatives using `aha://initiative/{id}`

#### Collection Resources
- `aha_features`: List features with optional filtering using `aha://features?query=...&tag=...`
- `aha_users`: List all users using `aha://users`
- `aha_epics`: List epics for a product using `aha://epics/{product_id}`
- `aha_products`: List all products using `aha://products`
- `aha_initiatives`: List all initiatives using `aha://initiatives`
- `aha_ideas_by_product`: List ideas for a product using `aha://ideas/{product_id}`

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
aha://idea/IDEA-123               # Get specific idea
aha://feature/PROJ-456            # Get specific feature
aha://user/USER-789               # Get specific user
aha://epic/EPIC-101               # Get specific epic
aha://product/PROD-001            # Get specific product
aha://initiative/INIT-202         # Get specific initiative
aha://features?query=auth&tag=api # Search features
aha://users                       # List all users
aha://epics/PROJ-001              # List epics for product
aha://products                    # List all products
aha://initiatives                 # List all initiatives
aha://ideas/PROJ-001              # List ideas for product
aha://comments/epic/EPIC-123      # Get comments for epic
aha://comments/idea/IDEA-456      # Get comments for idea
aha://comments/initiative/INIT-789 # Get comments for initiative
aha://comments/product/PROD-001   # Get comments for product
aha://comments/goal/GOAL-555      # Get comments for goal
aha://comments/release/REL-333    # Get comments for release
aha://comments/release-phase/RP-444 # Get comments for release phase
aha://comments/requirement/REQ-666 # Get comments for requirement
aha://comments/todo/TODO-777      # Get comments for todo
aha://goal/GOAL-123               # Get specific goal
aha://goals                       # List all goals
aha://goal/GOAL-456/epics         # Get epics for goal
aha://release/REL-123             # Get specific release
aha://releases                    # List all releases
aha://release/REL-456/features    # Get features for release
aha://release/REL-456/epics       # Get epics for release
aha://release-phase/RP-123        # Get specific release phase
aha://release-phases              # List all release phases
```

### Available Tools

- `aha_initialize`: Initialize the Aha.io API client (optional if environment variables are set)
- `aha_list_features`: List features from Aha.io
- `aha_get_feature`: Get a specific feature by ID
- `aha_list_users`: List users from Aha.io
- `aha_list_epics`: List epics in a product
- `aha_create_feature_comment`: Create a comment on a feature

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
