import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import * as services from "./services/index.js";

/**
 * Resource terminology and synonym mappings
 */
const RESOURCE_SYNONYMS = {
  workspace: {
    canonical: "product",
    resources: ["aha_product", "aha_products"],
    note: "In Aha.io, products and workspaces are synonymous terms for the same entity"
  },
  "Product Area": {
    canonical: "product_area",
    resources: [],
    note: "Product Areas are organizational subdivisions within products/workspaces. Currently not exposed as resources."
  },
  area: {
    canonical: "product_area",
    resources: [],
    note: "Product areas (subdivisions within products/workspaces) are currently not exposed as resources."
  },
  workstream: {
    canonical: "release",
    resources: ["aha_release", "aha_releases"],
    note: "Releases can function as workstreams for organizing features and epics"
  }
};

/**
 * Register all resources with the MCP server
 * @param server The MCP server instance
 */
export function registerResources(server: McpServer) {
  // Meta-resource for resource discovery and synonym mapping
  server.registerResource(
    "aha_resource_guide",
    new ResourceTemplate("aha://resources", { list: undefined, complete: {} }),
    {
      title: "Aha Resource Guide",
      description: "Discover available resources and terminology mappings. Use this to find the right resource when searching by synonym (e.g., 'workspace' → 'product', 'Product Area' → shows not available, 'workstream' → 'release').",
      mimeType: "application/json"
    },
    async (uri: URL, _variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify({
            synonyms: RESOURCE_SYNONYMS,
            terminology_guide: {
              product_workspace: "Products and workspaces are the same in Aha.io. Use aha://products or aha://product/{id}",
              product_areas: "Product Areas are subdivisions within products. Not currently available as resources.",
              releases_workstreams: "Releases can be used as workstreams. Use aha://releases or aha://release/{id}"
            },
            common_questions: {
              "How do I find workspaces?": "Use aha://products - products and workspaces are synonymous",
              "How do I find Product Areas?": "Product Areas are not currently exposed as resources. Use products instead.",
              "Where are workstreams?": "Releases can function as workstreams - use aha://releases"
            }
          }, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  );

  // Aha idea resource with path variable
  server.registerResource(
    "aha_idea",
    new ResourceTemplate(
      "aha://idea/{id}",
      {
        list: undefined,
        complete: {
          id: async () => [] // Could fetch actual idea IDs for completion
        }
      }
    ),
    {
      title: "Aha Idea",
      description: "Get a specific idea by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Support both direct URI calls (from tests) and ResourceTemplate calls
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid idea ID: ID is missing from URI');
      }
      try {
        const idea = await services.AhaService.getIdea(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(idea, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving idea ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha feature resource with path variable
  server.registerResource(
    "aha_feature",
    new ResourceTemplate(
      "aha://feature/{id}",
      {
        list: undefined,
        complete: {
          id: async () => [] // Could fetch actual feature IDs for completion
        }
      }
    ),
    {
      title: "Aha Feature",
      description: "Get a specific feature by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Support both direct URI calls (from tests) and ResourceTemplate calls
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid feature ID: ID is missing from URI');
      }
      try {
        const feature = await services.AhaService.getFeature(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(feature, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving feature ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha user resource
  server.registerResource(
    "aha_user",
    new ResourceTemplate(
      "aha://user/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha User",
      description: "Get a specific user by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid user ID: ID is missing from URI');
      }
      try {
        const user = await services.AhaService.getUser(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(user, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving user ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha epic resource
  server.registerResource(
    "aha_epic",
    new ResourceTemplate(
      "aha://epic/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Epic",
      description: "Get a specific epic by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid epic ID: ID is missing from URI');
      }
      try {
        const epic = await services.AhaService.getEpic(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epic, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epic ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha features list resource with pagination and filter parameters
  server.registerResource(
    "aha_features",
    new ResourceTemplate(
      "aha://features{?query,updatedSince,tag,assignedToUser,page,perPage}",
      {
        list: undefined, // Not listing all instances, just defining the template
        complete: {
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Features",
      description: "List features with optional filters and pagination",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const page = variables?.page ? parseInt(variables.page) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(variables.perPage) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const features = await services.AhaService.listFeatures(
          variables?.query || uri.searchParams.get('query') || undefined,
          variables?.updatedSince || uri.searchParams.get('updatedSince') || undefined,
          variables?.tag || uri.searchParams.get('tag') || undefined,
          variables?.assignedToUser || uri.searchParams.get('assignedToUser') || undefined,
          page,
          perPage
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(features, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving features list:`, error);
        throw error;
      }
    }
  );

  // Aha users list resource
  server.registerResource(
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
  server.registerResource(
    "aha_epics",
    new ResourceTemplate(
      "aha://epics/{product_id}",
      {
        list: undefined,
        complete: {
          product_id: async () => []
        }
      }
    ),
    {
      title: "Aha Epics by Product",
      description: "List epics for a specific product",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const productId = variables.product_id || pathParts[pathParts.length - 1];

      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }

      try {
        const epics = await services.AhaService.listEpics(productId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epics, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics list for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha product resource
  server.registerResource(
    "aha_product",
    new ResourceTemplate(
      "aha://product/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Product (Workspace)",
      description: "Get a specific product/workspace by ID. In Aha.io, products and workspaces are synonymous - use this to retrieve workspace details.",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid product ID: ID is missing from URI');
      }
      try {
        const product = await services.AhaService.getProduct(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(product, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving product ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha products list resource with pagination parameters
  server.registerResource(
    "aha_products",
    new ResourceTemplate(
      "aha://products{?updatedSince,page,perPage}",
      {
        list: undefined,
        complete: {
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Products (Workspaces)",
      description: "List all products/workspaces with optional date filter and pagination. In Aha.io, products and workspaces are synonymous - use this to list all workspaces.",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const page = variables?.page ? parseInt(variables.page) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(variables.perPage) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const products = await services.AhaService.listProducts(
          variables?.updatedSince || uri.searchParams.get('updatedSince') || undefined,
          page,
          perPage
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(products, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving products list:`, error);
        throw error;
      }
    }
  );

  // Aha initiative resource
  server.registerResource(
    "aha_initiative",
    new ResourceTemplate(
      "aha://initiative/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Initiative",
      description: "Get a specific initiative by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid initiative ID: ID is missing from URI');
      }
      try {
        const initiative = await services.AhaService.getInitiative(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(initiative, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving initiative ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha initiatives list resource with advanced filters and pagination
  server.registerResource(
    "aha_initiatives",
    new ResourceTemplate(
      "aha://initiatives{?query,updatedSince,assignedToUser,onlyActive,page,perPage}",
      {
        list: undefined,
        complete: {
          onlyActive: async () => ['true', 'false'],
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Initiatives",
      description: "List initiatives with optional filters and pagination",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const onlyActive = variables?.onlyActive === 'true' ? true : 
                          variables?.onlyActive === 'false' ? false : 
                          uri.searchParams.get('onlyActive') === 'true' ? true :
                          uri.searchParams.get('onlyActive') === 'false' ? false : undefined;
        const page = variables?.page ? parseInt(variables.page) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(variables.perPage) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const initiatives = await services.AhaService.listInitiatives(
          variables?.query || uri.searchParams.get('query') || undefined,
          variables?.updatedSince || uri.searchParams.get('updatedSince') || undefined,
          variables?.assignedToUser || uri.searchParams.get('assignedToUser') || undefined,
          onlyActive,
          page,
          perPage
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(initiatives, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving initiatives list:`, error);
        throw error;
      }
    }
  );

  // Aha ideas by product resource
  server.registerResource(
    "aha_ideas_by_product",
    new ResourceTemplate(
      "aha://ideas/{product_id}",
      {
        list: undefined,
        complete: {
          product_id: async () => []
        }
      }
    ),
    {
      title: "Aha Ideas by Product",
      description: "List ideas for a specific product with optional filters",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const productId = variables.product_id || pathParts[pathParts.length - 1];

      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }

      try {
        // Extract query parameters for advanced filtering
        const query = uri.searchParams.get('query') || undefined;
        const spam = uri.searchParams.get('spam') === 'true' ? true :
                    uri.searchParams.get('spam') === 'false' ? false : undefined;
        const workflowStatus = uri.searchParams.get('workflowStatus') || undefined;
        const sort = uri.searchParams.get('sort') || undefined;
        const createdBefore = uri.searchParams.get('createdBefore') || undefined;
        const createdSince = uri.searchParams.get('createdSince') || undefined;
        const updatedSince = uri.searchParams.get('updatedSince') || undefined;
        const tag = uri.searchParams.get('tag') || undefined;
        const userId = uri.searchParams.get('userId') || undefined;
        const ideaUserId = uri.searchParams.get('ideaUserId') || undefined;

        const ideas = await services.AhaService.listIdeasByProduct(
          productId,
          query,
          spam,
          workflowStatus,
          sort,
          createdBefore,
          createdSince,
          updatedSince,
          tag,
          userId,
          ideaUserId
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideas, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving ideas list for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha epic comments resource
  server.registerResource(
    "aha_epic_comments",
    new ResourceTemplate(
      "aha://comments/epic/{epic_id}",
      {
        list: undefined,
        complete: {
          epic_id: async () => []
        }
      }
    ),
    {
      title: "Aha Epic Comments",
      description: "Get comments for a specific epic",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const epicId = variables?.epic_id || pathParts[pathParts.length - 1];

      if (!epicId) {
        throw new Error('Invalid epic ID: Epic ID is missing from URI');
      }

      try {
        const comments = await services.AhaService.getEpicComments(epicId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for epic ${epicId}:`, error);
        throw error;
      }
    }
  );

  // Aha idea comments resource
  server.registerResource(
    "aha_idea_comments",
    new ResourceTemplate(
      "aha://comments/idea/{idea_id}",
      {
        list: undefined,
        complete: {
          idea_id: async () => []
        }
      }
    ),
    {
      title: "Aha Idea Comments",
      description: "Get comments for a specific idea",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = variables.idea_id || pathParts[pathParts.length - 1];

      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }

      try {
        const comments = await services.AhaService.getIdeaComments(ideaId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for idea ${ideaId}:`, error);
        throw error;
      }
    }
  );

  // Aha initiative comments resource
  server.registerResource(
    "aha_initiative_comments",
    new ResourceTemplate(
      "aha://comments/initiative/{initiative_id}",
      {
        list: undefined,
        complete: {
          initiative_id: async () => []
        }
      }
    ),
    {
      title: "Aha Initiative Comments",
      description: "Get comments for a specific initiative",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const initiativeId = variables?.initiative_id || pathParts[pathParts.length - 1];

      if (!initiativeId) {
        throw new Error('Invalid initiative ID: Initiative ID is missing from URI');
      }

      try {
        const comments = await services.AhaService.getInitiativeComments(initiativeId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for initiative ${initiativeId}:`, error);
        throw error;
      }
    }
  );

  // Aha product comments resource
  server.registerResource(
    "aha_product_comments",
    new ResourceTemplate(
      "aha://comments/product/{product_id}",
      {
        list: undefined,
        complete: {
          product_id: async () => []
        }
      }
    ),
    {
      title: "Aha Product Comments",
      description: "Get comments for a specific product",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const productId = variables.product_id || pathParts[pathParts.length - 1];

      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }

      try {
        const comments = await services.AhaService.getProductComments(productId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha goal comments resource
  server.registerResource(
    "aha_goal_comments",
    new ResourceTemplate(
      "aha://comments/goal/{goal_id}",
      {
        list: undefined,
        complete: {
          goal_id: async () => []
        }
      }
    ),
    {
      title: "Aha Goal Comments",
      description: "Get comments for a specific goal",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const goalId = variables?.goal_id || pathParts[pathParts.length - 1];

      if (!goalId) {
        throw new Error('Invalid goal ID: Goal ID is missing from URI');
      }

      try {
        const comments = await services.AhaService.getGoalComments(goalId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for goal ${goalId}:`, error);
        throw error;
      }
    }
  );

  // Aha release comments resource
  server.registerResource(
    "aha_release_comments",
    new ResourceTemplate(
      "aha://comments/release/{release_id}",
      {
        list: undefined,
        complete: {
          release_id: async () => []
        }
      }
    ),
    {
      title: "Aha Release Comments",
      description: "Get comments for a specific release",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const releaseId = variables?.release_id || pathParts[pathParts.length - 1];

      if (!releaseId) {
        throw new Error('Invalid release ID: Release ID is missing from URI');
      }

      try {
        const comments = await services.AhaService.getReleaseComments(releaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for release ${releaseId}:`, error);
        throw error;
      }
    }
  );

  // Aha release phase comments resource
  server.registerResource(
    "aha_release_phase_comments",
    new ResourceTemplate(
      "aha://comments/release-phase/{release_phase_id}",
      {
        list: undefined,
        complete: {
          release_phase_id: async () => []
        }
      }
    ),
    {
      title: "Aha Release Phase Comments",
      description: "Get comments for a specific release phase",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const releasePhaseId = variables?.release_phase_id || pathParts[pathParts.length - 1];

      if (!releasePhaseId) {
        throw new Error('Invalid release phase ID: Release phase ID is missing from URI');
      }

      try {
        const comments = await services.AhaService.getReleasePhaseComments(releasePhaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for release phase ${releasePhaseId}:`, error);
        throw error;
      }
    }
  );

  // Aha requirement comments resource
  server.registerResource(
    "aha_requirement_comments",
    new ResourceTemplate(
      "aha://comments/requirement/{requirement_id}",
      {
        list: undefined,
        complete: {
          requirement_id: async () => []
        }
      }
    ),
    {
      title: "Aha Requirement Comments",
      description: "Get comments for a specific requirement",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const requirementId = variables?.requirement_id || pathParts[pathParts.length - 1];

      if (!requirementId) {
        throw new Error('Invalid requirement ID: Requirement ID is missing from URI');
      }

      try {
        const comments = await services.AhaService.getRequirementComments(requirementId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for requirement ${requirementId}:`, error);
        throw error;
      }
    }
  );

  // Aha todo comments resource
  server.registerResource(
    "aha_todo_comments",
    new ResourceTemplate(
      "aha://comments/todo/{todo_id}",
      {
        list: undefined,
        complete: {
          todo_id: async () => []
        }
      }
    ),
    {
      title: "Aha Todo Comments",
      description: "Get comments for a specific todo",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const todoId = variables?.todo_id || pathParts[pathParts.length - 1];

      if (!todoId) {
        throw new Error('Invalid todo ID: Todo ID is missing from URI');
      }

      try {
        const comments = await services.AhaService.getTodoComments(todoId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for todo ${todoId}:`, error);
        throw error;
      }
    }
  );

  // Aha goal resource
  server.registerResource(
    "aha_goal",
    new ResourceTemplate(
      "aha://goal/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Goal",
      description: "Get a specific goal by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid goal ID: ID is missing from URI');
      }
      try {
        const goal = await services.AhaService.getGoal(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(goal, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving goal ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha goals list resource with filters and pagination
  server.registerResource(
    "aha_goals",
    new ResourceTemplate(
      "aha://goals{?query,updatedSince,assignedToUser,status,page,perPage}",
      {
        list: undefined,
        complete: {
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Goals",
      description: "List goals with optional filters and pagination",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const page = variables?.page ? parseInt(variables.page) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(variables.perPage) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const goals = await services.AhaService.listGoals(
          variables?.query || uri.searchParams.get('query') || undefined,
          variables?.updatedSince || uri.searchParams.get('updatedSince') || undefined,
          variables?.assignedToUser || uri.searchParams.get('assignedToUser') || undefined,
          variables?.status || uri.searchParams.get('status') || undefined,
          page,
          perPage
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(goals, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving goals list:`, error);
        throw error;
      }
    }
  );

  // Aha goal epics resource
  server.registerResource(
    "aha_goal_epics",
    new ResourceTemplate(
      "aha://goal/{goal_id}/epics",
      {
        list: undefined,
        complete: {
          goal_id: async () => []
        }
      }
    ),
    {
      title: "Aha Goal Epics",
      description: "Get epics for a specific goal",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const goalId = variables?.goal_id || pathParts[pathParts.length - 2]; // goal_id is before /epics

      if (!goalId) {
        throw new Error('Invalid goal ID: Goal ID is missing from URI');
      }

      try {
        const epics = await services.AhaService.getGoalEpics(goalId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epics, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics for goal ${goalId}:`, error);
        throw error;
      }
    }
  );

  // Aha release resource
  server.registerResource(
    "aha_release",
    new ResourceTemplate(
      "aha://release/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Release",
      description: "Get a specific release by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid release ID: ID is missing from URI');
      }
      try {
        const release = await services.AhaService.getRelease(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(release, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving release ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha releases list resource with filters and pagination
  server.registerResource(
    "aha_releases",
    new ResourceTemplate(
      "aha://releases{?query,updatedSince,assignedToUser,status,parkingLot,page,perPage}",
      {
        list: undefined,
        complete: {
          parkingLot: async () => ['true', 'false'],
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Releases",
      description: "List releases with optional filters and pagination",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const parkingLot = variables?.parkingLot === 'true' ? true :
                          variables?.parkingLot === 'false' ? false :
                          uri.searchParams.get('parkingLot') === 'true' ? true :
                          uri.searchParams.get('parkingLot') === 'false' ? false : undefined;
        const page = variables?.page ? parseInt(variables.page) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(variables.perPage) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const releases = await services.AhaService.listReleases(
          variables?.query || uri.searchParams.get('query') || undefined,
          variables?.updatedSince || uri.searchParams.get('updatedSince') || undefined,
          variables?.assignedToUser || uri.searchParams.get('assignedToUser') || undefined,
          variables?.status || uri.searchParams.get('status') || undefined,
          parkingLot,
          page,
          perPage
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releases, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving releases list:`, error);
        throw error;
      }
    }
  );

  // Aha release features resource
  server.registerResource(
    "aha_release_features",
    new ResourceTemplate(
      "aha://release/{release_id}/features",
      {
        list: undefined,
        complete: {
          release_id: async () => []
        }
      }
    ),
    {
      title: "Aha Release Features",
      description: "Get features for a specific release",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const releaseId = variables?.release_id || pathParts[pathParts.length - 2]; // release_id is before /features

      if (!releaseId) {
        throw new Error('Invalid release ID: Release ID is missing from URI');
      }

      try {
        const features = await services.AhaService.getReleaseFeatures(releaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(features, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving features for release ${releaseId}:`, error);
        throw error;
      }
    }
  );

  // Aha release epics resource
  server.registerResource(
    "aha_release_epics",
    new ResourceTemplate(
      "aha://release/{release_id}/epics",
      {
        list: undefined,
        complete: {
          release_id: async () => []
        }
      }
    ),
    {
      title: "Aha Release Epics",
      description: "Get epics for a specific release",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const releaseId = variables?.release_id || pathParts[pathParts.length - 2]; // release_id is before /epics

      if (!releaseId) {
        throw new Error('Invalid release ID: Release ID is missing from URI');
      }

      try {
        const epics = await services.AhaService.getReleaseEpics(releaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epics, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics for release ${releaseId}:`, error);
        throw error;
      }
    }
  );

  // Aha release phase resource
  server.registerResource(
    "aha_release_phase",
    new ResourceTemplate(
      "aha://release-phase/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Release Phase",
      description: "Get a specific release phase by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid release phase ID: ID is missing from URI');
      }
      try {
        const releasePhase = await services.AhaService.getReleasePhase(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releasePhase, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving release phase ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha release phases list resource
  server.registerResource(
    "aha_release_phases",
    "aha://release-phases",
    async (uri: URL) => {
      try {
        const releasePhases = await services.AhaService.listReleasePhases();

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releasePhases, null, 2)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving release phases list:`, error);
        throw error;
      }
    }
  );

  // Aha requirement resource
  server.registerResource(
    "aha_requirement",
    new ResourceTemplate(
      "aha://requirement/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Requirement",
      description: "Get a specific requirement by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid requirement ID: ID is missing from URI');
      }
      try {
        const requirement = await services.AhaService.getRequirement(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(requirement, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving requirement ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha competitor resource
  server.registerResource(
    "aha_competitor",
    new ResourceTemplate(
      "aha://competitor/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Competitor",
      description: "Get a specific competitor by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid competitor ID: ID is missing from URI');
      }
      try {
        const competitor = await services.AhaService.getCompetitor(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(competitor, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving competitor ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha todo resource
  server.registerResource(
    "aha_todo",
    new ResourceTemplate(
      "aha://todo/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Todo",
      description: "Get a specific todo by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid todo ID: ID is missing from URI');
      }
      try {
        const todo = await services.AhaService.getTodo(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(todo, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving todo ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha competitors list resource
  server.registerResource(
    "aha_competitors",
    new ResourceTemplate(
      "aha://competitors/{product_id}",
      {
        list: undefined,
        complete: {
          product_id: async () => []
        }
      }
    ),
    {
      title: "Aha Competitors by Product",
      description: "List competitors for a specific product",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const productId = variables.product_id || uri.pathname.split('/').pop();
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      try {
        const competitors = await services.AhaService.listCompetitors(productId);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(competitors, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving competitors for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha strategic model resource
  server.registerResource(
    "aha_strategic_model",
    new ResourceTemplate(
      "aha://strategic-model/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Strategic Model",
      description: "Get a specific strategic model by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid strategic model ID: ID is missing from URI');
      }
      try {
        const strategicModel = await services.AhaService.getStrategicModel(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(strategicModel, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving strategic model ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha strategic models list resource with filters and pagination
  server.registerResource(
    "aha_strategic_models",
    new ResourceTemplate(
      "aha://strategic-models{?query,type,updatedSince,page,perPage}",
      {
        list: undefined,
        complete: {
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Strategic Models",
      description: "List strategic models with optional filters and pagination",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const page = variables?.page ? parseInt(variables.page) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(variables.perPage) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const strategicModels = await services.AhaService.listStrategicModels(
          variables?.query || uri.searchParams.get('query') || undefined,
          variables?.type || uri.searchParams.get('type') || undefined,
          variables?.updatedSince || uri.searchParams.get('updatedSince') || undefined,
          page,
          perPage
        );
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(strategicModels, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error('Error retrieving strategic models list:', error);
        throw error;
      }
    }
  );

  // Aha todos list resource
  server.registerResource(
    "aha_todos",
    "aha://todos",
    async (uri: URL) => {
      try {
        const todos = await services.AhaService.listTodos();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(todos, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving todos list:', error);
        throw error;
      }
    }
  );

  // Aha idea organization resource
  server.registerResource(
    "aha_idea_organization",
    new ResourceTemplate(
      "aha://idea-organization/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Idea Organization",
      description: "Get a specific idea organization by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = variables.id || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid idea organization ID: ID is missing from URI');
      }
      try {
        const ideaOrganization = await services.AhaService.getIdeaOrganization(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideaOrganization, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving idea organization ${id}:`, error);
        throw error;
      }
    }
  );

  // Aha idea organizations list resource with filters and pagination
  server.registerResource(
    "aha_idea_organizations",
    new ResourceTemplate(
      "aha://idea-organizations{?query,emailDomain,page,perPage}",
      {
        list: undefined,
        complete: {
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Idea Organizations",
      description: "List idea organizations with optional filters and pagination",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const page = variables?.page ? parseInt(variables.page) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(variables.perPage) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const ideaOrganizations = await services.AhaService.listIdeaOrganizations(
          variables?.query || uri.searchParams.get('query') || undefined,
          variables?.emailDomain || uri.searchParams.get('emailDomain') || undefined,
          page,
          perPage
        );
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideaOrganizations, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error('Error retrieving idea organizations list:', error);
        throw error;
      }
    }
  );

  // Aha me/current user profile resource
  server.registerResource(
    "aha_me_profile",
    "aha://me/profile",
    async (uri: URL) => {
      try {
        const profile = await services.AhaService.getMe();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(profile, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving user profile:', error);
        throw error;
      }
    }
  );

  // Aha me/current user assigned records resource
  server.registerResource(
    "aha_me_assigned_records",
    "aha://me/assigned-records",
    async (uri: URL) => {
      try {
        const assignedRecords = await services.AhaService.getAssignedRecords();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(assignedRecords, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving assigned records:', error);
        throw error;
      }
    }
  );

  // Aha me/current user pending tasks resource
  server.registerResource(
    "aha_me_pending_tasks",
    "aha://me/pending-tasks",
    async (uri: URL) => {
      try {
        const pendingTasks = await services.AhaService.getPendingTasks();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(pendingTasks, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving pending tasks:', error);
        throw error;
      }
    }
  );

  // Aha idea endorsements resource
  server.registerResource(
    "aha_idea_endorsements",
    new ResourceTemplate(
      "aha://idea/{id}/endorsements",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Idea Endorsements",
      description: "Get endorsements for a specific idea",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = variables.id || pathParts[pathParts.length - 2]; // idea_id is before /endorsements

      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }

      try {
        const endorsements = await services.AhaService.getIdeaEndorsements(ideaId);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(endorsements, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving endorsements for idea ${ideaId}:`, error);
        throw error;
      }
    }
  );

  // Aha idea votes resource
  server.registerResource(
    "aha_idea_votes",
    new ResourceTemplate(
      "aha://idea/{id}/votes",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Idea Votes",
      description: "Get votes for a specific idea",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = variables.id || pathParts[pathParts.length - 2]; // idea_id is before /votes

      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }

      try {
        const votes = await services.AhaService.getIdeaVotes(ideaId);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(votes, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving votes for idea ${ideaId}:`, error);
        throw error;
      }
    }
  );

  // Aha idea watchers resource
  server.registerResource(
    "aha_idea_watchers",
    new ResourceTemplate(
      "aha://idea/{id}/watchers",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Idea Watchers",
      description: "Get watchers for a specific idea",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = variables.id || pathParts[pathParts.length - 2]; // idea_id is before /watchers

      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }

      try {
        const watchers = await services.AhaService.getIdeaWatchers(ideaId);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(watchers, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving watchers for idea ${ideaId}:`, error);
        throw error;
      }
    }
  );

  // Aha global ideas list resource with advanced filters and pagination
  server.registerResource(
    "aha_ideas",
    new ResourceTemplate(
      "aha://ideas{?query,updatedSince,assignedToUser,status,category,page,perPage}",
      {
        list: undefined,
        complete: {
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Ideas (Global)",
      description: "List all ideas across products with optional filters and pagination",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const page = variables?.page ? parseInt(variables.page) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(variables.perPage) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;
        
        // Include custom_fields in the fields parameter to get custom fields in response
        const fields = 'custom_fields';

        const ideas = await services.AhaService.listIdeas(
          variables?.query || uri.searchParams.get('query') || undefined,
          variables?.updatedSince || uri.searchParams.get('updatedSince') || undefined,
          variables?.assignedToUser || uri.searchParams.get('assignedToUser') || undefined,
          variables?.status || uri.searchParams.get('status') || undefined,
          variables?.category || uri.searchParams.get('category') || undefined,
          fields,
          page,
          perPage
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideas, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error('Error retrieving global ideas list:', error);
        throw error;
      }
    }
  );

  // Aha product releases resource with path variable and pagination
  server.registerResource(
    "aha_product_releases",
    new ResourceTemplate(
      "aha://releases/{product_id}{?query,updatedSince,status,parkingLot,page,perPage}",
      {
        list: undefined,
        complete: {
          parkingLot: async () => ['true', 'false'],
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Product Releases",
      description: "List releases for a specific product with optional filters and pagination",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const productId = variables.product_id || uri.pathname.split('/').pop();
      
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      
      try {
        const parkingLot = variables.parkingLot === 'true' ? true : 
                          variables.parkingLot === 'false' ? false : undefined;
        const page = variables?.page ? parseInt(variables.page) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(variables.perPage) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const releases = await services.AhaService.listReleasesByProduct(
          productId,
          variables?.query || uri.searchParams.get('query') || undefined,
          variables?.updatedSince || uri.searchParams.get('updatedSince') || undefined,
          variables?.status || uri.searchParams.get('status') || undefined,
          parkingLot,
          page,
          perPage
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releases, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving releases list for product ${productId}:`, error);
        throw error;
      }
    }
  );

  // Aha initiative epics resource
  server.registerResource(
    "aha_initiative_epics",
    new ResourceTemplate(
      "aha://initiative/{initiative_id}/epics",
      {
        list: undefined,
        complete: {
          initiative_id: async () => []
        }
      }
    ),
    {
      title: "Aha Initiative Epics",
      description: "Get epics for a specific initiative",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const initiativeId = variables?.initiative_id || pathParts[pathParts.length - 2]; // initiative_id is before /epics

      if (!initiativeId) {
        throw new Error('Invalid initiative ID: Initiative ID is missing from URI');
      }

      try {
        const epics = await services.AhaService.getInitiativeEpics(initiativeId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epics, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics for initiative ${initiativeId}:`, error);
        throw error;
      }
    }
  );

  // Aha custom fields list resource
  server.registerResource(
    "aha_custom_fields",
    "aha://custom-fields",
    async (uri: URL) => {
      try {
        const customFields = await services.AhaService.listCustomFields();

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(customFields, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error retrieving custom fields list:', error);
        throw error;
      }
    }
  );

  // Aha custom field options resource
  server.registerResource(
    "aha_custom_field_options",
    new ResourceTemplate(
      "aha://custom-field/{id}/options",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Custom Field Options",
      description: "Get options for a specific custom field",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const customFieldId = variables.id || pathParts[pathParts.length - 2]; // custom_field_id is before /options

      if (!customFieldId) {
        throw new Error('Invalid custom field ID: Custom field ID is missing from URI');
      }

      try {
        const options = await services.AhaService.listCustomFieldOptions(customFieldId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(options, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving options for custom field ${customFieldId}:`, error);
        throw error;
      }
    }
  );
}
