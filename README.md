# @mcpdotdirect/template-mcp-server

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6)
![MCP](https://img.shields.io/badge/MCP-1.7+-green)

A CLI tool to quickly get started building your very own MCP (Model Context Protocol) server.

## 📋 Usage

```bash
# with npx
npx @mcpdotdirect/create-mcp-server

# Or with npm
npm init @mcpdotdirect/create-mcp-server
```

## 🔭 What's Included

The template includes:

- Basic server setup with both stdio and HTTP transport options
- Structure for defining MCP tools, resources, and prompts
- TypeScript configuration
- Development scripts and configuration

## ✨ Features

- **Dual Transport Support**: Run your MCP server over stdio or HTTP
- **TypeScript**: Full TypeScript support for type safety
- **MCP SDK**: Built on the official Model Context Protocol SDK
- **Extensible**: Easy to add custom tools, resources, and prompts

## 🚀 Getting Started

After creating your project:

1. Install dependencies using your preferred package manager:
   ```bash
   # Using npm
   npm install

   # Using yarn
   yarn

   # Using pnpm
   pnpm install

   # Using bun
   bun install
   ```

2. Start the server:
   ```bash
   # Start the stdio server
   npm start

   # Or start the HTTP server
   npm run start:http
   ```

3. For development with auto-reload:
   ```bash
   # Development mode with stdio
   npm run dev

   # Development mode with HTTP
   npm run dev:http
   ```

> **Note**: The default scripts in package.json use Bun as the runtime (e.g., `bun run src/index.ts`). If you prefer to use a different package manager or runtime, you can modify these scripts in your package.json file to use Node.js or another runtime of your choice.

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

## 📚 Documentation

For more information about the Model Context Protocol, visit the [MCP Documentation](https://modelcontextprotocol.io/introduction).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
