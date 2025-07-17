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

- `aha_idea`: Access ideas from Aha.io using the URI format `aha://idea/{id}`

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
