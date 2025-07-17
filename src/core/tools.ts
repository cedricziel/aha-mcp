import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as services from "./services/index.js";

/**
 * Register all tools with the MCP server
 *
 * @param server The MCP server instance
 */
export function registerTools(server: McpServer) {

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

  // Get requirement comments tool
  server.tool(
    "aha_get_requirement_comments",
    "Get comments for a specific requirement from Aha.io",
    {
      requirementId: z.string().describe("ID of the requirement")
    },
    async (params: { requirementId: string }) => {
      try {
        const comments = await services.AhaService.getRequirementComments(params.requirementId);

        return {
          content: [
            {
              type: "text",
              text: `Comments for requirement ${params.requirementId}:\n\n${JSON.stringify(comments, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting requirement comments: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get todo comments tool
  server.tool(
    "aha_get_todo_comments",
    "Get comments for a specific todo from Aha.io",
    {
      todoId: z.string().describe("ID of the todo")
    },
    async (params: { todoId: string }) => {
      try {
        const comments = await services.AhaService.getTodoComments(params.todoId);

        return {
          content: [
            {
              type: "text",
              text: `Comments for todo ${params.todoId}:\n\n${JSON.stringify(comments, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting todo comments: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ============================
  // RELATIONSHIP/ASSOCIATION TOOLS
  // ============================

  // Associate feature with epic tool
  server.tool(
    "aha_associate_feature_with_epic",
    "Associate a feature with an epic in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      epicId: z.string().describe("ID or name of the epic")
    },
    async (params: { featureId: string; epicId: string }) => {
      try {
        const feature = await services.AhaService.associateFeatureWithEpic(params.featureId, params.epicId);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} successfully associated with epic ${params.epicId}:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error associating feature with epic: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Move feature to release tool
  server.tool(
    "aha_move_feature_to_release",
    "Move a feature to a different release in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      releaseId: z.string().describe("ID or key of the target release")
    },
    async (params: { featureId: string; releaseId: string }) => {
      try {
        const feature = await services.AhaService.moveFeatureToRelease(params.featureId, params.releaseId);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} successfully moved to release ${params.releaseId}:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error moving feature to release: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Associate feature with goals tool
  server.tool(
    "aha_associate_feature_with_goals",
    "Associate a feature with multiple goals in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      goalIds: z.array(z.number()).describe("Array of goal IDs to associate with the feature")
    },
    async (params: { featureId: string; goalIds: number[] }) => {
      try {
        const feature = await services.AhaService.associateFeatureWithGoals(params.featureId, params.goalIds);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} successfully associated with goals ${params.goalIds.join(', ')}:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error associating feature with goals: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature tags tool
  server.tool(
    "aha_update_feature_tags",
    "Update tags for a feature in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      tags: z.array(z.string()).describe("Array of tag strings to associate with the feature")
    },
    async (params: { featureId: string; tags: string[] }) => {
      try {
        const feature = await services.AhaService.updateFeatureTags(params.featureId, params.tags);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} tags successfully updated to [${params.tags.join(', ')}]:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating feature tags: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create epic in product tool
  server.tool(
    "aha_create_epic_in_product",
    "Create an epic within a specific product in Aha.io",
    {
      productId: z.string().describe("ID of the product"),
      epicData: z.object({
        epic: z.object({
          name: z.string().describe("Name of the epic"),
          description: z.string().optional().describe("Description of the epic")
        }).describe("Epic data object")
      }).describe("Epic creation data")
    },
    async (params: { productId: string; epicData: any }) => {
      try {
        const epic = await services.AhaService.createEpicInProduct(params.productId, params.epicData);

        return {
          content: [
            {
              type: "text",
              text: `Epic successfully created in product ${params.productId}:\n\n${JSON.stringify(epic, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating epic in product: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create epic in release tool
  server.tool(
    "aha_create_epic_in_release",
    "Create an epic within a specific release in Aha.io",
    {
      releaseId: z.string().describe("ID of the release"),
      epicData: z.object({
        epic: z.object({
          name: z.string().describe("Name of the epic"),
          description: z.string().optional().describe("Description of the epic")
        }).describe("Epic data object")
      }).describe("Epic creation data")
    },
    async (params: { releaseId: string; epicData: any }) => {
      try {
        const epic = await services.AhaService.createEpicInRelease(params.releaseId, params.epicData);

        return {
          content: [
            {
              type: "text",
              text: `Epic successfully created in release ${params.releaseId}:\n\n${JSON.stringify(epic, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating epic in release: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create initiative in product tool
  server.tool(
    "aha_create_initiative_in_product",
    "Create an initiative within a specific product in Aha.io",
    {
      productId: z.string().describe("ID of the product"),
      initiativeData: z.object({
        initiative: z.object({
          name: z.string().describe("Name of the initiative"),
          description: z.string().optional().describe("Description of the initiative")
        }).describe("Initiative data object")
      }).describe("Initiative creation data")
    },
    async (params: { productId: string; initiativeData: any }) => {
      try {
        const initiative = await services.AhaService.createInitiativeInProduct(params.productId, params.initiativeData);

        return {
          content: [
            {
              type: "text",
              text: `Initiative successfully created in product ${params.productId}:\n\n${JSON.stringify(initiative, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating initiative in product: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ============================
  // FEATURE CRUD TOOLS (PHASE 8A.1)
  // ============================

  // Create feature tool
  server.tool(
    "aha_create_feature",
    "Create a feature within a specific release in Aha.io",
    {
      releaseId: z.string().describe("ID of the release"),
      featureData: z.object({
        feature: z.object({
          name: z.string().describe("Name of the feature"),
          description: z.string().optional().describe("Description of the feature")
        }).describe("Feature data object")
      }).describe("Feature creation data")
    },
    async (params: { releaseId: string; featureData: any }) => {
      try {
        const feature = await services.AhaService.createFeature(params.releaseId, params.featureData);

        return {
          content: [
            {
              type: "text",
              text: `Feature successfully created in release ${params.releaseId}:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating feature: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature tool
  server.tool(
    "aha_update_feature",
    "Update a feature in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      featureData: z.object({
        feature: z.object({
          name: z.string().optional().describe("Name of the feature"),
          description: z.string().optional().describe("Description of the feature")
        }).describe("Feature data object")
      }).describe("Feature update data")
    },
    async (params: { featureId: string; featureData: any }) => {
      try {
        const feature = await services.AhaService.updateFeature(params.featureId, params.featureData);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} successfully updated:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating feature: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete feature tool
  server.tool(
    "aha_delete_feature",
    "Delete a feature in Aha.io",
    {
      featureId: z.string().describe("ID of the feature")
    },
    async (params: { featureId: string }) => {
      try {
        await services.AhaService.deleteFeature(params.featureId);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} successfully deleted`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting feature: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature progress tool
  server.tool(
    "aha_update_feature_progress",
    "Update a feature's progress in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      progress: z.number().min(0).max(100).describe("Progress percentage (0-100)")
    },
    async (params: { featureId: string; progress: number }) => {
      try {
        const feature = await services.AhaService.updateFeatureProgress(params.featureId, params.progress);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} progress updated to ${params.progress}%:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating feature progress: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature score tool
  server.tool(
    "aha_update_feature_score",
    "Update a feature's score in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      score: z.number().describe("Score value")
    },
    async (params: { featureId: string; score: number }) => {
      try {
        const feature = await services.AhaService.updateFeatureScore(params.featureId, params.score);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} score updated to ${params.score}:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating feature score: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature custom fields tool
  server.tool(
    "aha_update_feature_custom_fields",
    "Update a feature's custom fields in Aha.io",
    {
      featureId: z.string().describe("ID of the feature"),
      customFields: z.object({}).describe("Custom fields data")
    },
    async (params: { featureId: string; customFields: any }) => {
      try {
        await services.AhaService.updateFeatureCustomFields(params.featureId, params.customFields);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} custom fields successfully updated`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating feature custom fields: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ============================
  // EPIC CRUD TOOLS (PHASE 8A.2)
  // ============================

  // Update epic tool
  server.tool(
    "aha_update_epic",
    "Update an epic in Aha.io",
    {
      epicId: z.string().describe("ID of the epic"),
      epicData: z.object({
        epic: z.object({
          name: z.string().optional().describe("Name of the epic"),
          description: z.string().optional().describe("Description of the epic")
        }).describe("Epic data object")
      }).describe("Epic update data")
    },
    async (params: { epicId: string; epicData: any }) => {
      try {
        const epic = await services.AhaService.updateEpic(params.epicId, params.epicData);

        return {
          content: [
            {
              type: "text",
              text: `Epic ${params.epicId} successfully updated:\n\n${JSON.stringify(epic, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating epic: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete epic tool
  server.tool(
    "aha_delete_epic",
    "Delete an epic in Aha.io",
    {
      epicId: z.string().describe("ID of the epic")
    },
    async (params: { epicId: string }) => {
      try {
        await services.AhaService.deleteEpic(params.epicId);

        return {
          content: [
            {
              type: "text",
              text: `Epic ${params.epicId} successfully deleted`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting epic: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ============================
  // IDEA CRUD TOOLS (PHASE 8A.3)
  // ============================

  // Create idea tool
  server.tool(
    "aha_create_idea",
    "Create an idea in a product in Aha.io",
    {
      productId: z.string().describe("ID of the product"),
      ideaData: z.object({
        idea: z.object({
          name: z.string().describe("Name of the idea"),
          description: z.string().optional().describe("Description of the idea"),
          skip_portal: z.boolean().optional().describe("Skip portal submission (default: false)")
        }).describe("Idea data object")
      }).describe("Idea creation data")
    },
    async (params: { productId: string; ideaData: any }) => {
      try {
        const idea = await services.AhaService.createIdea(params.productId, params.ideaData);

        return {
          content: [
            {
              type: "text",
              text: `Idea successfully created in product ${params.productId}:\n\n${JSON.stringify(idea, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating idea: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create idea with category tool
  server.tool(
    "aha_create_idea_with_category",
    "Create an idea with a category in a product in Aha.io",
    {
      productId: z.string().describe("ID of the product"),
      ideaData: z.object({
        idea: z.object({
          name: z.string().describe("Name of the idea"),
          description: z.string().optional().describe("Description of the idea"),
          category: z.string().describe("Category for the idea"),
          skip_portal: z.boolean().optional().describe("Skip portal submission (default: false)")
        }).describe("Idea data object")
      }).describe("Idea creation data with category")
    },
    async (params: { productId: string; ideaData: any }) => {
      try {
        const idea = await services.AhaService.createIdeaWithCategory(params.productId, params.ideaData);

        return {
          content: [
            {
              type: "text",
              text: `Idea with category successfully created in product ${params.productId}:\n\n${JSON.stringify(idea, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating idea with category: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create idea with score tool
  server.tool(
    "aha_create_idea_with_score",
    "Create an idea with a score in a product in Aha.io",
    {
      productId: z.string().describe("ID of the product"),
      ideaData: z.object({
        idea: z.object({
          name: z.string().describe("Name of the idea"),
          description: z.string().optional().describe("Description of the idea"),
          score: z.number().describe("Score for the idea"),
          skip_portal: z.boolean().optional().describe("Skip portal submission (default: false)")
        }).describe("Idea data object")
      }).describe("Idea creation data with score")
    },
    async (params: { productId: string; ideaData: any }) => {
      try {
        const idea = await services.AhaService.createIdeaWithScore(params.productId, params.ideaData);

        return {
          content: [
            {
              type: "text",
              text: `Idea with score successfully created in product ${params.productId}:\n\n${JSON.stringify(idea, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating idea with score: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete idea tool
  server.tool(
    "aha_delete_idea",
    "Delete an idea in Aha.io",
    {
      ideaId: z.string().describe("ID of the idea")
    },
    async (params: { ideaId: string }) => {
      try {
        await services.AhaService.deleteIdea(params.ideaId);

        return {
          content: [
            {
              type: "text",
              text: `Idea ${params.ideaId} successfully deleted`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting idea: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ============================
  // COMPETITOR CRUD TOOLS (PHASE 8B.1)
  // ============================

  // Create competitor tool
  server.tool(
    "aha_create_competitor",
    "Create a competitor in a product in Aha.io",
    {
      productId: z.string().describe("ID of the product"),
      competitorData: z.object({
        competitor: z.object({
          name: z.string().describe("Name of the competitor"),
          description: z.string().optional().describe("Description of the competitor"),
          website: z.string().optional().describe("Website URL of the competitor")
        }).describe("Competitor data object")
      }).describe("Competitor creation data")
    },
    async (params: { productId: string; competitorData: any }) => {
      try {
        const competitor = await services.AhaService.createCompetitor(params.productId, params.competitorData);

        return {
          content: [
            {
              type: "text",
              text: `Competitor successfully created in product ${params.productId}:\n\n${JSON.stringify(competitor, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating competitor: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update competitor tool
  server.tool(
    "aha_update_competitor",
    "Update a competitor in Aha.io",
    {
      competitorId: z.string().describe("ID of the competitor"),
      competitorData: z.object({
        competitor: z.object({
          name: z.string().optional().describe("Name of the competitor"),
          description: z.string().optional().describe("Description of the competitor"),
          website: z.string().optional().describe("Website URL of the competitor")
        }).describe("Competitor data object")
      }).describe("Competitor update data")
    },
    async (params: { competitorId: string; competitorData: any }) => {
      try {
        const competitor = await services.AhaService.updateCompetitor(params.competitorId, params.competitorData);

        return {
          content: [
            {
              type: "text",
              text: `Competitor ${params.competitorId} successfully updated:\n\n${JSON.stringify(competitor, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating competitor: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete competitor tool
  server.tool(
    "aha_delete_competitor",
    "Delete a competitor in Aha.io",
    {
      competitorId: z.string().describe("ID of the competitor")
    },
    async (params: { competitorId: string }) => {
      try {
        await services.AhaService.deleteCompetitor(params.competitorId);

        return {
          content: [
            {
              type: "text",
              text: `Competitor ${params.competitorId} successfully deleted`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting competitor: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ============================
  // INITIATIVE ENHANCEMENT TOOLS (PHASE 8B.2)
  // ============================

  // Get initiative epics tool
  server.tool(
    "aha_get_initiative_epics",
    "Get epics associated with an initiative in Aha.io",
    {
      initiativeId: z.string().describe("ID of the initiative")
    },
    async (params: { initiativeId: string }) => {
      try {
        const epics = await services.AhaService.getInitiativeEpics(params.initiativeId);

        return {
          content: [
            {
              type: "text",
              text: `Epics for initiative ${params.initiativeId}:\n\n${JSON.stringify(epics, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting initiative epics: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
