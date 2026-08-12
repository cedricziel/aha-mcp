import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  ahaGraphQLClient,
  AhaGraphQLClient,
  MAX_PER_PAGE,
  MIN_PER_PAGE,
  SEARCHABLE_TYPES
} from "../services/aha-graphql.js";
import { searchOutputSchema } from "../tool-output.js";
import { log } from "../logger.js";
import { describeAhaError } from "../services/aha-errors.js";

/**
 * Register search tools.
 *
 * This replaces the previous local-cache approach, which synced Aha into SQLite and ranked
 * with a placeholder embedding function. Aha's own search index is server-side, always
 * current, and covers names, descriptions and comment bodies across record types.
 */
/** The payload `aha_search` builds, which is also what it validates against its output schema. */
type SearchPayload = {
  query: string;
  total_count: number;
  total_count_is_capped: boolean;
  page: number;
  total_pages: number;
  results: { name: string | null; type: string; url: string }[];
};

/**
 * Render the result set as markdown links rather than as the payload re-serialised.
 *
 * `structuredContent` already carries the machine copy, so repeating it as indented JSON
 * bought nothing and cost the whole payload a second time. Links are the form the server
 * instructions ask for anyway - building them here means the hits reach the user without
 * being re-emitted through generation, where a URL can be mangled.
 */
function renderResults(payload: SearchPayload): string {
  if (payload.results.length === 0) {
    return `No matches for "${payload.query}".`;
  }

  const count = payload.total_count_is_capped
    ? `More than ${payload.total_count} matches (Aha stops counting there)`
    : `${payload.total_count} ${payload.total_count === 1 ? "match" : "matches"}`;
  const pages = payload.total_pages > 1 ? `, page ${payload.page} of ${payload.total_pages}` : "";

  const lines = payload.results.map(
    hit => `- [${hit.name ?? "Untitled"}](${hit.url}) - ${hit.type}`
  );

  return `${count} for "${payload.query}"${pages}:\n${lines.join("\n")}`;
}

export function registerSearchTools(server: McpServer, client: AhaGraphQLClient = ahaGraphQLClient) {
  server.registerTool(
    "aha_search",
    {
      title: "Search Aha.io",
      description: "Search across Aha.io records - ideas, features, epics, initiatives, goals, key results, " +
          "requirements, releases, tasks, pages, comments and more. Queries Aha.io directly, so " +
          "results are always current. Supports 'term*' for prefix matching, AND/OR/NOT, and " +
          "\"quoted phrases\". Use '*' to match everything, which is useful with workspaceId to " +
          "list a workspace's records. Returns each hit's name, type and absolute Aha.io URL, " +
          "already rendered as markdown links, plus paging counts.",
      inputSchema: {
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
      outputSchema: searchOutputSchema,
      annotations: {
        title: "Search Aha.io",
        readOnlyHint: true,
        openWorldHint: true,
      },
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

        const payload = {
          query,
          workspace_id: workspaceId ?? null,
          record_types: recordTypes ?? ("all" as const),
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
        };

        return {
          content: [
            {
              type: "text" as const,
              text: renderResults(payload)
            }
          ],
          structuredContent: payload
        };
      } catch (error) {
        const message = describeAhaError(error);
        log.error("Search failed", error as Error);
        return {
          content: [{ type: "text" as const, text: `Search failed: ${message}` }],
          isError: true
        };
      }
    }
  );
}
