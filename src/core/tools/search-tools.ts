import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  ahaGraphQLClient,
  AhaGraphQLClient,
  MAX_PER_PAGE,
  MIN_PER_PAGE,
  SEARCHABLE_TYPES
} from "../services/aha-graphql.js";
import { log } from "../logger.js";

/**
 * Register search tools.
 *
 * This replaces the previous local-cache approach, which synced Aha into SQLite and ranked
 * with a placeholder embedding function. Aha's own search index is server-side, always
 * current, and covers names, descriptions and comment bodies across record types.
 */
export function registerSearchTools(server: McpServer, client: AhaGraphQLClient = ahaGraphQLClient) {
  server.tool(
    "aha_search",
    "Search across Aha.io records - ideas, features, epics, initiatives, goals, key results, " +
      "requirements, releases, tasks, pages, comments and more. Queries Aha.io directly, so " +
      "results are always current. Supports 'term*' for prefix matching, AND/OR/NOT, and " +
      "\"quoted phrases\". Use '*' to match everything, which is useful with workspaceId to " +
      "list a workspace's records.",
    {
      query: z
        .string()
        .min(1)
        .describe(
          "Search term. Matches record names and descriptions, and comment bodies. " +
            "Supports 'term*' prefix matching, AND/OR/NOT, and \"quoted phrases\". Use '*' to match all."
        ),
      workspaceId: z
        .string()
        .optional()
        .describe(
          "Restrict results to one workspace (Aha project id). Get ids from the aha://products resource."
        ),
      recordTypes: z
        .array(z.enum(SEARCHABLE_TYPES))
        .optional()
        .describe(
          `Restrict to these record types. Any of: ${SEARCHABLE_TYPES.join(", ")}. Omit to search all.`
        ),
      page: z.number().int().min(1).optional().describe("Page number, starting at 1."),
      perPage: z
        .number()
        .int()
        .min(MIN_PER_PAGE)
        .max(MAX_PER_PAGE)
        .optional()
        .describe(
          `Results per page, ${MIN_PER_PAGE}-${MAX_PER_PAGE} (default 20). Aha.io raises ` +
            `anything below ${MIN_PER_PAGE} to ${MIN_PER_PAGE}.`
        )
    },
    async ({ query, workspaceId, recordTypes, page, perPage }) => {
      try {
        const result = await client.searchDocuments({
          query,
          projectId: workspaceId,
          searchableType: recordTypes,
          page,
          per: perPage
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  query,
                  workspace_id: workspaceId ?? null,
                  record_types: recordTypes ?? "all",
                  total_count: result.totalCount,
                  // Aha stops counting at 10000; say so rather than implying an exact total.
                  total_count_is_capped: result.totalCountIsCapped,
                  page: result.currentPage,
                  total_pages: result.totalPages,
                  is_last_page: result.isLastPage,
                  results: result.results.map(hit => ({
                    name: hit.name,
                    type: hit.searchableType,
                    id: hit.searchableId,
                    workspace_id: hit.projectId,
                    url: hit.url,
                    updated_at: hit.updatedAt
                  }))
                },
                null,
                2
              )
            }
          ]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error("Search failed", error);
        return {
          content: [{ type: "text" as const, text: `Search failed: ${message}` }],
          isError: true
        };
      }
    }
  );
}
