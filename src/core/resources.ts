import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as services from "./services/index.js";

/**
 * Register all resources with the MCP server
 * @param server The MCP server instance
 */
export function registerResources(server: McpServer) {
  // Aha idea resource
  server.resource(
    "aha_idea",
    "aha://idea/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid idea ID: ID is missing from URI');
      }
      try {
        const idea = await services.AhaService.getIdea(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(idea, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving idea ${id}:`, error);
        throw error;
      }
    }
  );
}
