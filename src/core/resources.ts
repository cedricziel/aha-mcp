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

  // Aha feature resource
  server.resource(
    "aha_feature",
    "aha://feature/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid feature ID: ID is missing from URI');
      }
      try {
        const feature = await services.AhaService.getFeature(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(feature, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving feature ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha user resource
  server.resource(
    "aha_user",
    "aha://user/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid user ID: ID is missing from URI');
      }
      try {
        const user = await services.AhaService.getUser(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(user, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving user ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha epic resource
  server.resource(
    "aha_epic",
    "aha://epic/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid epic ID: ID is missing from URI');
      }
      try {
        const epic = await services.AhaService.getEpic(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epic, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epic ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha features list resource
  server.resource(
    "aha_features",
    "aha://features",
    async (uri: URL) => {
      try {
        const params = new URLSearchParams(uri.search);
        const query = params.get('query') || undefined;
        const updatedSince = params.get('updatedSince') || undefined;
        const tag = params.get('tag') || undefined;
        const assignedToUser = params.get('assignedToUser') || undefined;

        const features = await services.AhaService.listFeatures(
          query,
          updatedSince,
          tag,
          assignedToUser
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(features, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving features list:`, error);
        throw error;
      }
    }
  );

  // Aha users list resource
  server.resource(
    "aha_users",
    "aha://users",
    async (uri: URL) => {
      try {
        const users = await services.AhaService.listUsers();

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(users, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving users list:`, error);
        throw error;
      }
    }
  );

  // Aha epics list resource
  server.resource(
    "aha_epics",
    "aha://epics/{product_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const productId = pathParts[pathParts.length - 1];
      
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      
      try {
        const epics = await services.AhaService.listEpics(productId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epics, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics list for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha product resource
  server.resource(
    "aha_product",
    "aha://product/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid product ID: ID is missing from URI');
      }
      try {
        const product = await services.AhaService.getProduct(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(product, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving product ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha products list resource
  server.resource(
    "aha_products",
    "aha://products",
    async (uri: URL) => {
      try {
        const products = await services.AhaService.listProducts();

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(products, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving products list:`, error);
        throw error;
      }
    }
  );

  // Aha initiative resource
  server.resource(
    "aha_initiative",
    "aha://initiative/{id}",
    async (uri: URL) => {
      const id = uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid initiative ID: ID is missing from URI');
      }
      try {
        const initiative = await services.AhaService.getInitiative(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(initiative, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving initiative ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha initiatives list resource
  server.resource(
    "aha_initiatives",
    "aha://initiatives",
    async (uri: URL) => {
      try {
        const initiatives = await services.AhaService.listInitiatives();

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(initiatives, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving initiatives list:`, error);
        throw error;
      }
    }
  );

  // Aha ideas by product resource
  server.resource(
    "aha_ideas_by_product",
    "aha://ideas/{product_id}",
    async (uri: URL) => {
      const pathParts = uri.pathname.split('/');
      const productId = pathParts[pathParts.length - 1];
      
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      
      try {
        const ideas = await services.AhaService.listIdeasByProduct(productId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideas, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving ideas list for product ${productId}:`, error);
        throw error;
      }
    }
  );
}
