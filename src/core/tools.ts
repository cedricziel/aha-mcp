import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as services from "./services/index.js";

/**
 * Register all tools with the MCP server
 *
 * @param server The MCP server instance
 */
export function registerTools(server: McpServer) {
  // Greeting tool
  server.tool(
    "hello_world",
    "A simple hello world tool",
    {
      name: z.string().describe("Name to greet")
    },
    async (params: { name: string }) => {
      const greeting = services.GreetingService.generateGreeting(params.name);
      return {
        content: [
          {
            type: "text",
            text: greeting
          }
        ]
      };
    }
  );

  // Farewell tool
  server.tool(
    "goodbye",
    "A simple goodbye tool",
    {
      name: z.string().describe("Name to bid farewell to")
    },
    async (params: { name: string }) => {
      const farewell = services.GreetingService.generateFarewell(params.name);
      return {
        content: [
          {
            type: "text",
            text: farewell
          }
        ]
      };
    }
  );

  // Aha.io API initialization tool
  server.tool(
    "aha_initialize",
    "Initialize the Aha.io API client with authentication",
    {
      apiKey: z.string().describe("Aha.io API key"),
      subdomain: z.string().describe("Aha.io subdomain (e.g., 'mycompany' for mycompany.aha.io)")
    },
    async (params: { apiKey: string; subdomain: string }) => {
      try {
        services.AhaService.initialize(params.apiKey, params.subdomain);
        return {
          content: [
            {
              type: "text",
              text: `Successfully initialized Aha.io API client for ${params.subdomain}.aha.io`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error initializing Aha.io API client: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // List features tool
  server.tool(
    "aha_list_features",
    "List features from Aha.io",
    {
      query: z.string().optional().describe("Search query"),
      updatedSince: z.string().optional().describe("Filter by updated since date (ISO format)"),
      tag: z.string().optional().describe("Filter by tag"),
      assignedToUser: z.string().optional().describe("Filter by assigned user")
    },
    async (params: { query?: string; updatedSince?: string; tag?: string; assignedToUser?: string }) => {
      try {
        const features = await services.AhaService.listFeatures(
          params.query,
          params.updatedSince,
          params.tag,
          params.assignedToUser
        );

        return {
          content: [
            {
              type: "text",
              text: `Features from Aha.io:\n\n${JSON.stringify(features, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing features: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get feature tool
  server.tool(
    "aha_get_feature",
    "Get a specific feature from Aha.io by ID",
    {
      featureId: z.string().describe("ID of the feature to retrieve")
    },
    async (params: { featureId: string }) => {
      try {
        const feature = await services.AhaService.getFeature(params.featureId);

        return {
          content: [
            {
              type: "text",
              text: `Feature details:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting feature: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // List users tool
  server.tool(
    "aha_list_users",
    "List users from Aha.io",
    {},
    async () => {
      try {
        const users = await services.AhaService.listUsers();

        return {
          content: [
            {
              type: "text",
              text: `Users from Aha.io:\n\n${JSON.stringify(users, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing users: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // List epics tool
  server.tool(
    "aha_list_epics",
    "List epics in a product from Aha.io",
    {
      productId: z.string().describe("ID of the product")
    },
    async (params: { productId: string }) => {
      try {
        const epics = await services.AhaService.listEpics(params.productId);

        return {
          content: [
            {
              type: "text",
              text: `Epics for product ${params.productId}:\n\n${JSON.stringify(epics, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing epics: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create feature comment tool
  server.tool(
    "aha_create_feature_comment",
    "Create a comment on a feature in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      body: z.string().describe("Comment body")
    },
    async (params: { featureId: string; body: string }) => {
      try {
        const comment = await services.AhaService.createFeatureComment(params.featureId, params.body);

        return {
          content: [
            {
              type: "text",
              text: `Comment created successfully:\n\n${JSON.stringify(comment, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating comment: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
