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

/** Record types with a single-record resource template in resources.ts. */
type LinkableRecordType = "feature" | "epic" | "idea" | "initiative" | "competitor";

function identifier(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

/**
 * A `resource_link` back to the record a tool just touched, so a client can re-read its
 * full current state - or subscribe to it - instead of relying on the point-in-time copy in
 * the result. Returns an array so call sites can spread it: there is nothing worth linking
 * to when the response carried no identifier, and a link to an unreadable URI is worse than
 * no link.
 */
export function recordLinks(
  recordType: LinkableRecordType,
  record: Record<string, unknown>,
  fallbackId?: string
) {
  const id = identifier(record.reference_num) ?? identifier(record.id) ?? fallbackId;
  if (!id) return [];

  return [
    {
      type: "resource_link" as const,
      uri: `aha://${recordType}/${id}`,
      name: identifier(record.name) ?? `${recordType} ${id}`,
      description: `The ${recordType} this call touched. Read it for the record's current full state.`,
      mimeType: "application/json"
    }
  ];
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

export const featureOutputSchema = z.looseObject({
  ...recordIdentity,
  progress: progressField,
  score: scoreField
});

export const epicOutputSchema = z.looseObject({
  ...recordIdentity,
  progress: progressField
});

export const initiativeOutputSchema = z.looseObject({
  ...recordIdentity,
  progress: progressField
});

export const ideaOutputSchema = z.looseObject({
  ...recordIdentity,
  score: scoreField
});

export const competitorOutputSchema = z.looseObject({
  ...recordIdentity
});

export const commentOutputSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional().describe("Comment id"),
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
    .enum(["feature", "epic", "idea", "competitor"])
    .describe("Type of record that was deleted"),
  id: z.string().describe("Id or reference number the deletion was requested for")
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
