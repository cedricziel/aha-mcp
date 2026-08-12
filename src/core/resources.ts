import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toMcpError } from "./services/aha-errors.js";
import { ResourceTemplate } from "./uri-template.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import { getAhaService } from "./services/index.js";
import { renderCollection, renderTable, resourceAnnotations } from "./resource-output.js";

/**
 * Helper function to normalize variable values to strings
 * ResourceTemplate variables can be string | string[], but service methods expect string
 */
function normalizeVar(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]; // Take first element if array
  }
  return value;
}

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
    resources: ["aha_release", "aha_product_releases"],
    note: "Releases can function as workstreams for organizing features and epics"
  }
};

/**
 * Table columns for the tier-2 collections (see resources.ts's own notes on the tiering policy
 * below, and renderTable's doc comment in resource-output.ts). These field paths are not read
 * off the permissive `Idea`/`Release` interfaces in aha-types.ts - they are the columns a real
 * `grafana-labs.aha.io` list response was confirmed to populate. `description`,
 * `custom_fields`, `project` and `integration_fields` are deliberately left out: the first is
 * the bulk of the payload, the rest are constant or noise within a single workspace.
 */
const IDEA_TABLE_COLUMNS = [
  { header: "Ref", path: "reference_num" },
  { header: "Name", path: "name" },
  { header: "Status", path: "workflow_status.name" },
  { header: "Created", path: "created_at" }
];

const RELEASE_TABLE_COLUMNS = [
  { header: "Ref", path: "reference_num" },
  { header: "Name", path: "name" },
  { header: "Start", path: "start_date" },
  { header: "Release", path: "release_date" },
  { header: "Owner", path: "owner.name" },
  { header: "ParkingLot", path: "parking_lot" }
];

/**
 * Verified against a live `/api/v1/products` list response: `created_at, id, name,
 * product_line, reference_prefix, url, workspace_type` - no `description`, no `custom_fields`.
 * Aha strips both from the list endpoint exactly as it does for features and epics, so this
 * moved from "unverified, default to tier 3" to tier 2.
 *
 * The first column is `reference_prefix`, not `reference_num` - a product has no
 * `reference_num` of its own, and `reference_prefix` (KG, APPO11Y, DASH, ...) is the identifier
 * people actually address a workspace by. `renderTable` links whatever the first configured
 * column resolves to against `record.url`, so this works without the function assuming a
 * `reference_num` field exists anywhere.
 */
const PRODUCT_TABLE_COLUMNS = [
  { header: "Prefix", path: "reference_prefix" },
  { header: "Name", path: "name" },
  { header: "Type", path: "workspace_type" }
];

/**
 * Register all resources with the MCP server
 *
 * Collection resources render in one of three ways, decided per record type against what the
 * live Aha list endpoint actually returns (see the field notes at each call site below), not
 * against the permissive `aha-types.ts` interfaces, which describe every field a record can
 * carry across every endpoint that returns one:
 *
 * - Tier 1, `renderCollection` (a markdown link list): slim index collections whose records
 *   carry only identity fields (id/name/reference_num/url/created_at/product_id/resource) and
 *   nothing else - features, epics, users, idea organizations, and the `RecordRef` shape used
 *   by relationship and "assigned to me" endpoints. Near-lossless, and cuts most of the bytes a
 *   raw JSON dump would cost. `renderCollection` labels a record by `reference_num` or `name`;
 *   a record with neither is dropped, so nothing without a reliable one of those two fields
 *   belongs here.
 * - Tier 2, `renderTable` (a markdown table): collections carrying a handful of real scalar
 *   columns worth showing - ideas, releases and products are the verified cases (see the
 *   column constants above). Products is the odd one out: it has no `reference_num`, so its
 *   first column links on `reference_prefix` instead - `renderTable` derives the link from
 *   whichever field the caller configures as the first column, not a hardcoded name. Do not
 *   invent a table for another record type without the same kind of verification; a guessed
 *   column set either shows nothing (wrong path) or silently omits a field nobody checked for.
 * - Tier 3, raw `JSON.stringify`: anything else, on purpose. That covers records with real
 *   content beyond identity (a comment's `body`, a todo's `body`, a competitor's
 *   `strengths`/`weaknesses`) and records with nested relationship arrays (goals nest features,
 *   initiatives, key_results and releases; custom field definitions nest their options) -
 *   either would be flattened away by a table or dropped entirely by a link list. Comments in
 *   particular can never be tier 1: `Comment` carries `id`, `body` and `url` but never
 *   `reference_num` or `name`, so `renderCollection` would drop every one of them and the body
 *   - the entire payload - would vanish. When a collection's shape has not been checked against
 *   a real response, this is the default, not tier 1 or 2 - a conservative miss here costs
 *   tokens; an aggressive miss destroys data.
 *
 * Single-record resources (`aha://feature/{id}` and siblings) are unaffected by any of this -
 * they keep raw JSON unconditionally, because someone reading one specific record wants the
 * data, not a summary of it.
 *
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
              releases_workstreams: "Releases can be used as workstreams. Use aha://releases/{product_id} or aha://release/{id}"
            },
            common_questions: {
              "How do I find workspaces?": "Use aha://products - products and workspaces are synonymous",
              "How do I find Product Areas?": "Product Areas are not currently exposed as resources. Use products instead.",
              "Where are workstreams?": "Releases can function as workstreams - use aha://releases/{product_id}"
            }
          }, null, 2),
          mimeType: "application/json",
          // This is a static guide the server builds itself, not an Aha record - there is no
          // `updated_at` to report, so no record is passed in.
          annotations: resourceAnnotations()
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid idea ID: ID is missing from URI');
      }
      try {
        const idea = await getAhaService().getIdea(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(idea, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(idea as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving idea ${id}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid feature ID: ID is missing from URI');
      }
      try {
        const feature = await getAhaService().getFeature(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(feature, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(feature as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving feature ${id}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid user ID: ID is missing from URI');
      }
      try {
        const user = await getAhaService().getUser(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(user, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(user as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving user ${id}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid epic ID: ID is missing from URI');
      }
      try {
        const epic = await getAhaService().getEpic(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(epic, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(epic as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epic ${id}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha features list resource with pagination and filter parameters
  // Shared handler for both base URI and template URI
  const handleFeatures = async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    try {
      const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
      const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

      const features = await getAhaService().listFeatures(
        normalizeVar(variables?.query) || uri.searchParams.get('query') || undefined,
        normalizeVar(variables?.updatedSince) || uri.searchParams.get('updatedSince') || undefined,
        normalizeVar(variables?.tag) || uri.searchParams.get('tag') || undefined,
        normalizeVar(variables?.assignedToUser) || uri.searchParams.get('assignedToUser') || undefined,
        page,
        perPage
      );

      return {
        contents: [{
          uri: uri.toString(),
          text: renderCollection(features.features ?? [], { title: "Features across all products" }),
          mimeType: "text/markdown",
          annotations: resourceAnnotations()
        }]
      };
    } catch (error) {
      console.error(`Error retrieving features list:`, error);
      throw toMcpError(error, uri.toString());
    }
  };

  // Base URI registration - matches aha://features
  server.registerResource(
    "aha_features",
    "aha://features",
    {
      title: "Aha Features",
      description: "List all features",
      mimeType: "text/markdown"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      return handleFeatures(uri, {}, _extra);
    }
  );

  // Template URI registration - matches aha://features?query=...
  server.registerResource(
    "aha_features_filtered",
    new ResourceTemplate(
      "aha://features{?query,updatedSince,tag,assignedToUser,page,perPage}",
      {
        list: undefined,
        complete: {
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Features (Filtered)",
      description: "List features with filters and pagination",
      mimeType: "text/markdown"
    },
    handleFeatures
  );

  // Aha users list resource
  server.registerResource(
    "aha_users",
    "aha://users",
    {
      title: "Aha Users",
      description: "List all users in your Aha.io account",
      mimeType: "text/markdown"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const users = await getAhaService().listUsers();

        return {
          contents: [{
            uri: uri.toString(),
            text: renderCollection(users.users ?? [], { title: "Users in your Aha.io account" }),
            mimeType: "text/markdown",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving users list:`, error);
        throw toMcpError(error, uri.toString());
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
      mimeType: "text/markdown"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const productId = normalizeVar(variables.product_id) || pathParts[pathParts.length - 1];

      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }

      try {
        const epics = await getAhaService().listEpics(productId);

        return {
          contents: [{
            uri: uri.toString(),
            text: renderCollection(epics.epics ?? [], { title: `Epics in product ${productId}` }),
            mimeType: "text/markdown",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics list for product ${productId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid product ID: ID is missing from URI');
      }
      try {
        const product = await getAhaService().getProduct(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(product, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(product as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving product ${id}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha products list resource with pagination parameters
  // Shared handler for both base URI and template URI
  const handleProducts = async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    try {
      const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
      const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

      const products = await getAhaService().listProducts(
        normalizeVar(variables?.updatedSince) || uri.searchParams.get('updatedSince') || undefined,
        page,
        perPage
      );

      // Tier 2: verified against a live /api/v1/products response (see PRODUCT_TABLE_COLUMNS) -
      // no description, no custom_fields, so a table loses nothing renderCollection wouldn't
      // already drop, and keeps reference_prefix, which a bare link list would have to omit.
      return {
        contents: [{
          uri: uri.toString(),
          text: renderTable(products.products ?? [], { title: "Products (workspaces)", columns: PRODUCT_TABLE_COLUMNS }),
          mimeType: "text/markdown",
          annotations: resourceAnnotations()
        }]
      };
    } catch (error) {
      console.error(`Error retrieving products list:`, error);
      throw toMcpError(error, uri.toString());
    }
  };

  // Base URI registration - matches aha://products
  server.registerResource(
    "aha_products",
    "aha://products",
    {
      title: "Aha Products (Workspaces)",
      description: "List all products/workspaces. In Aha.io, products and workspaces are synonymous.",
      mimeType: "text/markdown"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      return handleProducts(uri, {}, _extra);
    }
  );

  // Template URI registration - matches aha://products?updatedSince=...
  server.registerResource(
    "aha_products_filtered",
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
      title: "Aha Products (Workspaces, Filtered)",
      description: "List products/workspaces with filters and pagination",
      mimeType: "text/markdown"
    },
    handleProducts
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid initiative ID: ID is missing from URI');
      }
      try {
        const initiative = await getAhaService().getInitiative(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(initiative, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(initiative as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving initiative ${id}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha initiatives list resource with advanced filters and pagination
  // Shared handler for both base URI and template URI
  const handleInitiatives = async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    try {
      const onlyActive = variables?.onlyActive === 'true' ? true :
                        variables?.onlyActive === 'false' ? false :
                        uri.searchParams.get('onlyActive') === 'true' ? true :
                        uri.searchParams.get('onlyActive') === 'false' ? false : undefined;
      const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
      const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

      const initiatives = await getAhaService().listInitiatives(
        normalizeVar(variables?.query) || uri.searchParams.get('query') || undefined,
        normalizeVar(variables?.updatedSince) || uri.searchParams.get('updatedSince') || undefined,
        normalizeVar(variables?.assignedToUser) || uri.searchParams.get('assignedToUser') || undefined,
        onlyActive,
        page,
        perPage
      );

      // Tier 3: Initiative nests goals/features/releases (RecordRef[]) plus description and
      // workflow_status - the same "fat collection" shape as goals, not a slim index.
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(initiatives, null, 2),
          mimeType: "application/json",
          annotations: resourceAnnotations()
        }]
      };
    } catch (error) {
      console.error(`Error retrieving initiatives list:`, error);
      throw toMcpError(error, uri.toString());
    }
  };

  // Base URI registration - matches aha://initiatives
  server.registerResource(
    "aha_initiatives",
    "aha://initiatives",
    {
      title: "Aha Initiatives",
      description: "List all initiatives",
      mimeType: "application/json"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      return handleInitiatives(uri, {}, _extra);
    }
  );

  // Template URI registration - matches aha://initiatives?query=...
  server.registerResource(
    "aha_initiatives_filtered",
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
      title: "Aha Initiatives (Filtered)",
      description: "List initiatives with filters and pagination",
      mimeType: "application/json"
    },
    handleInitiatives
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
      mimeType: "text/markdown"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const productId = normalizeVar(variables.product_id) || pathParts[pathParts.length - 1];

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

        const ideas = await getAhaService().listIdeasByProduct(
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
            text: renderTable(ideas.ideas ?? [], { title: `Ideas in product ${productId}`, columns: IDEA_TABLE_COLUMNS }),
            mimeType: "text/markdown",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving ideas list for product ${productId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const epicId = normalizeVar(variables?.epic_id) || pathParts[pathParts.length - 1];

      if (!epicId) {
        throw new Error('Invalid epic ID: Epic ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getEpicComments(epicId);

        // Tier 3: a Comment carries `body`, `url` and `id` but never `reference_num` or `name`,
        // so renderCollection would drop every comment - the entire payload - for lack of a
        // label. The body is the payload here; raw JSON is the only channel for it.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for epic ${epicId}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha feature comments resource
  server.registerResource(
    "aha_feature_comments",
    new ResourceTemplate(
      "aha://comments/feature/{feature_id}",
      {
        list: undefined,
        complete: {
          feature_id: async () => []
        }
      }
    ),
    {
      title: "Aha Feature Comments",
      description: "Get comments for a specific feature",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const featureId = normalizeVar(variables.feature_id) || pathParts[pathParts.length - 1];

      if (!featureId) {
        throw new Error('Invalid feature ID: Feature ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getFeatureComments(featureId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for feature ${featureId}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  /**
   * An idea's *portal* comments, which `aha://comments/idea/{id}` does not return - the two
   * endpoints hold disjoint records, and the portal side is where a customer's own words are.
   * Kept as a separate URI rather than merged into the other resource so that neither one
   * silently changes meaning; the `aha_list_comments` tool is what merges them for a caller
   * who wants the whole conversation.
   */
  server.registerResource(
    "aha_idea_portal_comments",
    new ResourceTemplate(
      "aha://idea-comments/{idea_id}",
      {
        list: undefined,
        complete: {
          idea_id: async () => []
        }
      }
    ),
    {
      title: "Aha Idea Portal Comments",
      description:
        "Get an idea's ideas-portal comments, including anything a customer wrote. These are " +
        "different records from aha://comments/idea/{idea_id}, which holds internal comments only.",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = normalizeVar(variables.idea_id) || pathParts[pathParts.length - 1];

      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getIdeaPortalComments(ideaId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving portal comments for idea ${ideaId}:`, error);
        throw toMcpError(error, uri.toString());
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
      description:
        "Get internal comments for a specific idea. This does not include the ideas-portal " +
        "conversation - read aha://idea-comments/{idea_id} for that.",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = normalizeVar(variables.idea_id) || pathParts[pathParts.length - 1];

      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getIdeaComments(ideaId);

        // Tier 3: see the epic comments resource above for why comments can never be tier 1.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for idea ${ideaId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const initiativeId = normalizeVar(variables?.initiative_id) || pathParts[pathParts.length - 1];

      if (!initiativeId) {
        throw new Error('Invalid initiative ID: Initiative ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getInitiativeComments(initiativeId);

        // Tier 3: see the epic comments resource above for why comments can never be tier 1.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for initiative ${initiativeId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const productId = normalizeVar(variables.product_id) || pathParts[pathParts.length - 1];

      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getProductComments(productId);

        // Tier 3: see the epic comments resource above for why comments can never be tier 1.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for product ${productId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const goalId = normalizeVar(variables?.goal_id) || pathParts[pathParts.length - 1];

      if (!goalId) {
        throw new Error('Invalid goal ID: Goal ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getGoalComments(goalId);

        // Tier 3: see the epic comments resource above for why comments can never be tier 1.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for goal ${goalId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const releaseId = normalizeVar(variables?.release_id) || pathParts[pathParts.length - 1];

      if (!releaseId) {
        throw new Error('Invalid release ID: Release ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getReleaseComments(releaseId);

        // Tier 3: see the epic comments resource above for why comments can never be tier 1.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for release ${releaseId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const releasePhaseId = normalizeVar(variables?.release_phase_id) || pathParts[pathParts.length - 1];

      if (!releasePhaseId) {
        throw new Error('Invalid release phase ID: Release phase ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getReleasePhaseComments(releasePhaseId);

        // Tier 3: see the epic comments resource above for why comments can never be tier 1.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for release phase ${releasePhaseId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const requirementId = normalizeVar(variables?.requirement_id) || pathParts[pathParts.length - 1];

      if (!requirementId) {
        throw new Error('Invalid requirement ID: Requirement ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getRequirementComments(requirementId);

        // Tier 3: see the epic comments resource above for why comments can never be tier 1.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for requirement ${requirementId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const todoId = normalizeVar(variables?.todo_id) || pathParts[pathParts.length - 1];

      if (!todoId) {
        throw new Error('Invalid todo ID: Todo ID is missing from URI');
      }

      try {
        const comments = await getAhaService().getTodoComments(todoId);

        // Tier 3: see the epic comments resource above for why comments can never be tier 1.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(comments, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving comments for todo ${todoId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid goal ID: ID is missing from URI');
      }
      try {
        const goal = await getAhaService().getGoal(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(goal, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(goal as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving goal ${id}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha goals list resource with filters and pagination
  // Shared handler for both base URI and template URI
  const handleGoals = async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    try {
      const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
      const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

      const goals = await getAhaService().listGoals(
        normalizeVar(variables?.query) || uri.searchParams.get('query') || undefined,
        normalizeVar(variables?.updatedSince) || uri.searchParams.get('updatedSince') || undefined,
        normalizeVar(variables?.assignedToUser) || uri.searchParams.get('assignedToUser') || undefined,
        normalizeVar(variables?.status) || uri.searchParams.get('status') || undefined,
        page,
        perPage
      );

      // Tier 3: the known fat-collection case - a Goal nests features, initiatives,
      // key_results and releases, none of which a link list or table can carry.
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(goals, null, 2),
          mimeType: "application/json",
          annotations: resourceAnnotations()
        }]
      };
    } catch (error) {
      console.error(`Error retrieving goals list:`, error);
      throw toMcpError(error, uri.toString());
    }
  };

  // Base URI registration - matches aha://goals
  server.registerResource(
    "aha_goals",
    "aha://goals",
    {
      title: "Aha Goals",
      description: "List all goals",
      mimeType: "application/json"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      return handleGoals(uri, {}, _extra);
    }
  );

  // Template URI registration - matches aha://goals?query=...
  server.registerResource(
    "aha_goals_filtered",
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
      title: "Aha Goals (Filtered)",
      description: "List goals with filters and pagination",
      mimeType: "application/json"
    },
    handleGoals
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
      mimeType: "text/markdown"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const goalId = normalizeVar(variables?.goal_id) || pathParts[pathParts.length - 2]; // goal_id is before /epics

      if (!goalId) {
        throw new Error('Invalid goal ID: Goal ID is missing from URI');
      }

      try {
        const epics = await getAhaService().getGoalEpics(goalId);

        return {
          contents: [{
            uri: uri.toString(),
            text: renderCollection(epics.epics ?? [], { title: `Epics linked to goal ${goalId}` }),
            mimeType: "text/markdown",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics for goal ${goalId}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha key result resource
  //
  // A key result carries no `url` of its own, so this URI is the only stable pointer to one -
  // which is also why the tools link to it rather than to an Aha web page.
  server.registerResource(
    "aha_key_result",
    new ResourceTemplate(
      "aha://key_result/{id}",
      {
        list: undefined,
        complete: {
          id: async () => []
        }
      }
    ),
    {
      title: "Aha Key Result",
      description: "Get a specific key result by ID",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid key result ID: ID is missing from URI');
      }
      try {
        const keyResult = await getAhaService().getKeyResult(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(keyResult, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving key result ${id}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha goal key results resource
  server.registerResource(
    "aha_goal_key_results",
    new ResourceTemplate(
      "aha://goal/{goal_id}/key_results",
      {
        list: undefined,
        complete: {
          goal_id: async () => []
        }
      }
    ),
    {
      title: "Aha Goal Key Results",
      description: "Get key results for a specific goal",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const goalId = normalizeVar(variables?.goal_id) || pathParts[pathParts.length - 2]; // goal_id is before /key_results

      if (!goalId) {
        throw new Error('Invalid goal ID: Goal ID is missing from URI');
      }

      try {
        const keyResults = await getAhaService().listKeyResults(goalId);

        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(keyResults, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        console.error(`Error retrieving key results for goal ${goalId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid release ID: ID is missing from URI');
      }
      try {
        const release = await getAhaService().getRelease(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(release, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(release as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving release ${id}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Note: a global "list all releases" resource (GET /releases) was removed - that endpoint
  // does not exist in Aha's OpenAPI document or published docs and always 404s. Releases are
  // only reachable scoped to a product; see aha_product_releases (aha://releases/{product_id}).

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
      mimeType: "text/markdown"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const releaseId = normalizeVar(variables?.release_id) || pathParts[pathParts.length - 2]; // release_id is before /features

      if (!releaseId) {
        throw new Error('Invalid release ID: Release ID is missing from URI');
      }

      try {
        const features = await getAhaService().getReleaseFeatures(releaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: renderCollection(features.features ?? [], { title: `Features in release ${releaseId}` }),
            mimeType: "text/markdown",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving features for release ${releaseId}:`, error);
        throw toMcpError(error, uri.toString());
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
      mimeType: "text/markdown"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const releaseId = normalizeVar(variables?.release_id) || pathParts[pathParts.length - 2]; // release_id is before /epics

      if (!releaseId) {
        throw new Error('Invalid release ID: Release ID is missing from URI');
      }

      try {
        const epics = await getAhaService().getReleaseEpics(releaseId);

        return {
          contents: [{
            uri: uri.toString(),
            text: renderCollection(epics.epics ?? [], { title: `Epics in release ${releaseId}` }),
            mimeType: "text/markdown",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics for release ${releaseId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid release phase ID: ID is missing from URI');
      }
      try {
        const releasePhase = await getAhaService().getReleasePhase(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releasePhase, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(releasePhase as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving release phase ${id}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha release phases list resource
  server.registerResource(
    "aha_release_phases",
    "aha://release-phases",
    {
      title: "Aha Release Phases",
      description: "List all release phases in your Aha.io account",
      mimeType: "application/json"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const releasePhases = await getAhaService().listReleasePhases();

        // Tier 3, and not by choice: `/api/v1/products/KG/release_phases` returns HTTP 500 on
        // a live account, so there is no payload to verify a slimmer rendering against at all.
        // Raw JSON stays until Aha's own endpoint works.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(releasePhases, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving release phases list:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid requirement ID: ID is missing from URI');
      }
      try {
        const requirement = await getAhaService().getRequirement(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(requirement, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(requirement as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving requirement ${id}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid competitor ID: ID is missing from URI');
      }
      try {
        const competitor = await getAhaService().getCompetitor(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(competitor, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(competitor as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving competitor ${id}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid todo ID: ID is missing from URI');
      }
      try {
        const todo = await getAhaService().getTodo(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(todo, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(todo as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving todo ${id}:`, error);
        throw toMcpError(error, uri.toString());
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
      const productId = normalizeVar(variables.product_id) || uri.pathname.split('/').pop();
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      try {
        const competitors = await getAhaService().listCompetitors(productId);
        // Tier 3: Competitor carries description/strengths/weaknesses - real content a link
        // list would throw away.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(competitors, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving competitors for product ${productId}:`, error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid strategic model ID: ID is missing from URI');
      }
      try {
        const strategicModel = await getAhaService().getStrategicModel(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(strategicModel, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(strategicModel as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving strategic model ${id}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha strategic models list resource with filters and pagination
  // Shared handler for both base URI and template URI
  const handleStrategicModels = async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    try {
      const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
      const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

      const strategicModels = await getAhaService().listStrategicModels(
        normalizeVar(variables?.query) || uri.searchParams.get('query') || undefined,
        normalizeVar(variables?.type) || uri.searchParams.get('type') || undefined,
        normalizeVar(variables?.updatedSince) || uri.searchParams.get('updatedSince') || undefined,
        page,
        perPage
      );
      // Tier 3, and genuinely unverifiable rather than merely unverified: both
      // `/api/v1/strategic_models` and `/api/v1/products/KG/strategic_models` return 404 on a
      // live account. Per this repo's own error-handling rule (see aha-errors.ts / CLAUDE.md),
      // a 404 means "missing or invisible to this token" - it cannot tell us whether the
      // account has no strategic models or whether the endpoint itself does not exist for this
      // plan/version. This may be another phantom endpoint of the kind commit a076e74 removed;
      // worth checking with a token that has strategic models before the next release, but
      // removing the resource now is out of scope here. Raw JSON stays either way.
      return {
        contents: [{
          uri: uri.toString(),
          text: JSON.stringify(strategicModels, null, 2),
          mimeType: "application/json",
          annotations: resourceAnnotations()
        }]
      };
    } catch (error) {
      console.error('Error retrieving strategic models list:', error);
      throw toMcpError(error, uri.toString());
    }
  };

  // Base URI registration - matches aha://strategic-models
  server.registerResource(
    "aha_strategic_models",
    "aha://strategic-models",
    {
      title: "Aha Strategic Models",
      description: "List all strategic models",
      mimeType: "application/json"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      return handleStrategicModels(uri, {}, _extra);
    }
  );

  // Template URI registration - matches aha://strategic-models?query=...
  server.registerResource(
    "aha_strategic_models_filtered",
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
      title: "Aha Strategic Models (Filtered)",
      description: "List strategic models with filters and pagination",
      mimeType: "application/json"
    },
    handleStrategicModels
  );

  // Aha todos list resource
  server.registerResource(
    "aha_todos",
    "aha://todos",
    {
      title: "Aha Todos",
      description: "List all todos in your Aha.io account",
      mimeType: "application/json"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const todos = await getAhaService().listTodos();
        // Tier 3: Todo carries a `body` - the task's own content - the same reason comments
        // can never be tier 1.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(todos, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error('Error retrieving todos list:', error);
        throw toMcpError(error, uri.toString());
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
      const id = normalizeVar(variables.id) || uri.pathname.split('/').pop();
      if (!id) {
        throw new Error('Invalid idea organization ID: ID is missing from URI');
      }
      try {
        const ideaOrganization = await getAhaService().getIdeaOrganization(id);
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(ideaOrganization, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(ideaOrganization as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error(`Error retrieving idea organization ${id}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha idea organizations list resource with filters and pagination
  // Shared handler for both base URI and template URI
  const handleIdeaOrganizations = async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    try {
      const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
      const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

      const ideaOrganizations = await getAhaService().listIdeaOrganizations(
        normalizeVar(variables?.query) || uri.searchParams.get('query') || undefined,
        normalizeVar(variables?.emailDomain) || uri.searchParams.get('emailDomain') || undefined,
        page,
        perPage
      );
      // Tier 1: verified against a live /api/v1/idea_organizations response - created_at, id,
      // name, resource, url. A slim index with nothing but identity fields, so a link list
      // loses nothing.
      return {
        contents: [{
          uri: uri.toString(),
          text: renderCollection(ideaOrganizations.idea_organizations ?? [], { title: "Idea organizations" }),
          mimeType: "text/markdown",
          annotations: resourceAnnotations()
        }]
      };
    } catch (error) {
      console.error('Error retrieving idea organizations list:', error);
      throw toMcpError(error, uri.toString());
    }
  };

  // Base URI registration - matches aha://idea-organizations
  server.registerResource(
    "aha_idea_organizations",
    "aha://idea-organizations",
    {
      title: "Aha Idea Organizations",
      description: "List all idea organizations",
      mimeType: "text/markdown"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      return handleIdeaOrganizations(uri, {}, _extra);
    }
  );

  // Template URI registration - matches aha://idea-organizations?query=...
  server.registerResource(
    "aha_idea_organizations_filtered",
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
      title: "Aha Idea Organizations (Filtered)",
      description: "List idea organizations with filters and pagination",
      mimeType: "text/markdown"
    },
    handleIdeaOrganizations
  );

  // Aha me/current user profile resource
  server.registerResource(
    "aha_me_profile",
    "aha://me/profile",
    {
      title: "My Profile",
      description: "Get the current user's profile information",
      mimeType: "application/json"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const profile = await getAhaService().getMe();
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(profile, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations(profile as Record<string, unknown>)
          }]
        };
      } catch (error) {
        console.error('Error retrieving user profile:', error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha me/current user assigned records resource
  server.registerResource(
    "aha_me_assigned_records",
    "aha://me/assigned-records",
    {
      title: "My Assigned Records",
      description: "Get records assigned to the current user",
      mimeType: "text/markdown"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const assignedRecords = await getAhaService().getAssignedRecords();
        return {
          contents: [{
            uri: uri.toString(),
            text: renderCollection(assignedRecords.records ?? [], { title: "Records assigned to you" }),
            mimeType: "text/markdown",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error('Error retrieving assigned records:', error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha me/current user pending tasks resource
  server.registerResource(
    "aha_me_pending_tasks",
    "aha://me/pending-tasks",
    {
      title: "My Pending Tasks",
      description: "Get pending tasks for the current user",
      mimeType: "application/json"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const pendingTasks = await getAhaService().getPendingTasks();
        // Tier 3: these are Todo records, which carry a `body` - see the todos resource above.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(pendingTasks, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error('Error retrieving pending tasks:', error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha idea endorsements resource
  server.registerResource(
    "aha_idea_endorsements",
    new ResourceTemplate(
      "aha://idea/{id}/endorsements{?proxy,page,perPage}",
      {
        list: undefined,
        complete: {
          id: async () => [],
          proxy: async () => ['true', 'false'],
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Idea Endorsements",
      description: "Get endorsements for a specific idea with optional pagination and proxy filter",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = normalizeVar(variables.id) || pathParts[pathParts.length - 2]; // idea_id is before /endorsements

      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }

      try {
        // Extract pagination parameters
        const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        // Extract proxy parameter (boolean)
        const proxyParam = normalizeVar(variables?.proxy) || uri.searchParams.get('proxy');
        const proxy = proxyParam === 'true' ? true : proxyParam === 'false' ? false : undefined;

        const endorsements = await getAhaService().getIdeaEndorsements(ideaId, proxy, page, perPage);
        // Tier 3: IdeaEndorsement carries neither `reference_num` nor `name` - only nested
        // RecordRef relations (endorsed_by_*) - so renderCollection has nothing to label it
        // with, and no verified column set exists for a table either.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(endorsements, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving endorsements for idea ${ideaId}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha idea votes resource
  server.registerResource(
    "aha_idea_votes",
    new ResourceTemplate(
      "aha://idea/{id}/votes{?page,perPage}",
      {
        list: undefined,
        complete: {
          id: async () => [],
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200']
        }
      }
    ),
    {
      title: "Aha Idea Votes",
      description: "Get votes for a specific idea with optional pagination",
      mimeType: "application/json"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const ideaId = normalizeVar(variables.id) || pathParts[pathParts.length - 2]; // idea_id is before /votes

      if (!ideaId) {
        throw new Error('Invalid idea ID: Idea ID is missing from URI');
      }

      try {
        // Extract pagination parameters
        const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const votes = await getAhaService().getIdeaVotes(ideaId, page, perPage);
        // Tier 3: same shape as idea endorsements above - no reference_num/name to label with.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(votes, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving votes for idea ${ideaId}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Note: aha_idea_watchers (GET /ideas/{id}/watchers) was removed - that endpoint does not
  // exist in Aha's OpenAPI document or published docs and always 404s.

  // Aha global ideas list resource with advanced filters and pagination
  // Shared handler for both base URI and template URI
  const handleIdeas = async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    try {
      const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
      const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

      // Make fields parameter configurable instead of hardcoded
      const fields = normalizeVar(variables?.fields) || uri.searchParams.get('fields') || 'custom_fields';

      // Extract spam parameter (boolean)
      const spamParam = normalizeVar(variables?.spam) || uri.searchParams.get('spam');
      const spam = spamParam === 'true' ? true : spamParam === 'false' ? false : undefined;

      const ideas = await getAhaService().listIdeas(
        normalizeVar(variables?.query) || uri.searchParams.get('query') || undefined,
        normalizeVar(variables?.updatedSince) || uri.searchParams.get('updatedSince') || undefined,
        normalizeVar(variables?.assignedToUser) || uri.searchParams.get('assignedToUser') || undefined,
        normalizeVar(variables?.status) || uri.searchParams.get('status') || undefined,
        normalizeVar(variables?.category) || uri.searchParams.get('category') || undefined,
        fields,
        page,
        perPage,
        normalizeVar(variables?.productId) || uri.searchParams.get('productId') || undefined,
        normalizeVar(variables?.ideaPortalId) || uri.searchParams.get('ideaPortalId') || undefined,
        spam,
        normalizeVar(variables?.workflowStatus) || uri.searchParams.get('workflowStatus') || undefined,
        (normalizeVar(variables?.sort) || uri.searchParams.get('sort') || undefined) as 'recent' | 'trending' | 'popular' | undefined,
        normalizeVar(variables?.createdBefore) || uri.searchParams.get('createdBefore') || undefined,
        normalizeVar(variables?.createdSince) || uri.searchParams.get('createdSince') || undefined,
        normalizeVar(variables?.tag) || uri.searchParams.get('tag') || undefined,
        normalizeVar(variables?.userId) || uri.searchParams.get('userId') || undefined,
        normalizeVar(variables?.ideaUserId) || uri.searchParams.get('ideaUserId') || undefined
      );

      return {
        contents: [{
          uri: uri.toString(),
          text: renderTable(ideas.ideas ?? [], { title: "Ideas across all products", columns: IDEA_TABLE_COLUMNS }),
          mimeType: "text/markdown",
          annotations: resourceAnnotations()
        }]
      };
    } catch (error) {
      console.error('Error retrieving global ideas list:', error);
      throw toMcpError(error, uri.toString());
    }
  };

  // Base URI registration - matches aha://ideas
  server.registerResource(
    "aha_ideas",
    "aha://ideas",
    {
      title: "Aha Ideas (Global)",
      description: "List all ideas across products",
      mimeType: "text/markdown"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      return handleIdeas(uri, {}, _extra);
    }
  );

  // Template URI registration - matches aha://ideas?query=...
  server.registerResource(
    "aha_ideas_filtered",
    new ResourceTemplate(
      "aha://ideas{?query,updatedSince,assignedToUser,status,category,page,perPage,productId,ideaPortalId,spam,workflowStatus,sort,createdBefore,createdSince,tag,userId,ideaUserId,fields}",
      {
        list: undefined,
        complete: {
          page: async () => ['1', '2', '3', '4', '5'],
          perPage: async () => ['20', '50', '100', '200'],
          spam: async () => ['true', 'false'],
          sort: async () => ['recent', 'trending', 'popular']
        }
      }
    ),
    {
      title: "Aha Ideas (Global, Filtered)",
      description: "List ideas with comprehensive filters and pagination. Supports filtering by product, portal, tags, dates, workflow status, spam, sort order, and more.",
      mimeType: "text/markdown"
    },
    handleIdeas
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
      mimeType: "text/markdown"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const productId = normalizeVar(variables.product_id) || uri.pathname.split('/').pop();
      
      if (!productId) {
        throw new Error('Invalid product ID: Product ID is missing from URI');
      }
      
      try {
        const parkingLot = normalizeVar(variables.parkingLot) === 'true' ? true :
                          normalizeVar(variables.parkingLot) === 'false' ? false : undefined;
        const page = variables?.page ? parseInt(normalizeVar(variables.page)!) : uri.searchParams.get('page') ? parseInt(uri.searchParams.get('page')!) : undefined;
        const perPage = variables?.perPage ? parseInt(normalizeVar(variables.perPage)!) : uri.searchParams.get('perPage') ? parseInt(uri.searchParams.get('perPage')!) : undefined;

        const releases = await getAhaService().listReleasesByProduct(
          productId,
          normalizeVar(variables?.query) || uri.searchParams.get('query') || undefined,
          normalizeVar(variables?.updatedSince) || uri.searchParams.get('updatedSince') || undefined,
          normalizeVar(variables?.status) || uri.searchParams.get('status') || undefined,
          parkingLot,
          page,
          perPage
        );

        return {
          contents: [{
            uri: uri.toString(),
            text: renderTable(releases.releases ?? [], { title: `Releases in product ${productId}`, columns: RELEASE_TABLE_COLUMNS }),
            mimeType: "text/markdown",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving releases list for product ${productId}:`, error);
        throw toMcpError(error, uri.toString());
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
      mimeType: "text/markdown"
    },
    async (uri: URL, variables: Variables, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const pathParts = uri.pathname.split('/');
      const initiativeId = normalizeVar(variables?.initiative_id) || pathParts[pathParts.length - 2]; // initiative_id is before /epics

      if (!initiativeId) {
        throw new Error('Invalid initiative ID: Initiative ID is missing from URI');
      }

      try {
        const epics = await getAhaService().getInitiativeEpics(initiativeId);

        return {
          contents: [{
            uri: uri.toString(),
            text: renderCollection(epics.epics ?? [], { title: `Epics in initiative ${initiativeId}` }),
            mimeType: "text/markdown",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving epics for initiative ${initiativeId}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );

  // Aha custom fields list resource
  server.registerResource(
    "aha_custom_fields",
    "aha://custom-fields",
    {
      title: "Aha Custom Fields",
      description: "List all custom fields in your Aha.io account",
      mimeType: "application/json"
    },
    async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      try {
        const customFields = await getAhaService().listCustomFields();

        // Tier 3: each definition nests its own `options` array - the field's possible values -
        // which a link list would drop entirely.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(customFields, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error('Error retrieving custom fields list:', error);
        throw toMcpError(error, uri.toString());
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
      const customFieldId = normalizeVar(variables.id) || pathParts[pathParts.length - 2]; // custom_field_id is before /options

      if (!customFieldId) {
        throw new Error('Invalid custom field ID: Custom field ID is missing from URI');
      }

      try {
        const options = await getAhaService().listCustomFieldOptions(customFieldId);

        // Tier 3: CustomFieldOption carries `text`/`value`, never `reference_num` or `name`, so
        // renderCollection has nothing to label it with - same failure mode as comments.
        return {
          contents: [{
            uri: uri.toString(),
            text: JSON.stringify(options, null, 2),
            mimeType: "application/json",
            annotations: resourceAnnotations()
          }]
        };
      } catch (error) {
        console.error(`Error retrieving options for custom field ${customFieldId}:`, error);
        throw toMcpError(error, uri.toString());
      }
    }
  );
}
