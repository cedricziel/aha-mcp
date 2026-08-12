import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as services from "./services/index.js";
import { registerSearchTools } from "./tools/search-tools.js";
import { registerRecordTools } from "./tools/record-tools.js";
import { registerCommentTools } from "./tools/comment-tools.js";
import {
  commentOutputSchema,
  competitorOutputSchema,
  deletionOutputSchema,
  epicOutputSchema,
  featureOutputSchema,
  ideaOutputSchema,
  initiativeOutputSchema,
  recordLinks,
  recordSummary,
  unwrapRecord
} from "./tool-output.js";
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
      title: "Create feature comment",
      // Kept as-is now that aha_create_comment covers every commentable type: removing it
      // would break callers for no gain. The description says which to prefer so a model is
      // not left choosing between two tools that look identical for features.
      description:
        "Create a comment on a feature in Aha.io. Returns the created comment. " +
        "aha_create_comment does the same for features and every other record type, and " +
        "aha_list_comments reads them back - prefer those unless you specifically want this one.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        body: z.string().describe("Comment body")
      },
      outputSchema: commentOutputSchema,
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
        const record = unwrapRecord(comment, "comment");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created comment", record, { detail: `on feature ${params.featureId}` })
            }
          ],
          structuredContent: record
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
      title: "Associate feature with epic",
      description: "Associate a feature with an epic in Aha.io. Returns the updated feature and a link to it.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        epicId: z.string().describe("ID or name of the epic")
      },
      outputSchema: featureOutputSchema,
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
        const record = unwrapRecord(feature, "feature");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Associated feature", record, { fallbackId: params.featureId, detail: `epic ${params.epicId}` })
            },
            ...recordLinks("feature", record, params.featureId)
          ],
          structuredContent: record
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
      title: "Move feature to release",
      description: "Move a feature to a different release in Aha.io. Returns the updated feature and a link to it.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        releaseId: z.string().describe("ID or key of the target release")
      },
      outputSchema: featureOutputSchema,
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
        const record = unwrapRecord(feature, "feature");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Moved feature", record, { fallbackId: params.featureId, detail: `release ${params.releaseId}` })
            },
            ...recordLinks("feature", record, params.featureId)
          ],
          structuredContent: record
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
      title: "Set feature goals",
      description: "Associate a feature with multiple goals in Aha.io. Replaces the feature's whole goal set, so goals left out are unlinked. Returns the updated feature and a link to it.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        goalIds: z.array(z.number()).describe("Array of goal IDs to associate with the feature")
      },
      outputSchema: featureOutputSchema,
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
        const record = unwrapRecord(feature, "feature");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Set goals on feature", record, { fallbackId: params.featureId, detail: `goals ${params.goalIds.join(", ")}` })
            },
            ...recordLinks("feature", record, params.featureId)
          ],
          structuredContent: record
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
      title: "Set feature tags",
      description: "Update tags for a feature in Aha.io. Replaces the feature's whole tag set, so tags left out are removed. Returns the updated feature and a link to it.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        tags: z.array(z.string()).describe("Array of tag strings to associate with the feature")
      },
      outputSchema: featureOutputSchema,
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
        const record = unwrapRecord(feature, "feature");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Set tags on feature", record, { fallbackId: params.featureId, detail: `tags ${params.tags.join(", ")}` })
            },
            ...recordLinks("feature", record, params.featureId)
          ],
          structuredContent: record
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
      title: "Create epic in product",
      description: "Create an epic within a specific product in Aha.io. Returns the created epic and a link to it.",
      inputSchema: {
        productId: z.string().describe("ID of the product"),
        epicData: z.object({
          epic: z.object({
            name: z.string().describe("Name of the epic"),
            description: z.string().optional().describe("Description of the epic")
          }).describe("Epic data object")
        }).describe("Epic creation data")
      },
      outputSchema: epicOutputSchema,
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
        const record = unwrapRecord(epic, "epic");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created epic", record, { detail: `product ${params.productId}` })
            },
            ...recordLinks("epic", record)
          ],
          structuredContent: record
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
      title: "Create epic in release",
      description: "Create an epic within a specific release in Aha.io. Returns the created epic and a link to it.",
      inputSchema: {
        releaseId: z.string().describe("ID of the release"),
        epicData: z.object({
          epic: z.object({
            name: z.string().describe("Name of the epic"),
            description: z.string().optional().describe("Description of the epic")
          }).describe("Epic data object")
        }).describe("Epic creation data")
      },
      outputSchema: epicOutputSchema,
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
        const record = unwrapRecord(epic, "epic");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created epic", record, { detail: `release ${params.releaseId}` })
            },
            ...recordLinks("epic", record)
          ],
          structuredContent: record
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
      title: "Create initiative in product",
      description: "Create an initiative within a specific product in Aha.io. Returns the created initiative and a link to it.",
      inputSchema: {
        productId: z.string().describe("ID of the product"),
        initiativeData: z.object({
          initiative: z.object({
            name: z.string().describe("Name of the initiative"),
            description: z.string().optional().describe("Description of the initiative")
          }).describe("Initiative data object")
        }).describe("Initiative creation data")
      },
      outputSchema: initiativeOutputSchema,
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
        const record = unwrapRecord(initiative, "initiative");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created initiative", record, { detail: `product ${params.productId}` })
            },
            ...recordLinks("initiative", record)
          ],
          structuredContent: record
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
      title: "Create feature",
      description: "Create a feature within a specific release in Aha.io. Returns the created feature and a link to it.",
      inputSchema: {
        releaseId: z.string().describe("ID of the release"),
        featureData: z.object({
          feature: z.object({
            name: z.string().describe("Name of the feature"),
            description: z.string().optional().describe("Description of the feature")
          }).describe("Feature data object")
        }).describe("Feature creation data")
      },
      outputSchema: featureOutputSchema,
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
        const record = unwrapRecord(feature, "feature");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created feature", record, { detail: `release ${params.releaseId}` })
            },
            ...recordLinks("feature", record)
          ],
          // Unlike the other writers, this endpoint is not typed to return a body. An empty
          // record still validates - every field of featureOutputSchema is optional - where a
          // missing structuredContent would fail output validation and sink the call. With no
          // identifier to link to, recordLinks yields nothing rather than a broken URI.
          structuredContent: record
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
      title: "Update feature",
      description: "Update a feature's name or description in Aha.io. Returns the updated feature and a link to it.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        featureData: z.object({
          feature: z.object({
            name: z.string().optional().describe("Name of the feature"),
            description: z.string().optional().describe("Description of the feature")
          }).describe("Feature data object")
        }).describe("Feature update data")
      },
      outputSchema: featureOutputSchema,
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
        const record = unwrapRecord(feature, "feature");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Updated feature", record, { fallbackId: params.featureId })
            },
            ...recordLinks("feature", record, params.featureId)
          ],
          structuredContent: record
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
      title: "Delete feature",
      description: "Delete a feature in Aha.io. Returns a confirmation naming the deleted feature; there is no record to return.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature")
      },
      outputSchema: deletionOutputSchema,
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
              text: `Deleted feature ${params.featureId}`
            }
          ],
          structuredContent: { deleted: true as const, record_type: "feature" as const, id: params.featureId }
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
      title: "Update feature progress",
      description: "Update a feature's progress percentage in Aha.io. Returns the updated feature and a link to it.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        progress: z.number().min(0).max(100).describe("Progress percentage (0-100)")
      },
      outputSchema: featureOutputSchema,
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
        const record = unwrapRecord(feature, "feature");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Updated feature", record, { fallbackId: params.featureId, detail: `progress ${params.progress}%` })
            },
            ...recordLinks("feature", record, params.featureId)
          ],
          structuredContent: record
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
      title: "Update feature score",
      description: "Update a feature's score in Aha.io. Returns the updated feature and a link to it.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        score: z.number().describe("Score value")
      },
      outputSchema: featureOutputSchema,
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
        const record = unwrapRecord(feature, "feature");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Updated feature", record, { fallbackId: params.featureId, detail: `score ${params.score}` })
            },
            ...recordLinks("feature", record, params.featureId)
          ],
          structuredContent: record
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
      title: "Update feature custom fields",
      description: "Update a feature's custom fields in Aha.io. Returns the updated feature and a link to it.",
      inputSchema: {
        featureId: z.string().describe("ID of the feature"),
        // Not z.object({}): zod strips keys a shape does not declare, so every custom field
        // sent by the caller was discarded before the handler ever saw it.
        customFields: z.record(z.string(), z.any()).describe(
          "Custom fields as a key/value object, keyed by the custom field's API key"
        )
      },
      outputSchema: featureOutputSchema,
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
        const record = unwrapRecord(feature, "feature");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Updated feature", record, { fallbackId: params.featureId, detail: `custom fields ${Object.keys(params.customFields).join(", ")}` })
            },
            ...recordLinks("feature", record, params.featureId)
          ],
          structuredContent: record
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
      title: "Update epic",
      description: "Update an epic's name or description in Aha.io. Returns the updated epic and a link to it.",
      inputSchema: {
        epicId: z.string().describe("ID of the epic"),
        epicData: z.object({
          epic: z.object({
            name: z.string().optional().describe("Name of the epic"),
            description: z.string().optional().describe("Description of the epic")
          }).describe("Epic data object")
        }).describe("Epic update data")
      },
      outputSchema: epicOutputSchema,
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
        const record = unwrapRecord(epic, "epic");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Updated epic", record, { fallbackId: params.epicId })
            },
            ...recordLinks("epic", record, params.epicId)
          ],
          structuredContent: record
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
      title: "Delete epic",
      description: "Delete an epic in Aha.io. Returns a confirmation naming the deleted epic; there is no record to return.",
      inputSchema: {
        epicId: z.string().describe("ID of the epic")
      },
      outputSchema: deletionOutputSchema,
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
              text: `Deleted epic ${params.epicId}`
            }
          ],
          structuredContent: { deleted: true as const, record_type: "epic" as const, id: params.epicId }
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
      title: "Create idea",
      description: "Create an idea in a product in Aha.io. Returns the created idea and a link to it.",
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
      outputSchema: ideaOutputSchema,
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
        const record = unwrapRecord(idea, "idea");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created idea", record, { detail: `product ${params.productId}` })
            },
            ...recordLinks("idea", record)
          ],
          structuredContent: record
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
      title: "Create idea with category",
      description: "Create an idea with a category in a product in Aha.io. Returns the created idea and a link to it.",
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
      outputSchema: ideaOutputSchema,
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
        const record = unwrapRecord(idea, "idea");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created idea", record, { detail: `product ${params.productId}, category ${params.ideaData.idea.category}` })
            },
            ...recordLinks("idea", record)
          ],
          structuredContent: record
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
      title: "Create idea with score",
      description: "Create an idea with a score in a product in Aha.io. Returns the created idea and a link to it.",
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
      outputSchema: ideaOutputSchema,
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
        const record = unwrapRecord(idea, "idea");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created idea", record, { detail: `product ${params.productId}, score ${params.ideaData.idea.score}` })
            },
            ...recordLinks("idea", record)
          ],
          structuredContent: record
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
      title: "Delete idea",
      description: "Delete an idea in Aha.io. Returns a confirmation naming the deleted idea; there is no record to return.",
      inputSchema: {
        ideaId: z.string().describe("ID of the idea")
      },
      outputSchema: deletionOutputSchema,
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
              text: `Deleted idea ${params.ideaId}`
            }
          ],
          structuredContent: { deleted: true as const, record_type: "idea" as const, id: params.ideaId }
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
      title: "Create competitor",
      description: "Create a competitor in a product in Aha.io. Returns the created competitor and a link to it.",
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
      outputSchema: competitorOutputSchema,
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
        const record = unwrapRecord(competitor, "competitor");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created competitor", record, { detail: `product ${params.productId}` })
            },
            ...recordLinks("competitor", record)
          ],
          structuredContent: record
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
      title: "Update competitor",
      description: "Update a competitor in Aha.io. Returns the updated competitor and a link to it.",
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
      outputSchema: competitorOutputSchema,
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
        const record = unwrapRecord(competitor, "competitor");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Updated competitor", record, { fallbackId: params.competitorId })
            },
            ...recordLinks("competitor", record, params.competitorId)
          ],
          structuredContent: record
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
      title: "Delete competitor",
      description: "Delete a competitor in Aha.io. Returns a confirmation naming the deleted competitor; there is no record to return.",
      inputSchema: {
        competitorId: z.string().describe("ID of the competitor")
      },
      outputSchema: deletionOutputSchema,
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
              text: `Deleted competitor ${params.competitorId}`
            }
          ],
          structuredContent: { deleted: true as const, record_type: "competitor" as const, id: params.competitorId }
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
      title: "Create idea as portal user",
      description: "Create an idea in a product in Aha.io, attributed to an ideas-portal user rather than to the API token's owner. Returns the created idea and a link to it.",
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
      outputSchema: ideaOutputSchema,
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
        const record = unwrapRecord(idea, "idea");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created idea", record, { detail: `product ${params.productId}, submitted as a portal user` })
            },
            ...recordLinks("idea", record)
          ],
          structuredContent: record
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
      title: "Create idea with portal settings",
      description: "Create an idea in a product in Aha.io with ideas-portal settings, category and score in one call. Returns the created idea and a link to it.",
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
      outputSchema: ideaOutputSchema,
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
        const record = unwrapRecord(idea, "idea");

        return {
          content: [
            {
              type: "text",
              text: recordSummary("Created idea", record, { detail: `product ${params.productId}` })
            },
            ...recordLinks("idea", record)
          ],
          structuredContent: record
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

  // Single-record reads. Registered as tools, not only as aha:// resources, because a client
  // that does not surface resources to its model would otherwise see writers with no way to
  // read what they are about to overwrite.
  registerRecordTools(server);

  // Comments, including the ideas-portal stream that aha://comments/idea/{id} does not carry.
  registerCommentTools(server);
}
