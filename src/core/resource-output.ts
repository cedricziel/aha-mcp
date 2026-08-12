/**
 * Markdown rendering for the `text` half of a resource read, paired with `resourceAnnotations`
 * for the annotations half.
 *
 * A resource read returns two things: the JSON `contents[].text` a client parses, and - until
 * now - another copy of the same JSON pasted into that same text as an afterthought. That
 * duplicated a record the client was already holding, and cost the conversation a second copy
 * of every field for nothing a person or a model could act on. `renderRecord` and
 * `renderCollection` write the human-facing half instead: a short markdown block naming the
 * record, or a link list naming several - the same job `recordSummary` and the search tool's
 * markdown links do on the tools side (`tool-output.ts`, `search-tools.ts`), just for reads
 * instead of writes.
 *
 * Aha's payloads arrive as `unknown` here for the same reason they do in `tool-output.ts`: they
 * are whatever the REST or GraphQL API sent back, described by nothing this server controls, so
 * every field access is guarded rather than assumed.
 */

function identifier(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

/**
 * Aha timestamps are UTC ISO 8601 (`2024-01-15T10:30:00.000Z`), which is what the SDK's
 * `lastModified` annotation accepts. It is typed as `z.iso.datetime()`, which rejects a numeric
 * offset, so anything that is not plainly Zulu is dropped rather than risking a validation
 * failure on the way out - an omitted annotation costs a hint, a rejected one costs the whole
 * read. This is the same guard `isoTimestamp` applies in `tool-output.ts`; it is not imported
 * from there because that copy is private to its module, and four duplicated lines beat
 * exporting a helper whose only reason to exist would be being shared once.
 */
function isoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) ? value : undefined;
}

/**
 * Annotations for a resource read's content block.
 *
 * `priority` is fixed at 0.8 rather than the 1 a tool's `resource_link` carries: a
 * `resource_link` points at the one record a write just touched, worth a client's full
 * attention, while a resource read is one of however many a client asked for and does not carry
 * that same weight. `lastModified` follows the reasoning `recordLinks` uses in `tool-output.ts`
 * - present only when `updated_at` is plainly Zulu, omitted rather than risking a rejected
 * annotation failing the whole read. `record` is optional because a resource can answer with no
 * body to inspect - a collection listing, say - and the annotations for that read still need to
 * exist; they just carry no freshness hint.
 */
export function resourceAnnotations(record?: Record<string, unknown>): {
  audience: ("user" | "assistant")[];
  priority: number;
  lastModified?: string;
} {
  const lastModified = isoTimestamp(record?.updated_at);
  return {
    audience: ["user", "assistant"],
    priority: 0.8,
    ...(lastModified ? { lastModified } : {})
  };
}

/**
 * A short markdown block for one Aha record: a heading, a link to its page when there is enough
 * to label it properly, then whatever of its identity and status fields are actually present.
 *
 * `record.resource` - the REST endpoint - never substitutes for `record.url` here, and is never
 * read at all. It is an address for a machine to call, not a page for a person to open, and the
 * two are easy to confuse because both are strings that look like URLs.
 */
export function renderRecord(record: Record<string, unknown>, heading: string): string {
  const referenceNum = identifier(record.reference_num);
  const name = identifier(record.name);
  const url = identifier(record.url);

  const lines = [`## ${heading}`];

  // Only worth a link when there is a proper label for it - a bare URL with nothing to call it
  // tells a reader less than the bullet list below does anyway.
  if (url && referenceNum && name) {
    lines.push(`[${referenceNum} - ${name}](${url})`);
  }

  const bullets: string[] = [];
  const bullet = (label: string, value: string | undefined) => {
    if (value !== undefined) bullets.push(`- **${label}:** ${value}`);
  };

  bullet("Reference", referenceNum);
  bullet("Name", name);
  bullet("Workspace", identifier(record.workspace_id));
  const progress = identifier(record.progress);
  bullet("Progress", progress === undefined ? undefined : `${progress}%`);
  bullet("Score", identifier(record.score));
  bullet("Created", identifier(record.created_at));
  bullet("Updated", identifier(record.updated_at));

  if (bullets.length > 0) lines.push(bullets.join("\n"));

  return lines.join("\n\n");
}

/**
 * A markdown link list for several Aha records, in the shape `aha_search` already renders its
 * hits in - `- [REF - Name](url)`, see `renderResults` in `search-tools.ts`. Resources return
 * whole collections rather than search hits, but the reasoning for rendering them as links
 * instead of JSON is the same one: the machine copy already travels in the resource's JSON
 * contents, so this block's job is to say what is there in a form worth reading, not to repeat
 * it.
 *
 * Records arrive as `unknown[]` because they come straight off the wire, so every field access
 * is guarded. A record with neither a name nor a reference number is skipped outright - there
 * is nothing to call it by, and a link list entry with no label is worse than no entry.
 */
export function renderCollection(
  records: unknown[],
  options: { title: string; emptyMessage?: string }
): string {
  const heading = `## ${options.title}`;

  if (records.length === 0) {
    return `${heading}\n\n${options.emptyMessage ?? "No matching records."}`;
  }

  const lines: string[] = [];
  for (const raw of records) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;

    const referenceNum = identifier(record.reference_num);
    const name = identifier(record.name);
    const url = identifier(record.url);

    const label = referenceNum && name ? `${referenceNum} - ${name}` : name ?? referenceNum;
    if (!label) continue;

    lines.push(url ? `- [${label}](${url})` : `- ${label}`);
  }

  const count = `${lines.length} ${lines.length === 1 ? "record" : "records"} listed.`;

  return [heading, ...lines, count].join("\n");
}

/**
 * Resolve a dot path against a record without throwing - `"owner.name"` reads
 * `record.owner.name`, and a missing or non-object intermediate (an absent `owner`, a `null`
 * one) stops the walk and yields `undefined` rather than a `TypeError`. Records here come
 * straight off the wire and are typed as `unknown`, so an optional relation being absent is
 * the normal case, not an error.
 */
function resolvePath(record: Record<string, unknown>, path: string): unknown {
  let current: unknown = record;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Render one table cell. `null`/`undefined` (an absent field, or a missing intermediate object
 * in the dot path that resolved to nothing) becomes `"-"` rather than the word "null" or an
 * empty cell that could be misread as a column-count mismatch. Booleans render as Yes/No
 * because a raw `true`/`false` reads like source code, not a field a person is scanning a table
 * for. A pipe or newline inside a value would otherwise break the row it sits in, since both are
 * structural characters in a markdown table.
 */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") {
    return value.toString().replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  }
  // An object or array reached the end of the dot path - the caller asked for a scalar column,
  // so there is nothing sensible to print rather than dumping `[object Object]`.
  return "-";
}

/**
 * A markdown table for a collection whose records carry real scalar content beyond identity
 * fields - an idea's status, a release's dates - where `renderCollection`'s bare link list would
 * throw that content away. This is the tier-2 rendering the resources.ts tiering policy calls
 * for: `renderCollection` (link list) for slim index collections, this for collections with a
 * handful of columns worth showing, and raw JSON kept for anything with nested relationship
 * arrays that a flat table would flatten away.
 *
 * The first column is always treated as the record's own identifier: its resolved value is
 * linked to `record.url` when present, the same fallback-to-plain-text behaviour
 * `renderCollection` uses when a record has no page to link to. Every other column is a plain
 * cell. Callers choose columns from fields verified against real Aha payloads rather than the
 * full (and permissively typed) domain interfaces in `aha-types.ts` - those interfaces describe
 * every field a record can carry across every endpoint that returns one, not what a specific
 * list endpoint actually populates.
 */
export function renderTable(
  records: unknown[],
  options: {
    title: string;
    columns: { header: string; path: string }[];
    emptyMessage?: string;
  }
): string {
  const heading = `## ${options.title}`;

  if (records.length === 0) {
    return `${heading}\n\n${options.emptyMessage ?? "No matching records."}`;
  }

  const headerRow = `| ${options.columns.map((column) => column.header).join(" | ")} |`;
  const separatorRow = `| ${options.columns.map(() => "---").join(" | ")} |`;

  const rows: string[] = [];
  for (const raw of records) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const url = identifier(record.url);

    const cells = options.columns.map((column, index) => {
      const cell = formatCell(resolvePath(record, column.path));
      return index === 0 && url ? `[${cell}](${url})` : cell;
    });

    rows.push(`| ${cells.join(" | ")} |`);
  }

  const count = `${rows.length} ${rows.length === 1 ? "record" : "records"} listed.`;

  return [heading, "", headerRow, separatorRow, ...rows, "", count].join("\n");
}
