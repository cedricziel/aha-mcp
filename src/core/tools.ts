import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as services from "./services/index.js";
import { registerSearchTools } from "./tools/search-tools.js";
import { log } from "./logger.js";
import { describeAhaError } from "./services/aha-errors.js";

/**
 * Register all tools with the MCP server
 *
 * @param server The MCP server instance
 */
export function registerTools(server: McpServer) {

  // Create feature comment tool
  server.registerTool(
    "aha_create_feature_comment",
    {
      description: "Create a comment on a feature in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        body: z.string().describe("Comment body")
      },
      annotations: {
        title: "Create feature comment",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
              text: `Error creating comment: ${describeAhaError(error)}`
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
  server.registerTool(
    "aha_associate_feature_with_epic",
    {
      description: "Associate a feature with an epic in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        epicId: z.string().describe("ID or name of the epic")
      },
      annotations: {
        title: "Associate feature with epic",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error associating feature with epic: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Move feature to release tool
  server.registerTool(
    "aha_move_feature_to_release",
    {
      description: "Move a feature to a different release in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        releaseId: z.string().describe("ID or key of the target release")
      },
      annotations: {
        title: "Move feature to release",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error moving feature to release: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Associate feature with goals tool
  server.registerTool(
    "aha_associate_feature_with_goals",
    {
      description: "Associate a feature with multiple goals in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        goalIds: z.array(z.number()).describe("Array of goal IDs to associate with the feature")
      },
      // destructive: PUT /features/:id/goals replaces the goal set, so goals left out are unlinked.
      annotations: {
        title: "Set feature goals",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error associating feature with goals: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature tags tool
  server.registerTool(
    "aha_update_feature_tags",
    {
      description: "Update tags for a feature in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        tags: z.array(z.string()).describe("Array of tag strings to associate with the feature")
      },
      // destructive: PUT /features/:id/tags replaces the tag set, so tags left out are removed.
      annotations: {
        title: "Set feature tags",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error updating feature tags: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create epic in product tool
  server.registerTool(
    "aha_create_epic_in_product",
    {
      description: "Create an epic within a specific product in Aha.io",
      inputSchema: {
        productId: z.string().describe("ID of the product"),
        epicData: z.object({
          epic: z.object({
            name: z.string().describe("Name of the epic"),
            description: z.string().optional().describe("Description of the epic")
          }).describe("Epic data object")
        }).describe("Epic creation data")
      },
      annotations: {
        title: "Create epic in product",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
              text: `Error creating epic in product: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create epic in release tool
  server.registerTool(
    "aha_create_epic_in_release",
    {
      description: "Create an epic within a specific release in Aha.io",
      inputSchema: {
        releaseId: z.string().describe("ID of the release"),
        epicData: z.object({
          epic: z.object({
            name: z.string().describe("Name of the epic"),
            description: z.string().optional().describe("Description of the epic")
          }).describe("Epic data object")
        }).describe("Epic creation data")
      },
      annotations: {
        title: "Create epic in release",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
              text: `Error creating epic in release: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create initiative in product tool
  server.registerTool(
    "aha_create_initiative_in_product",
    {
      description: "Create an initiative within a specific product in Aha.io",
      inputSchema: {
        productId: z.string().describe("ID of the product"),
        initiativeData: z.object({
          initiative: z.object({
            name: z.string().describe("Name of the initiative"),
            description: z.string().optional().describe("Description of the initiative")
          }).describe("Initiative data object")
        }).describe("Initiative creation data")
      },
      annotations: {
        title: "Create initiative in product",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
              text: `Error creating initiative in product: ${describeAhaError(error)}`
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
  server.registerTool(
    "aha_create_feature",
    {
      description: "Create a feature within a specific release in Aha.io",
      inputSchema: {
        releaseId: z.string().describe("ID of the release"),
        featureData: z.object({
          feature: z.object({
            name: z.string().describe("Name of the feature"),
            description: z.string().optional().describe("Description of the feature")
          }).describe("Feature data object")
        }).describe("Feature creation data")
      },
      annotations: {
        title: "Create feature",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
              text: `Error creating feature: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature tool
  server.registerTool(
    "aha_update_feature",
    {
      description: "Update a feature in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        featureData: z.object({
          feature: z.object({
            name: z.string().optional().describe("Name of the feature"),
            description: z.string().optional().describe("Description of the feature")
          }).describe("Feature data object")
        }).describe("Feature update data")
      },
      annotations: {
        title: "Update feature",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error updating feature: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete feature tool
  server.registerTool(
    "aha_delete_feature",
    {
      description: "Delete a feature in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature")
      },
      annotations: {
        title: "Delete feature",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error deleting feature: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature progress tool
  server.registerTool(
    "aha_update_feature_progress",
    {
      description: "Update a feature's progress in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        progress: z.number().min(0).max(100).describe("Progress percentage (0-100)")
      },
      annotations: {
        title: "Update feature progress",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error updating feature progress: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature score tool
  server.registerTool(
    "aha_update_feature_score",
    {
      description: "Update a feature's score in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        score: z.number().describe("Score value")
      },
      annotations: {
        title: "Update feature score",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error updating feature score: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update feature custom fields tool
  server.registerTool(
    "aha_update_feature_custom_fields",
    {
      description: "Update a feature's custom fields in Aha.io",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        // Not z.object({}): zod strips keys a shape does not declare, so every custom field
        // sent by the caller was discarded before the handler ever saw it.
        customFields: z.record(z.string(), z.any()).describe(
          "Custom fields as a key/value object, keyed by the custom field's API key"
        )
      },
      annotations: {
        title: "Update feature custom fields",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: { featureId: string; customFields: Record<string, any> }) => {
      try {
        const feature = await services.AhaService.updateFeatureCustomFields(params.featureId, params.customFields);

        return {
          content: [
            {
              type: "text",
              text: `Feature ${params.featureId} custom fields updated:\n\n${JSON.stringify(feature, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating feature custom fields: ${describeAhaError(error)}`
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
  server.registerTool(
    "aha_update_epic",
    {
      description: "Update an epic in Aha.io",
      inputSchema: {
        epicId: z.string().describe("ID of the epic"),
        epicData: z.object({
          epic: z.object({
            name: z.string().optional().describe("Name of the epic"),
            description: z.string().optional().describe("Description of the epic")
          }).describe("Epic data object")
        }).describe("Epic update data")
      },
      annotations: {
        title: "Update epic",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error updating epic: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete epic tool
  server.registerTool(
    "aha_delete_epic",
    {
      description: "Delete an epic in Aha.io",
      inputSchema: {
        epicId: z.string().describe("ID of the epic")
      },
      annotations: {
        title: "Delete epic",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error deleting epic: ${describeAhaError(error)}`
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
  server.registerTool(
    "aha_create_idea",
    {
      description: "Create an idea in a product in Aha.io",
      inputSchema: {
        productId: z.string().describe("ID of the product"),
        ideaData: z.object({
          idea: z.object({
            name: z.string().describe("Name of the idea"),
            description: z.string().optional().describe("Description of the idea"),
            skip_portal: z.boolean().optional().describe("Skip portal submission (default: false)")
          }).describe("Idea data object")
        }).describe("Idea creation data")
      },
      annotations: {
        title: "Create idea",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
              text: `Error creating idea: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create idea with category tool
  server.registerTool(
    "aha_create_idea_with_category",
    {
      description: "Create an idea with a category in a product in Aha.io",
      inputSchema: {
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
      annotations: {
        title: "Create idea with category",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
              text: `Error creating idea with category: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create idea with score tool
  server.registerTool(
    "aha_create_idea_with_score",
    {
      description: "Create an idea with a score in a product in Aha.io",
      inputSchema: {
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
      annotations: {
        title: "Create idea with score",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
              text: `Error creating idea with score: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete idea tool
  server.registerTool(
    "aha_delete_idea",
    {
      description: "Delete an idea in Aha.io",
      inputSchema: {
        ideaId: z.string().describe("ID of the idea")
      },
      annotations: {
        title: "Delete idea",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error deleting idea: ${describeAhaError(error)}`
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
  server.registerTool(
    "aha_create_competitor",
    {
      description: "Create a competitor in a product in Aha.io",
      inputSchema: {
        productId: z.string().describe("ID of the product"),
        competitorData: z.object({
          competitor: z.object({
            name: z.string().describe("Name of the competitor"),
            description: z.string().optional().describe("Description of the competitor"),
            website: z.string().optional().describe("Website URL of the competitor")
          }).describe("Competitor data object")
        }).describe("Competitor creation data")
      },
      annotations: {
        title: "Create competitor",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
              text: `Error creating competitor: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update competitor tool
  server.registerTool(
    "aha_update_competitor",
    {
      description: "Update a competitor in Aha.io",
      inputSchema: {
        competitorId: z.string().describe("ID of the competitor"),
        competitorData: z.object({
          competitor: z.object({
            name: z.string().optional().describe("Name of the competitor"),
            description: z.string().optional().describe("Description of the competitor"),
            website: z.string().optional().describe("Website URL of the competitor")
          }).describe("Competitor data object")
        }).describe("Competitor update data")
      },
      annotations: {
        title: "Update competitor",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error updating competitor: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete competitor tool
  server.registerTool(
    "aha_delete_competitor",
    {
      description: "Delete a competitor in Aha.io",
      inputSchema: {
        competitorId: z.string().describe("ID of the competitor")
      },
      annotations: {
        title: "Delete competitor",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
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
              text: `Error deleting competitor: ${describeAhaError(error)}`
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

  // ============================
  // PORTAL INTEGRATION & ADVANCED FEATURES (PHASE 8C)
  // ============================

  // Create idea by portal user tool
  server.registerTool(
    "aha_create_idea_by_portal_user",
    {
      description: "Create an idea by a portal user in Aha.io",
      inputSchema: {
        productId: z.string().describe("ID of the product"),
        ideaData: z.object({
          idea: z.object({
            name: z.string().describe("Name of the idea"),
            description: z.string().optional().describe("Description of the idea"),
            submitted_idea_portal_id: z.string().optional().describe("ID of the ideas portal"),
            skip_portal: z.boolean().optional().describe("Skip portal submission (default: false)"),
            created_by_portal_user: z.object({
              id: z.number().describe("ID of the portal user"),
              name: z.string().describe("Name of the portal user")
            }).describe("Portal user information")
          }).describe("Idea data object")
        }).describe("Idea creation data by portal user")
      },
      annotations: {
        title: "Create idea as portal user",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: { productId: string; ideaData: any }) => {
      try {
        const idea = await services.AhaService.createIdeaByPortalUser(params.productId, params.ideaData);

        return {
          content: [
            {
              type: "text",
              text: `Idea by portal user successfully created in product ${params.productId}:\n\n${JSON.stringify(idea, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating idea by portal user: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create idea with portal settings tool
  server.registerTool(
    "aha_create_idea_with_portal_settings",
    {
      description: "Create an idea with enhanced portal settings in Aha.io",
      inputSchema: {
        productId: z.string().describe("ID of the product"),
        ideaData: z.object({
          idea: z.object({
            name: z.string().describe("Name of the idea"),
            description: z.string().optional().describe("Description of the idea"),
            submitted_idea_portal_id: z.string().optional().describe("ID of the ideas portal"),
            skip_portal: z.boolean().optional().describe("Skip portal submission (default: false)"),
            category: z.string().optional().describe("Category for the idea"),
            score: z.number().optional().describe("Score for the idea")
          }).describe("Idea data object")
        }).describe("Idea creation data with portal settings")
      },
      annotations: {
        title: "Create idea with portal settings",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: { productId: string; ideaData: any }) => {
      try {
        const idea = await services.AhaService.createIdeaWithPortalSettings(params.productId, params.ideaData);

        return {
          content: [
            {
              type: "text",
              text: `Idea with portal settings successfully created in product ${params.productId}:\n\n${JSON.stringify(idea, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating idea with portal settings: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Search, served by Aha's own index rather than a local copy of the data.
  registerSearchTools(server);
}
