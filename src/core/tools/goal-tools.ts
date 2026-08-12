import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as services from "../services/index.js";
import {
  deletionOutputSchema,
  goalOutputSchema,
  keyResultOutputSchema,
  keyResultsListOutputSchema,
  recordLinks,
  recordSummary,
  unwrapRecord
} from "../tool-output.js";
import { describeAhaError } from "../services/aha-errors.js";

/**
 * Goal and key result tools - Aha's own model of an OKR.
 *
 * A goal is the objective; the key results it owns are the measurable half. Before these,
 * goals were readable only through `aha://goal/...` resources and key results were not
 * reachable at all, so an agent could link a feature to an existing goal but could not write
 * an objective, add a key result, or move one's current metric - the whole quarterly loop had
 * to happen in the Aha UI first.
 *
 * Three shapes here differ from the rest of the server, all measured against a live account
 * rather than inferred:
 *
 * 1. **Goal creation and deletion are workspace-scoped.** `POST /products/{id}/goals` and
 *    `DELETE /products/{id}/goals/{id}` are the only routes Aha offers, so both tools need a
 *    workspace id. Updates do not.
 * 2. **A key result has no `url`.** Its summary therefore cannot end in a link, and the
 *    `aha://key_result/{id}` resource link is the only pointer a client can follow.
 * 3. **A goal has no top-level workflow status.** Status lives under
 *    `success_metric.workflow_status`, which is what the Aha UI shows.
 */

/** Goal fields Aha documents for create and update, wrapped as Aha's REST body is. */
const goalFields = {
  name: z.string().optional().describe("Name of the goal - the objective, as people will read it"),
  description: z.string().optional().describe("Description of the goal. May contain HTML."),
  success_metric_name: z
    .string()
    .optional()
    .describe("Name of the metric that measures the goal, e.g. \"Weekly active workspaces\""),
  success_metric_description: z.string().optional().describe("Description of the success metric"),
  workflow_status: z
    .string()
    .optional()
    .describe(
      "Status of the goal by name, e.g. \"Not started\" or \"On track\". Must be a status configured for goals in this account."
    ),
  time_frame: z
    .string()
    .optional()
    .describe("Name or id of the time frame the goal belongs to, e.g. \"FY27\""),
  effort: z.number().optional().describe("Position on Aha's effort axis, 1-100"),
  value: z.number().optional().describe("Position on Aha's value axis, 1-100"),
  parent_id: z.string().optional().describe("Id of a parent goal, to roll this goal up into it"),
  progress_source: z
    .string()
    .optional()
    .describe(
      "What drives progress: progress_manual, progress_from_key_results, progress_from_features, progress_from_releases, progress_from_initiatives or progress_from_descendants."
    ),
  progress: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Progress percentage, 0-100. Aha only accepts this when progress_source is progress_manual.")
};

/**
 * Key result fields. `workflow_status` is an object at Aha's boundary for key results (and a
 * bare string for goals); both are accepted here and normalised in the service, because a
 * caller that has just read a key result holds the object and one naming a status holds the
 * string.
 */
const keyResultFields = {
  name: z.string().optional().describe("Name of the key result - the measurable outcome"),
  description: z.string().optional().describe("Description of the key result. May contain HTML."),
  workflow_status: z
    .union([z.string(), z.object({ name: z.string().describe("Status name") })])
    .optional()
    .describe("Status of the key result, as a name or as { name }, e.g. \"On track\""),
  starting_metric: z.string().optional().describe("Metric value at the start, as text, e.g. \"0%\""),
  current_metric: z.string().optional().describe("Where the metric stands now, as text, e.g. \"30%\""),
  target_metric: z.string().optional().describe("Metric value that counts as done, as text, e.g. \"90%\""),
  assigned_to_user: z
    .object({ email: z.string().describe("Email address of the Aha user") })
    .optional()
    .describe("User the key result is assigned to, identified by email"),
  watchers: z.array(z.number()).optional().describe("Aha user ids to add as watchers")
};

/** Register the goal and key result write tools. */
export function registerGoalTools(server: McpServer) {
  // Create goal tool
  server.registerTool(
    "aha_create_goal",
    {
      title: "Create goal",
      description:
        "Create a goal (an objective) in a workspace in Aha.io. Goals are workspace-scoped, " +
        "so the goal lands in the workspace named by productId. Add its key results afterwards " +
        "with aha_create_key_result. Returns the created goal and a link to it.",
      inputSchema: {
        productId: z
          .string()
          .describe("ID or key of the workspace (Aha product) the goal belongs to, e.g. PRJ1"),
        goalData: z
          .object({
            goal: z.object(goalFields).describe("Goal data object")
          })
          .describe("Goal creation data")
      },
      outputSchema: goalOutputSchema,
      annotations: {
        title: "Create goal",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: { productId: string; goalData: any }) => {
      try {
        const goal = await services.AhaService.createGoal(params.productId, params.goalData);
        const record = unwrapRecord(goal, "goal");

        return {
          content: [
            {
              type: "text" as const,
              text: recordSummary("Created goal", record, { detail: `workspace ${params.productId}` })
            },
            ...recordLinks("goal", record)
          ],
          structuredContent: record
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating goal: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update goal tool
  server.registerTool(
    "aha_update_goal",
    {
      title: "Update goal",
      description:
        "Update a goal in Aha.io - its name, description, success metric, status, time frame " +
        "or progress. Only the fields you send change. Read the goal first with aha_get_goal: " +
        "a goal's status lives under success_metric.workflow_status, and progress is only " +
        "writable when progress_source is progress_manual. Returns the updated goal and a link to it.",
      inputSchema: {
        goalId: z.string().describe("Reference number (e.g. PRJ1-G-3) or internal id of the goal"),
        goalData: z
          .object({
            goal: z.object(goalFields).describe("Goal data object")
          })
          .describe("Goal update data"),
        productId: z
          .string()
          .optional()
          .describe(
            "Workspace id, only needed if the account rejects the account-level update route. Aha documents the update as workspace-scoped; a goal read with aha_get_goal carries its workspace as product_id."
          )
      },
      outputSchema: goalOutputSchema,
      annotations: {
        title: "Update goal",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: { goalId: string; goalData: any; productId?: string }) => {
      try {
        const goal = await services.AhaService.updateGoal(
          params.goalId,
          params.goalData,
          params.productId
        );
        const record = unwrapRecord(goal, "goal");

        return {
          content: [
            {
              type: "text" as const,
              text: recordSummary("Updated goal", record, { fallbackId: params.goalId })
            },
            ...recordLinks("goal", record, params.goalId)
          ],
          structuredContent: record
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error updating goal: ${describeAhaError(error, params.goalId)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete goal tool
  server.registerTool(
    "aha_delete_goal",
    {
      title: "Delete goal",
      description:
        "Delete a goal in Aha.io, along with the key results it owns. Aha only offers this " +
        "workspace-scoped, so productId is required; aha_get_goal returns it as product_id. " +
        "Returns a confirmation naming the deleted goal; there is no record to return.",
      inputSchema: {
        productId: z
          .string()
          .describe("ID or key of the workspace the goal belongs to - a goal's product_id"),
        goalId: z.string().describe("Reference number (e.g. PRJ1-G-3) or internal id of the goal")
      },
      outputSchema: deletionOutputSchema,
      // destructive: deleting a goal takes its key results with it.
      annotations: {
        title: "Delete goal",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: { productId: string; goalId: string }) => {
      try {
        await services.AhaService.deleteGoal(params.productId, params.goalId);

        return {
          content: [
            {
              type: "text" as const,
              text: `Deleted goal ${params.goalId} from workspace ${params.productId}`
            }
          ],
          structuredContent: {
            deleted: true as const,
            record_type: "goal" as const,
            id: params.goalId
          }
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error deleting goal: ${describeAhaError(error, params.goalId)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // List key results tool
  server.registerTool(
    "aha_list_key_results",
    {
      title: "List key results",
      description:
        "List the key results belonging to a goal in Aha.io. This is how you get the id of a " +
        "key result before updating it: aha_search cannot return a key result's metrics or " +
        "status, and the abbreviated copies inside a goal are not the full records. Returns " +
        "each key result with its status, progress and metrics, plus a link per key result.",
      inputSchema: {
        goalId: z.string().describe("Reference number (e.g. PRJ1-G-3) or internal id of the goal"),
        page: z.number().min(1).optional().describe("1-based page number"),
        perPage: z.number().min(1).max(200).optional().describe("Key results per page, up to 200")
      },
      outputSchema: keyResultsListOutputSchema,
      annotations: {
        title: "List key results",
        readOnlyHint: true,
        // destructiveHint and idempotentHint are omitted deliberately: the spec only gives
        // them meaning for tools that write.
        openWorldHint: true
      }
    },
    async (params: { goalId: string; page?: number; perPage?: number }) => {
      try {
        const response = await services.AhaService.listKeyResults(
          params.goalId,
          params.page,
          params.perPage
        );
        const keyResults = Array.isArray(response?.key_results) ? response.key_results : [];

        const lines = keyResults.map(keyResult => {
          const record = keyResult as Record<string, unknown>;
          const status =
            record.workflow_status && typeof record.workflow_status === "object"
              ? (record.workflow_status as Record<string, unknown>).name
              : record.workflow_status;
          const metric =
            typeof record.current_metric === "string" && record.current_metric
              ? `${record.current_metric}${typeof record.target_metric === "string" && record.target_metric ? ` of ${record.target_metric}` : ""}`
              : undefined;
          const detail = [status, metric].filter(Boolean).join(", ");
          return `- ${record.reference_num ?? record.id} "${record.name ?? "(unnamed)"}"${detail ? ` (${detail})` : ""}`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                keyResults.length === 0
                  ? `Goal ${params.goalId} has no key results`
                  : `${keyResults.length} key result${keyResults.length === 1 ? "" : "s"} on goal ${params.goalId}:\n${lines.join("\n")}`
            },
            // One link per key result, unlike aha_search: every record here is the same type
            // and has a resource template, so coverage is complete rather than partial.
            ...keyResults.flatMap(keyResult =>
              recordLinks("key_result", keyResult as Record<string, unknown>)
            )
          ],
          structuredContent: {
            goal_id: params.goalId,
            key_results: keyResults as Record<string, unknown>[],
            ...(response?.pagination ? { pagination: response.pagination } : {})
          }
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing key results: ${describeAhaError(error, params.goalId)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create key result tool
  server.registerTool(
    "aha_create_key_result",
    {
      title: "Create key result",
      description:
        "Create a key result under a goal in Aha.io - the measurable half of an OKR. Aha " +
        "documents name, description, workflow_status, current_metric, assigned_to_user and " +
        "watchers for creation; if a starting or target metric does not come back set, follow " +
        "with aha_update_key_result, which documents those. Returns the created key result and " +
        "a link to it.",
      inputSchema: {
        goalId: z
          .string()
          .describe("Reference number (e.g. PRJ1-G-3) or internal id of the goal that will own it"),
        keyResultData: z
          .object({
            key_result: z.object(keyResultFields).describe("Key result data object")
          })
          .describe("Key result creation data")
      },
      outputSchema: keyResultOutputSchema,
      annotations: {
        title: "Create key result",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params: { goalId: string; keyResultData: any }) => {
      try {
        const keyResult = await services.AhaService.createKeyResult(
          params.goalId,
          params.keyResultData
        );
        const record = unwrapRecord(keyResult, "key_result");

        return {
          content: [
            {
              type: "text" as const,
              text: recordSummary("Created key result", record, { detail: `goal ${params.goalId}` })
            },
            ...recordLinks("key_result", record)
          ],
          structuredContent: record
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating key result: ${describeAhaError(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update key result tool
  server.registerTool(
    "aha_update_key_result",
    {
      title: "Update key result",
      description:
        "Update a key result in Aha.io - its status, its starting, current or target metric, " +
        "its name or description. This is how an OKR gets re-graded: move current_metric and " +
        "set workflow_status. Only the fields you send change; read the key result first with " +
        "aha_get_key_result. Returns the updated key result and a link to it.",
      inputSchema: {
        keyResultId: z
          .string()
          .describe(
            "Reference number (e.g. PRJ1-G-3-KR-1) or internal id of the key result. aha_list_key_results returns both."
          ),
        keyResultData: z
          .object({
            key_result: z.object(keyResultFields).describe("Key result data object")
          })
          .describe("Key result update data")
      },
      outputSchema: keyResultOutputSchema,
      annotations: {
        title: "Update key result",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: { keyResultId: string; keyResultData: any }) => {
      try {
        const keyResult = await services.AhaService.updateKeyResult(
          params.keyResultId,
          params.keyResultData
        );
        const record = unwrapRecord(keyResult, "key_result");

        return {
          content: [
            {
              type: "text" as const,
              text: recordSummary("Updated key result", record, { fallbackId: params.keyResultId })
            },
            ...recordLinks("key_result", record, params.keyResultId)
          ],
          structuredContent: record
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error updating key result: ${describeAhaError(error, params.keyResultId)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete key result tool
  server.registerTool(
    "aha_delete_key_result",
    {
      title: "Delete key result",
      description:
        "Delete a key result in Aha.io. Returns a confirmation naming the deleted key result; " +
        "there is no record to return.",
      inputSchema: {
        keyResultId: z
          .string()
          .describe("Reference number (e.g. PRJ1-G-3-KR-1) or internal id of the key result")
      },
      outputSchema: deletionOutputSchema,
      annotations: {
        title: "Delete key result",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: { keyResultId: string }) => {
      try {
        await services.AhaService.deleteKeyResult(params.keyResultId);

        return {
          content: [
            {
              type: "text" as const,
              text: `Deleted key result ${params.keyResultId}`
            }
          ],
          structuredContent: {
            deleted: true as const,
            record_type: "key_result" as const,
            id: params.keyResultId
          }
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error deleting key result: ${describeAhaError(error, params.keyResultId)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}
