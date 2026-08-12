/**
 * The renderings under comparison, all taking the same bare record array from fixtures.ts and
 * producing the `text` a resource read would return.
 *
 * `json` is today's behaviour verbatim - `JSON.stringify(records, null, 2)` - the baseline
 * everything else is measured against. `links` reuses `renderCollection` from
 * src/core/resource-output.ts, the markdown-link-list renderer that already ships for other
 * collection resources, so the harness measures the real candidate rather than a lookalike.
 *
 * `table` is new, and its columns are NOT the same for every record type. This started as one
 * fixed Ref/Name/Status/Assignee/Due/Progress table, but that assumed fields the feature and
 * epic LIST endpoints simply do not return: `GET .../features` and `GET .../epics` come back
 * with only `id, name, reference_num, created_at, product_id, url, resource` - no status, no
 * assignee, no due date, no progress. Filling those columns would mean a detail fetch per
 * record, which defeats the point of comparing renderings of the SAME list response. So:
 *
 *   - features / epics: no table variant. `tableSupported()` returns false; `renderTable()`
 *     throws if called anyway. Compare `json` vs `links` only for these two types.
 *   - ideas: Ref | Name | Status | Created
 *   - releases: Ref | Name | Start | Release | Owner | ParkingLot
 *   - goals: Ref | Name | Progress | TimeFrame | Features | Initiatives | KeyResults
 *
 * Every column set above was checked against a real list response for that type before being
 * written (see the fixture files under ~/.cache/aha-mcp-bench/, which are not part of this
 * repo) - none of it is guessed from the REST docs, which do not document list-response field
 * subsets at all.
 */

import { renderCollection } from "../../src/core/resource-output.js";
import type { RecordType } from "./fixtures.js";

/** Today's behaviour: the full record array, pretty-printed. The baseline. */
export function renderJson(records: unknown[]): string {
  return JSON.stringify(records, null, 2);
}

/** The existing markdown link-list renderer, unmodified - see resource-output.ts. */
export function renderLinks(records: unknown[]): string {
  return renderCollection(records, {
    title: "Records",
    emptyMessage: "No matching records."
  });
}

/** True for the three types whose list response carries enough fields to fill a table. */
export function tableSupported(type: RecordType): boolean {
  return type === "ideas" || type === "releases" || type === "goals";
}

// --- shared cell helpers -----------------------------------------------------------------

const MISSING = "-";

/** A safe string for a table cell, or undefined when there is nothing to show. */
function cell(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return undefined;
}

/**
 * Pull a nested field's name-like value - e.g. `record.workflow_status.name` - guarding every
 * step because Aha payloads are `unknown` here for the same reason they are everywhere else in
 * this server (src/core/resource-output.ts, src/core/tool-output.ts): they are whatever the
 * REST API sent back, described by nothing this script controls.
 */
function nestedName(record: Record<string, unknown>, key: string): string | undefined {
  const nested = record[key];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return undefined;
  return cell((nested as Record<string, unknown>).name);
}

/** The length of an array-valued field, or undefined when the field is missing or not an array. */
function arrayLength(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return Array.isArray(value) ? value.length : undefined;
}

/** Markdown-table-safe text: collapse newlines and escape the one character that breaks rows. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n+/g, " ");
}

/** The Ref cell: linked to `record.url` (the web page) when present, never `record.resource` -
 * that field is a REST API endpoint, not a page, and neither this file nor resource-output.ts
 * ever treats it as a link target. */
function refCell(record: Record<string, unknown>): string {
  const ref = cell(record.reference_num) ?? MISSING;
  const url = cell(record.url);
  return url ? `[${ref}](${url})` : ref;
}

function table(header: string[], rows: string[][]): string {
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`
  ];
  for (const row of rows) {
    lines.push(`| ${row.map(escapeCell).join(" | ")} |`);
  }
  if (rows.length === 0) {
    lines.push(`| ${header.map((_, i) => (i === 0 ? "_no records_" : "")).join(" | ")} |`);
  }
  return lines.join("\n");
}

function eachRecord(records: unknown[]): Record<string, unknown>[] {
  return records.filter(
    (raw): raw is Record<string, unknown> =>
      Boolean(raw) && typeof raw === "object" && !Array.isArray(raw)
  );
}

// --- per-type table renderers --------------------------------------------------------------

/** Ref | Name | Status | Created - the fields `GET .../ideas` actually returns. */
function renderIdeasTable(records: unknown[]): string {
  const rows = eachRecord(records).map((r) => [
    refCell(r),
    cell(r.name) ?? MISSING,
    nestedName(r, "workflow_status") ?? MISSING,
    cell(r.created_at) ?? MISSING
  ]);
  return table(["Ref", "Name", "Status", "Created"], rows);
}

/** Ref | Name | Start | Release | Owner | ParkingLot - the fields `GET .../releases` returns. */
function renderReleasesTable(records: unknown[]): string {
  const rows = eachRecord(records).map((r) => [
    refCell(r),
    cell(r.name) ?? MISSING,
    cell(r.start_date) ?? MISSING,
    cell(r.release_date) ?? MISSING,
    nestedName(r, "owner") ?? MISSING,
    cell(r.parking_lot) ?? MISSING
  ]);
  return table(["Ref", "Name", "Start", "Release", "Owner", "ParkingLot"], rows);
}

/**
 * Ref | Name | Progress | TimeFrame | Features | Initiatives | KeyResults - the fields
 * `GET .../goals` returns. Features/Initiatives/KeyResults are counts, not lists - the full
 * nested objects belong in the JSON rendering, not a table cell.
 */
function renderGoalsTable(records: unknown[]): string {
  const rows = eachRecord(records).map((r) => {
    const progress = typeof r.progress === "number" ? `${r.progress}%` : MISSING;
    const timeFrame = nestedName(r, "time_frame") ?? cell(r.time_frame) ?? MISSING;
    const featureCount = arrayLength(r, "features");
    const initiativeCount = arrayLength(r, "initiatives");
    const keyResultCount = arrayLength(r, "key_results");
    return [
      refCell(r),
      cell(r.name) ?? MISSING,
      progress,
      timeFrame,
      featureCount === undefined ? MISSING : String(featureCount),
      initiativeCount === undefined ? MISSING : String(initiativeCount),
      keyResultCount === undefined ? MISSING : String(keyResultCount)
    ];
  });
  return table(["Ref", "Name", "Progress", "TimeFrame", "Features", "Initiatives", "KeyResults"], rows);
}

/**
 * Render a markdown table for `records`, using the column set appropriate to `type`. Throws
 * for features/epics rather than emitting a table with mostly `-` cells - see the module
 * comment for why those two types have no table variant at all.
 */
export function renderTable(type: RecordType, records: unknown[]): string {
  switch (type) {
    case "ideas":
      return renderIdeasTable(records);
    case "releases":
      return renderReleasesTable(records);
    case "goals":
      return renderGoalsTable(records);
    case "features":
    case "epics":
      throw new Error(
        `No table rendering for "${type}" records: the list endpoint returns only identity ` +
          "fields (id, name, reference_num, created_at, url, resource) - there is nothing " +
          "besides Ref/Name to put in a table. Compare json vs links for this type instead."
      );
  }
}
