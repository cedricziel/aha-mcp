import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as services from "../services/index.js";
import { describeAhaError } from "../services/aha-errors.js";
import { ideaOutputSchema, recordLinks, recordSummary, unwrapRecord } from "../tool-output.js";

/**
 * Fields accepted by Aha's `PUT /ideas/:id` endpoint that are useful for routine idea
 * triage. Promotion, merging, and moving an idea are deliberately omitted: those operations
 * have broader consequences than editing the idea itself and deserve separate tools.
 */
const ideaUpdateFields = {
  name: z.string().min(1).optional().describe("Name of the idea"),
  description: z.string().optional().describe("Description of the idea. May contain HTML."),
  workflow_status: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Status name or id. It must be configured for this idea's workspace; read the idea first to inspect its current status."
    ),
  assigned_to_user: z
    .string()
    .email()
    .min(1)
    .optional()
    .describe("Email address of the Aha user to assign"),
  custom_fields: z
    .record(z.string(), z.any())
    .optional()
    .describe("Custom fields keyed by their API key")
};

const ideaUpdate = z.object(ideaUpdateFields).refine(value => Object.keys(value).length > 0, {
  message: "Provide at least one idea field to update"
});

/** Register the idea update tool. */
export function registerIdeaTools(server: McpServer) {
  server.registerTool(
    "aha_update_idea",
    {
      title: "Update idea",
      description:
        "Update an idea in Aha.io, including its workflow status, name, description, " +
        "assignee, or custom fields. Only the fields you send " +
        "change. Read the idea first with aha_get_idea because workflow statuses are " +
        "workspace-specific. Returns the updated idea and a link to it.",
      inputSchema: {
        ideaId: z
          .string()
          .min(1)
          .describe("Reference number (e.g. PRJ1-I-7) or internal id of the idea"),
        ideaData: z
          .object({
            idea: ideaUpdate.describe("Idea fields to update")
          })
          .describe("Idea update data")
      },
      outputSchema: ideaOutputSchema,
      annotations: {
        title: "Update idea",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: { ideaId: string; ideaData: { idea: Record<string, unknown> } }) => {
      try {
        const response = await services.AhaService.updateIdea(params.ideaId, params.ideaData);
        const record = unwrapRecord(response, "idea");

        return {
          content: [
            {
              type: "text" as const,
              text: recordSummary("Updated idea", record, { fallbackId: params.ideaId })
            },
            ...recordLinks("idea", record, params.ideaId)
          ],
          structuredContent: record
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error updating idea: ${describeAhaError(error, params.ideaId)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
