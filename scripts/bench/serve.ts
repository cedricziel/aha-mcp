#!/usr/bin/env bun
/**
 * A minimal, standalone MCP server whose only job is to serve the same fixture as
 * differently-rendered resources side by side, plus a per-record drilldown resource. Point an
 * agent at exactly one of `bench://collection/json`, `bench://collection/links`, or (when the
 * loaded fixture's type supports it) `bench://collection/table`, and see whether it can answer
 * the questions in questions.json without reaching for anything else.
 *
 * `bench://collection/table` is only registered when the loaded fixture is a type the table
 * renderer actually supports (ideas, releases, goals) - see renderers.ts for why features and
 * epics have no table variant. Advertising a resource that would immediately throw on read is
 * worse than not listing it at all.
 *
 * This deliberately does not import src/core/resources.ts. That module is mid-edit by another
 * agent in this repo, and more importantly this server has nothing to do with the real Aha
 * resource surface - it exists only to compare renderings of one fixture, so it should not
 * carry any of the real server's registration logic, error mapping, or resource templates
 * along for the ride.
 *
 * Usage:
 *   bun run bench:serve                              # mock fallback fixture
 *   BENCH_FIXTURE=./my-ideas.json bun run bench:serve
 *
 * Talks stdio, like the real server's default transport - point any MCP client at
 * `bun run scripts/bench/serve.ts` and read the resources above.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import { loadFixture } from "./fixtures.js";
import { renderJson, renderLinks, renderTable, tableSupported } from "./renderers.js";

/** First string value out of a ResourceTemplate variable, which can be `string | string[]`. */
function normalizeVar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The identifier a drilldown question would use to name a record: reference_num, else id. */
function recordIdentifier(record: Record<string, unknown>): string | undefined {
  const ref = record.reference_num;
  if (typeof ref === "string" && ref.length > 0) return ref;
  const id = record.id;
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof id === "number") return String(id);
  return undefined;
}

async function main() {
  const { records, source, type } = await loadFixture();
  // stderr, not stdout: stdout is the MCP protocol channel over this transport.
  console.error(`[bench-serve] serving ${records.length} ${type} record(s) from ${source}`);

  const server = new McpServer({
    name: "aha-bench",
    version: "0.0.0",
    description: "Serves one fixture as json/links[/table] renderings, for benchmarking."
  });

  const collectionRenderers: Record<string, { render: (records: unknown[]) => string; mimeType: string }> = {
    json: { render: renderJson, mimeType: "application/json" },
    links: { render: renderLinks, mimeType: "text/markdown" }
  };
  if (tableSupported(type)) {
    collectionRenderers.table = { render: (r) => renderTable(type, r), mimeType: "text/markdown" };
  }

  for (const [variant, { render, mimeType }] of Object.entries(collectionRenderers)) {
    server.registerResource(
      `bench_collection_${variant}`,
      `bench://collection/${variant}`,
      {
        title: `Bench collection (${variant})`,
        description:
          `The fixture's ${records.length} ${type} record(s) rendered as ${variant}. Compare ` +
          "this against the other bench://collection/* resources for the same underlying data.",
        mimeType
      },
      async (uri: URL, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => ({
        contents: [
          {
            uri: uri.toString(),
            text: render(records),
            mimeType
          }
        ]
      })
    );
  }

  server.registerResource(
    "bench_record",
    new ResourceTemplate("bench://record/{ref}", { list: undefined }),
    {
      title: "Bench record (full JSON)",
      description:
        "The full JSON of one fixture record, addressed by reference_num (or id when no " +
        "reference_num is present). Use this to drill down from a json/links/table collection " +
        "rendering that only summarized the record.",
      mimeType: "application/json"
    },
    async (
      uri: URL,
      variables: Variables,
      _extra: RequestHandlerExtra<ServerRequest, ServerNotification>
    ) => {
      const ref = normalizeVar(variables.ref) ?? uri.pathname.split("/").pop();
      if (!ref) {
        throw new Error("bench://record/{ref} requires a ref path segment.");
      }

      const record = records.find((r) => recordIdentifier(r) === ref);

      if (!record) {
        throw new Error(
          `No fixture record with reference_num or id "${ref}". ` +
            `Known identifiers: ${records
              .map(recordIdentifier)
              .filter((id): id is string => Boolean(id))
              .join(", ") || "(none)"}`
        );
      }

      return {
        contents: [
          {
            uri: uri.toString(),
            text: JSON.stringify(record, null, 2),
            mimeType: "application/json"
          }
        ]
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[bench-serve] ready on stdio");
}

main().catch((error) => {
  console.error("[bench-serve] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
