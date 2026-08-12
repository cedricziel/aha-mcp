import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  ahaGraphQLClient,
  AhaGraphQLClient,
  MAX_PER_PAGE,
  MIN_PER_PAGE,
  SEARCHABLE_TYPES
} from "../services/aha-graphql.js";
import { recordLinks, searchOutputSchema, type LinkableRecordType } from "../tool-output.js";
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
type SearchHitPayload = {
  name: string | null;
  type: string;
  id: string | null;
  reference_num: string | null;
  workspace_id: string | null;
  url: string;
  updated_at: string;
  score?: number | null;
  votes?: number | null;
  endorsements?: number | null;
};

type SearchPayload = {
  query: string;
  total_count: number;
  total_count_is_capped: boolean;
  page: number;
  total_pages: number;
  results: SearchHitPayload[];
};

/**
 * GraphQL record types that have a single-record resource template in `resources.ts`, and so
 * can be linked as `aha://{type}/{id}`.
 *
 * `aha_search` used to emit no `resource_link`s at all, on the grounds that it returns a dozen
 * types while only a few are linkable, so linking would cover part of a result set and
 * silently skip the rest. Coverage is still partial - it is bounded by which types are
 * readable as resources, not by anything this tool decides - but it is no longer silent: the
 * tool description names the types that get a link, and every hit carries its absolute `url`
 * either way. A hit that cannot be re-read is a worse outcome than an uneven result set,
 * which is what the previous rule optimised for.
 *
 * `Project` is deliberately absent even though `aha://product/{id}` exists: a Project hit's
 * `searchableId` has not been checked against that resource, and an unverified link is the
 * thing this list is meant to prevent. `Task` likewise - a GraphQL Task and a REST todo are
 * not confirmed to be the same record.
 */
const LINKABLE_TYPES: Record<string, LinkableRecordType> = {
  Feature: "feature",
  Epic: "epic",
  Idea: "idea",
  Initiative: "initiative",
  Goal: "goal",
  KeyResult: "key_result",
  Release: "release",
  Requirement: "requirement",
  Competitor: "competitor"
};

/**
 * The ideas-portal demand signal, rendered only for the hits that have it.
 *
 * Two deliberate omissions, both measured over 200 ideas on a live account:
 *
 *  - **`votes` and `endorsements` are collapsed when equal**, which there they always were -
 *    200 ideas, zero disagreements, so one endorsement per vote. They are still separate
 *    fields in `structuredContent`, because they are separate things in Aha and an account
 *    that weights votes would show it; repeating the same number twice on every line is not
 *    worth the width.
 *  - **`score` is not rendered at all.** Every one of those 200 ideas scored exactly 20 - one
 *    distinct value - so on this account it ranks nothing, while a feature in the same result
 *    set scored 0. It stays in `structuredContent` for accounts that do score, but it earns no
 *    room in a line a person reads.
 */
function demand(hit: SearchHitPayload): string {
  const { votes, endorsements } = hit;
  if (typeof votes !== "number" && typeof endorsements !== "number") return "";

  if (typeof votes === "number" && votes === endorsements) {
    return ` - ${votes} ${votes === 1 ? "vote" : "votes"}`;
  }

  const parts: string[] = [];
  if (typeof votes === "number") parts.push(`${votes} ${votes === 1 ? "vote" : "votes"}`);
  if (typeof endorsements === "number") parts.push(`${endorsements} endorsements`);
  return ` - ${parts.join(", ")}`;
}

/**
 * Render the result set as markdown links rather than as the payload re-serialised.
 *
 * `structuredContent` already carries the machine copy, so repeating it as indented JSON
 * bought nothing and cost the whole payload a second time. Links are the form the server
 * instructions ask for anyway - building them here means the hits reach the user without
 * being re-emitted through generation, where a URL can be mangled.
 *
 * The label leads with the reference number because that is the identifier a person and a
 * follow-up read both need, and because it is the part that goes missing when a model
 * reconstructs an identifier from a url path: `I-9930` instead of `IDEASVOC-I-9930`, which
 * every subsequent read answers with 404.
 */
function renderResults(payload: SearchPayload): string {
  if (payload.results.length === 0) {
    return `No matches for "${payload.query}".`;
  }

  const count = payload.total_count_is_capped
    ? `More than ${payload.total_count} matches (Aha stops counting there)`
    : `${payload.total_count} ${payload.total_count === 1 ? "match" : "matches"}`;
  const pages = payload.total_pages > 1 ? `, page ${payload.page} of ${payload.total_pages}` : "";

  const lines = payload.results.map(hit => {
    const label = [hit.reference_num, hit.name ?? "Untitled"].filter(Boolean).join(" ");
    return `- [${label}](${hit.url}) - ${hit.type}${demand(hit)}`;
  });

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
          "\"quoted phrases\". There is no match-all query: '*' is rejected, because Aha.io " +
          "returns nothing for it once workspaceId is set. Returns each hit's name, type, " +
          "reference number and absolute Aha.io URL, already rendered as markdown links, plus " +
          "paging counts. Idea hits also carry portal vote and endorsement counts, and scorable " +
          "types their Aha.io score, so ideas can be ranked by demand from a search alone. " +
          "Quote a reference number in full - the workspace prefix is part of it (IDEASVOC-I-9930, " +
          "not I-9930), and every read of a truncated one fails. Feature, epic, idea, initiative, " +
          "goal, key result, release, requirement and competitor hits come with a resource link; " +
          "other types are reachable by their URL only. Still no workflow status, release " +
          "membership or custom fields: read a specific record with aha_get_feature, " +
          "aha_get_epic, aha_get_idea, aha_get_initiative or aha_get_release when you need its " +
          "current field values, and always do so before writing to it.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "Search term. Matches record names and descriptions, and comment bodies. " +
              "Supports 'term*' prefix matching, AND/OR/NOT, and \"quoted phrases\". A bare '*' " +
              "is not a match-all and is rejected; to sweep broadly, use alternatives such as " +
              "'a* OR b* OR c*'."
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
            // `?? null` rather than a bare read: the field is required-and-nullable in the
            // output schema, so an undefined would fail validation and sink the call.
            reference_num: hit.referenceNum ?? null,
            workspace_id: hit.projectId,
            url: hit.url,
            updated_at: hit.updatedAt,
            // Omitted rather than sent as null, so a page of 200 hits does not carry 600
            // empty keys. `reference_num` is nullable for the opposite reason - see the
            // output schema.
            ...(hit.score != null ? { score: hit.score } : {}),
            ...(hit.votes != null ? { votes: hit.votes } : {}),
            ...(hit.endorsements != null ? { endorsements: hit.endorsements } : {})
          }))
        };

        return {
          content: [
            {
              type: "text" as const,
              text: renderResults(payload)
            },
            // One link per hit whose type is readable as a resource. Bounded by perPage,
            // which the caller sets, rather than by a cap here that would drop links
            // silently - the same rule the release and key-result list tools follow.
            ...payload.results.flatMap(hit => {
              const recordType = LINKABLE_TYPES[hit.type];
              if (!recordType) return [];
              return recordLinks(
                recordType,
                { reference_num: hit.reference_num, id: hit.id, name: hit.name, updated_at: hit.updated_at },
                undefined,
                { description: `Search hit. Read it for this ${recordType}'s current full state.` }
              );
            })
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
