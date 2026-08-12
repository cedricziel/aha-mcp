import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import * as services from "../services/index.js";
import {
  epicOutputSchema,
  featureOutputSchema,
  goalOutputSchema,
  ideaOutputSchema,
  initiativeOutputSchema,
  keyResultOutputSchema,
  recordLinks,
  recordSummary,
  releaseOutputSchema,
  unwrapRecord,
  type LinkableRecordType
} from "../tool-output.js";
import { describeAhaError } from "../services/aha-errors.js";
import { log } from "../logger.js";

/**
 * Single-record read tools.
 *
 * These wrap service methods the `aha://{type}/{id}` resources have always called, and add
 * nothing of their own. They exist because reads reached only through resources are, for
 * many hosts, not reachable at all: the MCP resource API is optional for clients to surface
 * to a model, and connector-style clients commonly expose tools only. On one of those, this
 * server presented ~25 write tools and a single read (`aha_search`) whose six fields carry
 * no workflow status, no release membership and no custom field values - so an agent could
 * change a feature's status but never read the status it was changing. That asymmetry is
 * worse than a missing feature; it invites blind writes.
 *
 * Every type here has both a service getter and a single-record resource template, so the
 * `resource_link` in each result points somewhere real.
 */

/**
 * Aha nests status and the fields most likely to have drifted, and the text block is a
 * one-line summary rather than the record re-serialised - so the summary names them
 * explicitly. A client that drops `structuredContent`, or a person skimming a transcript,
 * still sees the values that decide whether a write is safe.
 */
function stateDetail(record: Record<string, unknown>): string | undefined {
  const parts: string[] = [];

  const status = record.workflow_status;
  if (typeof status === "string" && status) {
    parts.push(status);
  } else if (status && typeof status === "object") {
    const name = (status as Record<string, unknown>).name;
    if (typeof name === "string" && name) parts.push(name);
  }

  // A goal has no top-level workflow_status; the status Aha shows for it lives under its
  // success metric. Only goals carry `success_metric`, so this cannot alter any other
  // record's summary.
  if (parts.length === 0 && record.success_metric && typeof record.success_metric === "object") {
    const metricStatus = (record.success_metric as Record<string, unknown>).workflow_status;
    if (metricStatus && typeof metricStatus === "object") {
      const name = (metricStatus as Record<string, unknown>).name;
      if (typeof name === "string" && name) parts.push(name);
    }
  }

  // Key result metrics, the numbers the whole record exists to track. Again type-specific by
  // construction: no other record type returns these fields.
  const current = record.current_metric;
  const target = record.target_metric;
  if (typeof current === "string" && current) {
    parts.push(typeof target === "string" && target ? `${current} of ${target}` : `at ${current}`);
  } else if (typeof target === "string" && target) {
    parts.push(`target ${target}`);
  }

  const releaseRef =
    record.release_reference_num ??
    (record.release && typeof record.release === "object"
      ? (record.release as Record<string, unknown>).reference_num
      : undefined);
  if (typeof releaseRef === "string" && releaseRef) parts.push(`release ${releaseRef}`);

  const assignee = record.assigned_to_user;
  if (assignee && typeof assignee === "object") {
    const name = (assignee as Record<string, unknown>).name;
    if (typeof name === "string" && name) parts.push(`assigned to ${name}`);
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
}

interface ReaderConfig {
  /** Tool name, e.g. `aha_get_feature`. */
  tool: string;
  /** Display title, used for both `title` and `annotations.title`. */
  title: string;
  /** Lower-case record type as it reads in prose, e.g. "feature". */
  noun: string;
  /** Resource type for the `aha://` link; also the type the record is unwrapped as. */
  recordType: LinkableRecordType;
  /** Input parameter name, matching the writing tools' convention (`featureId`, ...). */
  idParam: string;
  /** Example reference number for this type, e.g. `PRJ1-123`. */
  example: string;
  /** The fields worth naming in the description, beyond the common ones. */
  fields: string;
  /** The wrapper key Aha may nest the record under; see `unwrapRecord`. */
  unwrapKey: string;
  outputSchema: z.ZodObject<z.ZodRawShape>;
  fetch: (id: string) => Promise<unknown>;
}

const READERS: ReaderConfig[] = [
  {
    tool: "aha_get_feature",
    title: "Get feature",
    noun: "feature",
    recordType: "feature",
    idParam: "featureId",
    example: "PRJ1-123",
    fields: "workflow status, release, epic, initiative, assignee, tags, score, progress and custom field values",
    unwrapKey: "feature",
    outputSchema: featureOutputSchema,
    fetch: id => services.AhaService.getFeature(id)
  },
  {
    tool: "aha_get_epic",
    title: "Get epic",
    noun: "epic",
    recordType: "epic",
    idParam: "epicId",
    example: "PRJ1-E-4",
    fields: "workflow status, release, initiative, assignee, progress and custom field values",
    unwrapKey: "epic",
    outputSchema: epicOutputSchema,
    fetch: id => services.AhaService.getEpic(id)
  },
  {
    tool: "aha_get_idea",
    title: "Get idea",
    noun: "idea",
    recordType: "idea",
    idParam: "ideaId",
    example: "PRJ1-I-7",
    fields: "workflow status, score, endorsement and vote counts, categories and custom field values",
    unwrapKey: "idea",
    outputSchema: ideaOutputSchema,
    fetch: id => services.AhaService.getIdea(id)
  },
  {
    tool: "aha_get_initiative",
    title: "Get initiative",
    noun: "initiative",
    recordType: "initiative",
    idParam: "initiativeId",
    example: "PRJ1-S-2",
    fields: "workflow status, progress, timeframe, goals and custom field values",
    unwrapKey: "initiative",
    outputSchema: initiativeOutputSchema,
    fetch: id => services.AhaService.getInitiative(id)
  },
  {
    tool: "aha_get_release",
    title: "Get release",
    noun: "release",
    recordType: "release",
    idParam: "releaseId",
    example: "PRJ1-R-3",
    fields:
      "workflow status, progress, whether it has been released, its release date, parking-lot flag, goals and custom field values",
    unwrapKey: "release",
    outputSchema: releaseOutputSchema,
    fetch: id => services.AhaService.getRelease(id)
  },
  {
    tool: "aha_get_goal",
    title: "Get goal",
    noun: "goal",
    recordType: "goal",
    idParam: "goalId",
    example: "PRJ1-G-3",
    fields:
      "progress and what drives it, time frame, success metric and its status, product_id, the initiatives and work rolling up to it, and a summary of its key results",
    unwrapKey: "goal",
    outputSchema: goalOutputSchema,
    fetch: id => services.AhaService.getGoal(id)
  },
  {
    tool: "aha_get_key_result",
    title: "Get key result",
    noun: "key result",
    recordType: "key_result",
    idParam: "keyResultId",
    example: "PRJ1-G-3-KR-1",
    fields: "workflow status, progress, and the starting, current and target metrics",
    unwrapKey: "key_result",
    outputSchema: keyResultOutputSchema,
    fetch: id => services.AhaService.getKeyResult(id)
  }
];

/** "an epic", not "a epic" - these strings are read by people as well as models. */
function article(noun: string): string {
  return /^[aeiou]/i.test(noun) ? "an" : "a";
}

function register(server: McpServer, config: ReaderConfig) {
  server.registerTool(
    config.tool,
    {
      title: config.title,
      description:
        `Read one ${config.noun} from Aha.io by reference number (e.g. ${config.example}) or ` +
        `internal id. Returns the full current record - including ${config.fields} - as ` +
        `structuredContent, a one-line summary naming its status, and a link to the ` +
        `${config.noun}. aha_search returns none of these fields, so use this to see ` +
        `${article(config.noun)} ${config.noun}'s current values, and always read before you ` +
        `write to one. aha_list_comments reads its comment thread.`,
      inputSchema: {
        [config.idParam]: z
          .string()
          .min(1)
          .describe(
            `Reference number (e.g. ${config.example}) or internal id of the ${config.noun}. ` +
              `Both work; an aha_search hit's id is the internal one, and its url ends in the ` +
              `reference number.`
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
    async (params: { [key: string]: string }) => {
      const id = params[config.idParam];
      try {
        const response = await config.fetch(id);
        const record = unwrapRecord(response, config.unwrapKey);

        return {
          content: [
            {
              type: "text" as const,
              text: recordSummary(`Read ${config.noun}`, record, {
                fallbackId: id,
                detail: stateDetail(record)
              })
            },
            ...recordLinks(config.recordType, record, id)
          ],
          structuredContent: record
        };
      } catch (error) {
        log.error(`Failed to read ${config.noun} ${id}`, error as Error);
        return {
          content: [
            {
              type: "text" as const,
              // The id goes in as the subject so a 403 or 404 names the record that could
              // not be read, rather than "the requested record".
              text: `Error retrieving ${config.noun}: ${describeAhaError(error, id)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}

/** Register the single-record read tools. */
export function registerRecordTools(server: McpServer) {
  for (const config of READERS) register(server, config);
}
