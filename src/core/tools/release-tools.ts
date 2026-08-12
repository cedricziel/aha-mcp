import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as services from "../services/index.js";
import { recordLinks, releaseFeaturesListOutputSchema } from "../tool-output.js";
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
 * Aha has the endpoint - `GET /releases/{id}/features` - and this server has always wrapped it
 * as the `aha://release/{release_id}/features` resource. That is unreachable on a tool-only
 * client, which is the same asymmetry `record-tools.ts` exists to fix: every read a client
 * needs has to be reachable as a tool.
 */

/** Aha's own page size for this endpoint, measured; used in the description, not as a default. */
const AHA_DEFAULT_PER_PAGE = 30;

/** What this tool asks for unless told otherwise, so one call enumerates most releases whole. */
const DEFAULT_PER_PAGE = 200;

export function registerReleaseTools(server: McpServer) {
  server.registerTool(
    "aha_list_release_features",
    {
      title: "List features in a release",
      description:
        "List the features assigned to a release in Aha.io. This is the only way to enumerate " +
        "a release: aha_search is relevance-ranked, returns no release membership on a hit, and " +
        "cannot be asked for every record in a scope, so a search-built list of a release is " +
        `partial without saying so. Requests ${DEFAULT_PER_PAGE} features per page by default ` +
        `(Aha's own default is ${AHA_DEFAULT_PER_PAGE}); returns each feature with a link to it, ` +
        "plus Aha's pagination block naming the total on the release so a caller can tell a " +
        "complete list from the front of a longer one. Aha returns identity fields only here - " +
        "no workflow status - so follow up with aha_get_feature for the state of one.",
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
          .describe(`Features per page, up to 200. Defaults to ${DEFAULT_PER_PAGE}`)
      },
      outputSchema: releaseFeaturesListOutputSchema,
      annotations: {
        title: "List features in a release",
        readOnlyHint: true,
        // destructiveHint and idempotentHint are omitted deliberately: the spec only gives
        // them meaning for tools that write.
        openWorldHint: true
      }
    },
    async (params: { releaseId: string; page?: number; perPage?: number }) => {
      try {
        const perPage = params.perPage ?? DEFAULT_PER_PAGE;
        const response = await services.AhaService.getReleaseFeatures(
          params.releaseId,
          params.page,
          perPage
        );
        const features = Array.isArray(response?.features) ? response.features : [];
        const pagination = response?.pagination as Record<string, unknown> | undefined;

        const lines = features.map(feature => {
          const record = feature as Record<string, unknown>;
          return `- ${record.reference_num ?? record.id} "${record.name ?? "(unnamed)"}"`;
        });

        return {
          content: [
            {
              type: "text" as const,
              // The count line states coverage rather than leaving it to be inferred, and names
              // the next page when there is one: the failure this tool exists to prevent is a
              // caller treating a page as the release.
              text:
                features.length === 0
                  ? `Release ${params.releaseId} has no features on this page`
                  : `${coverage(features.length, pagination)} in release ${params.releaseId}:\n${lines.join("\n")}${nextPageHint(pagination)}`
            },
            // One link per feature. Coverage is complete - every record here is a feature, and
            // features have a single-record resource template - which is the same test
            // aha_list_key_results passes and aha_search fails. The block count is bounded by
            // perPage, so it is the caller's to control rather than a silent cap here.
            ...features.flatMap(feature => recordLinks("feature", feature as Record<string, unknown>))
          ],
          structuredContent: {
            release_id: params.releaseId,
            features: features as Record<string, unknown>[],
            ...(pagination ? { pagination } : {})
          }
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing release features: ${describeAhaError(error, params.releaseId)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}

/**
 * "16 features" when the page is the release, "30 of 59 features" when it is not.
 *
 * Only claims a total when Aha sent one and it disagrees with what arrived; a total that
 * matches the page is not worth the words, and inventing one would be the very thing this
 * tool is here to stop.
 */
function coverage(returned: number, pagination: Record<string, unknown> | undefined): string {
  const total = pagination?.total_records;
  const plural = (n: number) => `${n} feature${n === 1 ? "" : "s"}`;

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
