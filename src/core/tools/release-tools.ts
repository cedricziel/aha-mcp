import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as services from "../services/index.js";
import {
  recordLinks,
  releaseEpicsListOutputSchema,
  releaseFeaturesListOutputSchema,
  type LinkableRecordType
} from "../tool-output.js";
import { describeAhaError } from "../services/aha-errors.js";

/**
 * Release membership reads.
 *
 * `aha_search` cannot answer "what is in this release". It is relevance-ranked rather than
 * enumerable: it returns the hits it considers best for a query string, with no way to ask for
 * *all* records matching a scope - and a hit carries no per-type fields, so release membership
 * is not even visible on one (see the search notes in CLAUDE.md). Reported from a real
 * session: search surfaced 4 features of a release that holds 16, and the caller could tell
 * the list was short only by noticing gaps in the position values. A partial list that looks
 * whole is worse than an error, because nothing in the result says it is partial.
 *
 * Aha has the endpoints - `GET /releases/{id}/features` and `GET /releases/{id}/epics` - and
 * this server has always wrapped both as `aha://release/{release_id}/features` and
 * `.../epics`. Those are unreachable on a tool-only client, which is the same asymmetry
 * `record-tools.ts` exists to fix.
 *
 * Both types are listed because a release is not organised the same way in every workspace:
 * one that plans in epics is as invisible through the features tool as it was through search.
 */

/** What these tools ask for unless told otherwise, so one call enumerates most releases whole. */
const DEFAULT_PER_PAGE = 200;

interface MembershipConfig {
  /** Tool name, e.g. `aha_list_release_features`. */
  tool: string;
  /** Display title, used for both `title` and `annotations.title`. */
  title: string;
  /** Plural noun as it reads in prose, e.g. "features". */
  plural: string;
  /** Singular noun, for the count line and the follow-up tool it names. */
  singular: string;
  /** Resource type for the `aha://` link per record. */
  recordType: LinkableRecordType;
  /** Key the records arrive under in Aha's response. */
  collectionKey: "features" | "epics";
  /** The single-record read tool to point at for state this endpoint does not carry. */
  readerTool: string;
  /**
   * Aha's own page size on this route, when it has been measured. Omitted rather than guessed:
   * a description that names a number nobody measured is worse than one that stays quiet.
   */
  ahaDefault?: string;
  outputSchema: z.ZodObject<z.ZodRawShape>;
  fetch: (releaseId: string, page: number | undefined, perPage: number) => Promise<unknown>;
}

const MEMBERSHIP: MembershipConfig[] = [
  {
    tool: "aha_list_release_features",
    title: "List features in a release",
    plural: "features",
    singular: "feature",
    recordType: "feature",
    collectionKey: "features",
    readerTool: "aha_get_feature",
    // Measured: a 59-feature release answers with 30 when asked for no page size.
    ahaDefault: "30",
    outputSchema: releaseFeaturesListOutputSchema,
    fetch: (releaseId, page, perPage) =>
      services.AhaService.getReleaseFeatures(releaseId, page, perPage)
  },
  {
    tool: "aha_list_release_epics",
    title: "List epics in a release",
    plural: "epics",
    singular: "epic",
    recordType: "epic",
    collectionKey: "epics",
    readerTool: "aha_get_epic",
    // Left unset, because it has not been measured: the largest release reachable on the
    // account probed holds 4 epics, so the endpoint never had to page unasked. Do not copy the
    // features endpoint's 30 across - it is a different route. The tool always sends an
    // explicit per_page, so Aha's default does not decide what a caller gets either way.
    ahaDefault: undefined,
    outputSchema: releaseEpicsListOutputSchema,
    fetch: (releaseId, page, perPage) =>
      services.AhaService.getReleaseEpics(releaseId, page, perPage)
  }
];

export function registerReleaseTools(server: McpServer) {
  for (const config of MEMBERSHIP) {
    server.registerTool(
      config.tool,
      {
        title: config.title,
        description:
          `List the ${config.plural} assigned to a release in Aha.io. This is the only way to ` +
          `enumerate a release's ${config.plural}: aha_search is relevance-ranked, returns no ` +
          "release membership on a hit, and cannot be asked for every record in a scope, so a " +
          `search-built list is partial without saying so. Requests ${DEFAULT_PER_PAGE} ` +
          `${config.plural} per page by default` +
          (config.ahaDefault ? ` (Aha's own default is ${config.ahaDefault})` : "") +
          `; returns each ${config.singular} with a link to it, plus Aha's pagination block naming ` +
          "the total on the release so a caller can tell a complete list from the front of a " +
          "longer one. Aha returns identity fields only here - no workflow status - so follow " +
          `up with ${config.readerTool} for the state of one.`,
        inputSchema: {
          releaseId: z
            .string()
            .describe("Reference number (e.g. PRJ1-R-18) or internal id of the release"),
          page: z.number().min(1).optional().describe("1-based page number"),
          perPage: z
            .number()
            .min(1)
            .max(200)
            .optional()
            .describe(
              `${config.plural[0].toUpperCase()}${config.plural.slice(1)} per page, up to 200. ` +
                `Defaults to ${DEFAULT_PER_PAGE}`
            )
        },
        outputSchema: config.outputSchema,
        annotations: {
          title: config.title,
          readOnlyHint: true,
          // destructiveHint and idempotentHint are omitted deliberately: the spec only gives
          // them meaning for tools that write.
          openWorldHint: true
        }
      },
      async (params: { releaseId: string; page?: number; perPage?: number }) => {
        try {
          const perPage = params.perPage ?? DEFAULT_PER_PAGE;
          const response = (await config.fetch(params.releaseId, params.page, perPage)) as
            | Record<string, unknown>
            | undefined;

          const raw = response?.[config.collectionKey];
          const records = (Array.isArray(raw) ? raw : []) as Record<string, unknown>[];
          const pagination = response?.pagination as Record<string, unknown> | undefined;

          const lines = records.map(
            record => `- ${record.reference_num ?? record.id} "${record.name ?? "(unnamed)"}"`
          );

          return {
            content: [
              {
                type: "text" as const,
                // The count line states coverage rather than leaving it to be inferred, and
                // names the next page when there is one: the failure these tools exist to
                // prevent is a caller treating a page as the release.
                text:
                  records.length === 0
                    ? `Release ${params.releaseId} has no ${config.plural} on this page`
                    : `${coverage(records.length, pagination, config.singular)} in release ${params.releaseId}:\n${lines.join("\n")}${nextPageHint(pagination)}`
              },
              // One link per record. Coverage is complete - every record here is the same type
              // and that type has a single-record resource template - which is the test
              // aha_list_key_results passes and aha_search fails. The block count is bounded by
              // perPage, so it is the caller's to control rather than a silent cap here.
              ...records.flatMap(record => recordLinks(config.recordType, record))
            ],
            structuredContent: {
              release_id: params.releaseId,
              [config.collectionKey]: records,
              ...(pagination ? { pagination } : {})
            }
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error listing release ${config.plural}: ${describeAhaError(error, params.releaseId)}`
              }
            ],
            isError: true
          };
        }
      }
    );
  }
}

/**
 * "16 features" when the page is the release, "30 of 59 features" when it is not.
 *
 * Only claims a total when Aha sent one and it disagrees with what arrived; a total that
 * matches the page is not worth the words, and inventing one would be the very thing these
 * tools are here to stop.
 */
function coverage(
  returned: number,
  pagination: Record<string, unknown> | undefined,
  singular: string
): string {
  const total = pagination?.total_records;
  const plural = (n: number) => `${n} ${singular}${n === 1 ? "" : "s"}`;

  if (typeof total === "number" && total !== returned) {
    return `${returned} of ${plural(total)}`;
  }
  return plural(returned);
}

/** Name the next page, when Aha's pagination says there is one. */
function nextPageHint(pagination: Record<string, unknown> | undefined): string {
  const current = pagination?.current_page;
  const totalPages = pagination?.total_pages;

  if (typeof current === "number" && typeof totalPages === "number" && current < totalPages) {
    return `\n\nPage ${current} of ${totalPages}. Call again with page: ${current + 1} for the rest.`;
  }
  return "";
}
