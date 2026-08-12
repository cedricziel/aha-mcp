import * as z from "zod/v4";

/**
 * Output schemas for the tools, paired with the `structuredContent` every tool returns
 * alongside its human-readable text block.
 *
 * Two constraints shaped these, both learned the hard way:
 *
 * 1. **Everything that wraps an Aha record must be a `looseObject`.** A raw Zod shape
 *    converts to JSON Schema with `additionalProperties: false`, and the SDK client
 *    validates `structuredContent` against the advertised schema and *throws* on keys the
 *    schema does not list. Aha records carry far more fields than are described here, so a
 *    closed schema would break every one of those tools at call time.
 * 2. **Only type fields Aha reliably returns, and type them permissively.** The server
 *    validates its own `structuredContent` before sending it and turns a mismatch into a
 *    protocol error, so an optimistic guess about a field's type does not degrade - it
 *    fails the call outright. Anything not enumerated here still reaches the client
 *    verbatim; it just is not described.
 *
 * Payloads this server builds itself (deletions, search, the server/config tools) are
 * closed objects, because their shape is known rather than inherited from an API response.
 */

/**
 * Widen an Aha record for `structuredContent`, which the SDK types as an index-signature
 * object. TypeScript does not give an `interface` an implicit index signature, so every
 * record needs one widening step; doing it here keeps the call sites free of casts and
 * makes the reason greppable.
 */
export function structured<T extends object>(record: T): Record<string, unknown> {
  return record as Record<string, unknown>;
}

/**
 * Aha wraps some responses in a single key - `{ idea: { ... } }` for the idea creators,
 * `{ initiative: { ... } }` for initiatives - and returns others bare. Unwrapping here means
 * `structuredContent` is always the record itself, so one contract covers every tool
 * instead of the caller needing to know which record types arrive wrapped.
 *
 * A missing body becomes `{}` rather than undefined: every field of the record schemas is
 * optional, whereas an absent structuredContent fails output validation outright.
 */
export function unwrapRecord(payload: unknown, key: string): Record<string, unknown> {
  if (payload && typeof payload === "object") {
    const inner = (payload as Record<string, unknown>)[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return inner as Record<string, unknown>;
    }
    return payload as Record<string, unknown>;
  }
  return {};
}

/**
 * Record types with a single-record resource template in resources.ts.
 *
 * Spelled as the URI segment, so `release-phase` rather than `release_phase` - a link built
 * from the wrong spelling points at a template that does not match, which is worse than
 * omitting the link.
 */
export type LinkableRecordType =
  | "feature"
  | "epic"
  | "idea"
  | "initiative"
  | "competitor"
  | "release"
  | "release-phase"
  | "goal"
  | "key_result"
  | "requirement"
  | "todo"
  | "product";

function identifier(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

/**
 * Aha timestamps are UTC ISO 8601 (`2024-01-15T10:30:00.000Z`), which is what the SDK's
 * `lastModified` annotation accepts. It is typed as `z.iso.datetime()`, which rejects a
 * numeric offset, so anything that is not plainly Zulu is dropped rather than risking a
 * validation failure on the way out - an omitted annotation costs a hint, a rejected one
 * costs the call.
 */
function isoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) ? value : undefined;
}

/**
 * A `resource_link` back to the record a tool just touched, so a client can re-read its
 * full current state - or subscribe to it - instead of relying on the point-in-time copy in
 * the result. Returns an array so call sites can spread it: there is nothing worth linking
 * to when the response carried no identifier, and a link to an unreadable URI is worse than
 * no link.
 *
 * `title` is what the 2025-06-18 spec tells hosts to display, falling back to `name`; both
 * are set because clients disagree on which they read. The annotations say what the link is
 * for rather than describing it again: it is the one item in the result worth surfacing to
 * a person, hence `priority: 1`, and `lastModified` lets a client tell a fresh read from a
 * stale one without fetching.
 */
export function recordLinks(
  recordType: LinkableRecordType,
  record: Record<string, unknown>,
  fallbackId?: string
) {
  const id = identifier(record.reference_num) ?? identifier(record.id) ?? fallbackId;
  if (!id) return [];

  const name = identifier(record.name);
  const lastModified = isoTimestamp(record.updated_at);

  return [
    {
      type: "resource_link" as const,
      uri: `aha://${recordType}/${id}`,
      name: name ?? `${recordType} ${id}`,
      title: name ? `${id} - ${name}` : `${recordType} ${id}`,
      description: `The ${recordType} this call touched. Read it for the record's current full state.`,
      mimeType: "application/json",
      annotations: {
        audience: ["user" as const, "assistant" as const],
        priority: 1,
        ...(lastModified ? { lastModified } : {})
      }
    }
  ];
}

/**
 * The one-line human summary that every writing tool returns as its text content.
 *
 * This block used to be the record re-serialised as indented JSON, which duplicated
 * `structuredContent` verbatim: double the tokens, and nothing a client could render as
 * anything but a blob. The record itself still travels in `structuredContent`, and the
 * `resource_link` alongside is the durable pointer - so the text block's job is to say what
 * happened, to whom, in a form a person and a model can both read at a glance.
 *
 * @param lead What happened, ending in the record type - "Created feature", "Set tags on feature"
 * @param record The record Aha returned, which may be empty for endpoints that answer with no body
 * @param options `fallbackId` names the record when the response carried no identifier;
 *   `detail` carries operation-specific context that is not evident from the record itself
 */
export function recordSummary(
  lead: string,
  record: Record<string, unknown>,
  options: { fallbackId?: string; detail?: string } = {}
): string {
  const id = identifier(record.reference_num) ?? identifier(record.id) ?? options.fallbackId;
  const name = identifier(record.name);
  const url = identifier(record.url);

  let line = lead;
  if (id) line += ` ${id}`;
  if (name) line += ` "${name}"`;
  if (options.detail) line += ` (${options.detail})`;
  if (url) line += ` - ${url}`;

  // Aha answers some writes with an empty body. Saying so beats a bare verb that reads like
  // the call returned something.
  if (!id && !name) line += " - Aha returned no record body; the write itself succeeded";

  return line;
}

/** Fields common to every Aha record returned by a tool. */
const recordIdentity = {
  id: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Internal Aha.io id. Numeric for some record types, a string for others."),
  reference_num: z
    .string()
    .optional()
    .describe("Human-facing identifier, e.g. PRJ1-123. Prefer this over `id` when talking to people."),
  name: z.string().optional().describe("Record name"),
  url: z.string().optional().describe("Absolute URL of the record's web page in Aha.io"),
  resource: z.string().optional().describe("Absolute URL of the record's REST API endpoint"),
  created_at: z.string().optional().describe("ISO 8601 creation timestamp"),
  updated_at: z.string().optional().describe("ISO 8601 last-modified timestamp")
};

/** Progress and score arrive as numbers, or null when unset. */
const progressField = z.number().nullish().describe("Completion percentage, 0-100");
const scoreField = z.number().nullish().describe("Aha.io score");

/**
 * Described rather than left to pass through undescribed, because it is the field a caller
 * most often needs before writing to a record - and a schema that does not mention it reads
 * as a server that cannot report it. `aha_search` cannot return it (Aha's `searchDocuments`
 * has no per-type fields), so the `aha_get_*` tools are the only way to see it, and naming
 * it here is what tells a model that.
 *
 * The union is deliberate. Every endpoint measured returns an object, but this file's rule
 * is that a wrong guess about a type fails the call outright rather than degrading, so a
 * plain string is admitted too.
 */
const workflowStatusField = z
  .union([
    z.looseObject({
      id: z.union([z.string(), z.number()]).optional(),
      name: z.string().optional(),
      complete: z.boolean().optional(),
      color: z.string().optional()
    }),
    z.string()
  ])
  .nullish()
  .describe("Current workflow status, e.g. { name: \"In development\", complete: false }");

export const featureOutputSchema = z.looseObject({
  ...recordIdentity,
  progress: progressField,
  score: scoreField,
  workflow_status: workflowStatusField
});

export const epicOutputSchema = z.looseObject({
  ...recordIdentity,
  progress: progressField,
  workflow_status: workflowStatusField
});

export const initiativeOutputSchema = z.looseObject({
  ...recordIdentity,
  progress: progressField,
  workflow_status: workflowStatusField
});

export const ideaOutputSchema = z.looseObject({
  ...recordIdentity,
  score: scoreField,
  workflow_status: workflowStatusField
});

export const releaseOutputSchema = z.looseObject({
  ...recordIdentity,
  progress: progressField,
  workflow_status: workflowStatusField
});

export const competitorOutputSchema = z.looseObject({
  ...recordIdentity
});

/**
 * Goals are Aha's objectives: the O of an OKR, with key results hanging off them.
 *
 * No `workflow_status` here, deliberately. Measured against a live account, a goal carries
 * none at the top level - its status lives under `success_metric.workflow_status`, which is
 * what the Aha UI shows as the goal's status. Describing a `workflow_status` a goal never
 * returns would advertise a field no caller could use.
 */
export const goalOutputSchema = z.looseObject({
  ...recordIdentity,
  progress: progressField,
  progress_source: z
    .string()
    .nullish()
    .describe(
      "What drives `progress`, e.g. progress_manual or progress_from_key_results. `progress` is only writable when this is progress_manual."
    ),
  product_id: z
    .union([z.string(), z.number()])
    .nullish()
    .describe("Workspace (Aha product) the goal belongs to. Needed to delete the goal."),
  time_frame: z
    .looseObject({})
    .nullish()
    .describe('Time frame the goal is set in, e.g. { name: "FY27" }'),
  success_metric: z
    .looseObject({})
    .nullish()
    .describe(
      "How success is measured, and where a goal's status actually lives - `success_metric.workflow_status.name` is what Aha shows as the goal's status."
    ),
  key_results: z
    .array(z.looseObject({}))
    .nullish()
    .describe("Abbreviated key results owned by this goal. Read one in full with aha_get_key_result.")
});

/**
 * A key result is the measurable half of an OKR. Unlike every other record type here it
 * carries **no `url`** - measured live, the standalone record has neither `url` nor
 * `resource`, even though the copies embedded in `goal.key_results` do have a `url`. So a
 * summary of one cannot end in a link, and the `aha://key_result/{id}` resource is the only
 * pointer that always exists.
 *
 * The metric fields are strings, not numbers: Aha stores them as typed by the user ("30%",
 * "$1.2M", "8"), and they are null until set.
 */
export const keyResultOutputSchema = z.looseObject({
  ...recordIdentity,
  progress: progressField,
  position: z.number().nullish().describe("Order of the key result within its goal"),
  workflow_status: workflowStatusField,
  starting_metric: z.string().nullish().describe('Metric value at the start, as text, e.g. "0%"'),
  current_metric: z.string().nullish().describe('Where the metric stands now, as text, e.g. "30%"'),
  target_metric: z.string().nullish().describe('Metric value that counts as done, as text, e.g. "90%"')
});

/**
 * `aha_list_key_results` builds this itself from the list response, so it is closed. The
 * key results inside are not: they are Aha records.
 */
export const keyResultsListOutputSchema = z.object({
  goal_id: z.string().describe("Goal whose key results these are, as it was requested"),
  key_results: z.array(keyResultOutputSchema).describe("Key results owned by the goal, in position order"),
  pagination: z
    .looseObject({})
    .optional()
    .describe("Aha's pagination block, when the response carried one")
});

export const commentOutputSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional().describe("Comment id"),
  created_at: z.string().optional().describe("ISO 8601 creation timestamp"),
  updated_at: z.string().optional().describe("ISO 8601 last-modified timestamp")
});

/**
 * An idea portal comment, which carries a `visibility` the generic comment does not.
 *
 * The value here is Aha's read vocabulary - a human-readable phrase such as "Visible to all
 * ideas portal users" - not the `public` / `employee_or_creator` a create request takes. A
 * caller cannot round-trip one into the other.
 */
export const ideaCommentOutputSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional().describe("Idea comment id"),
  idea_id: z.union([z.string(), z.number()]).optional().describe("Idea the comment belongs to"),
  body: z.string().nullish().describe("Comment body, as HTML"),
  visibility: z
    .string()
    .nullish()
    .describe('How visible the comment is, as a phrase, e.g. "Visible to all ideas portal users"'),
  created_at: z.string().optional().describe("ISO 8601 creation timestamp"),
  updated_at: z.string().optional().describe("ISO 8601 last-modified timestamp")
});

/**
 * Aha's DELETE endpoints answer with an empty body, so there is no record to hand back -
 * only a restatement of what went away, which the caller can use to confirm the right
 * record was targeted.
 */
export const deletionOutputSchema = z.object({
  deleted: z.literal(true).describe("Always true; failures come back with isError instead"),
  record_type: z
    .enum(["feature", "epic", "idea", "competitor", "goal", "key_result"])
    .describe("Type of record that was deleted"),
  id: z.string().describe("Id or reference number the deletion was requested for")
});

/**
 * Comment types a record can carry. `internal` is Aha's own comment stream, reachable on
 * every record type; `portal` exists only on ideas and is the conversation that can appear in
 * an ideas portal. They come from different endpoints over disjoint records, so a caller has
 * to be able to tell which one it is holding - hence the field rather than one flat list.
 */
export const COMMENT_SOURCES = ["internal", "portal"] as const;

/**
 * One comment as `aha_list_comments` reports it. Loose, because the body is Aha's record
 * with `source` added, and Aha returns far more fields than are worth describing.
 */
const listedCommentSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional().describe("Comment id"),
  source: z
    .enum(COMMENT_SOURCES)
    .describe(
      'Which stream this came from. "internal" is visible to Aha users only; "portal" can ' +
        "be visible in the ideas portal - check `visibility`."
    ),
  body: z.string().nullish().describe("Comment body, as HTML"),
  visibility: z
    .string()
    .nullish()
    .describe(
      'Portal comments only, as a human-readable phrase, e.g. "Visible to all ideas portal ' +
        'users". Absent on internal comments, which are never portal-visible.'
    ),
  created_at: z.string().nullish().describe("ISO 8601 creation timestamp"),
  updated_at: z.string().nullish().describe("ISO 8601 last-modified timestamp")
});

/** Built by `aha_list_comments`: the wrapper is this server's, the comments are Aha's. */
export const commentListOutputSchema = z.object({
  record_type: z.string().describe("Record type the comments belong to, e.g. feature"),
  record_id: z.string().describe("Id or reference number the comments were read for"),
  comment_count: z.number().describe("Number of comments returned"),
  /**
   * Named explicitly so a zero here cannot be mistaken for "no portal conversation exists".
   * Only ideas have a portal stream, and only ideas are asked for one.
   */
  includes_portal_comments: z
    .boolean()
    .describe(
      "True when the ideas-portal stream was read as well as the internal one. Only ideas " +
        "have a portal stream, so this is false for every other record type."
    ),
  comments: z.array(listedCommentSchema).describe("Comments, oldest first")
});

/** Built by `aha_search` from the GraphQL response, so every field is known. */
export const searchOutputSchema = z.object({
  query: z.string().describe("The search term that was run"),
  workspace_id: z.string().nullable().describe("Workspace the search was scoped to, or null for all"),
  record_types: z
    .union([z.array(z.string()), z.literal("all")])
    .describe('Record types searched, or "all"'),
  total_count: z.number().describe("Number of matching records"),
  total_count_is_capped: z
    .boolean()
    .describe("True when Aha.io stopped counting at 10000, so total_count is a floor, not a total"),
  page: z.number().describe("1-based page number these results came from"),
  total_pages: z.number().describe("Number of pages available"),
  is_last_page: z.boolean().describe("True when there is no further page to fetch"),
  results: z
    .array(
      z.object({
        name: z.string().nullable().describe("Record name"),
        type: z.string().describe("Aha.io record type, e.g. Feature or Idea"),
        id: z.string().nullable().describe("Record id or reference number"),
        workspace_id: z.string().nullable().describe("Workspace (Aha project) the record lives in"),
        url: z.string().describe("Absolute URL of the record's web page in Aha.io"),
        updated_at: z.string().describe("ISO 8601 last-modified timestamp")
      })
    )
    .describe("Matching records, most relevant first")
});

/**
 * The server/config tools report on this process rather than on Aha, but they are still
 * loose: `checks` and the config summary grow fields over time, and none of them is worth
 * a failed tool call.
 */
export const healthCheckOutputSchema = z.looseObject({
  status: z.string().describe("healthy, degraded or unhealthy"),
  timestamp: z.string().describe("ISO 8601 time the check ran"),
  uptime: z.number().describe("Milliseconds since the server started"),
  version: z.string().describe("Server version"),
  checks: z.looseObject({}).describe("Per-subsystem results, each with a status and message")
});

export const serverStatusOutputSchema = z.looseObject({
  status: z.string().describe("Lifecycle state of the server"),
  version: z.string().describe("Server version"),
  uptime: z.number().describe("Milliseconds since the server started"),
  environment: z.string().describe("NODE_ENV the server is running under")
});

const configSummarySchema = z.looseObject({
  company: z.string().describe('Configured company subdomain, or "not configured"'),
  tokenConfigured: z.boolean().describe("Whether an Aha.io API token is present"),
  mode: z.string().describe("Transport mode"),
  isComplete: z.boolean().describe("Whether the configuration is usable against Aha.io")
});

export const configureServerOutputSchema = z.object({
  success: z.literal(true).describe("Always true; failures come back with isError instead"),
  message: z.string().describe("What changed"),
  config: configSummarySchema.describe("Configuration after the update, with the token redacted"),
  note: z.string().describe("Caveats that apply to the update")
});

export const serverConfigOutputSchema = z.looseObject({
  ...configSummarySchema.shape,
  validation: z
    .looseObject({
      isValid: z.boolean().describe("Whether the configuration passes validation"),
      errors: z.array(z.string()).describe("Validation failures, empty when valid")
    })
    .describe("Result of validating the stored configuration"),
  environmentOverrides: z
    .looseObject({})
    .describe("Which settings an environment variable is currently overriding")
});

export const testConfigurationOutputSchema = z.object({
  success: z.literal(true).describe("Always true; failures come back with isError instead"),
  message: z.string().describe("Outcome of the connection test"),
  connection: z.object({
    status: z.string().describe("Connection state"),
    user: z
      .looseObject({
        name: z.string().describe("Display name of the authenticated user"),
        email: z.string().describe("Email of the authenticated user"),
        id: z.string().describe("Aha.io user id")
      })
      .describe("The user the token authenticates as"),
    company: z.string().describe("Company subdomain that was reached")
  })
});
