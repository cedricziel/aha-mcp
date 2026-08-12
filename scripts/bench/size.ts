#!/usr/bin/env bun
/**
 * The deterministic half of the benchmark: how much smaller is each rendering, in bytes and
 * in tokens, than today's `JSON.stringify(records, null, 2)`.
 *
 * This script makes no model calls unless ANTHROPIC_API_KEY is set. That is a deliberate
 * property, not an accident - byte and character counts are exact and free, so the "does the
 * smaller rendering actually save tokens" question should not require spending any to answer.
 * When a key *is* set, tokens are counted exactly via Anthropic's count_tokens endpoint
 * (POST /v1/messages/count_tokens - see shared token-counting docs); that call counts, it does
 * not generate, so it is billed at a few tokens per request rather than a full completion.
 *
 * `table` only exists for ideas/releases/goals - the feature and epic LIST endpoints return
 * only identity fields (id, name, reference_num, created_at, product_id, url, resource), so
 * there is nothing to tabulate beyond Ref/Name. For those two types this script reports json
 * vs links only; see renderers.ts for the full reasoning.
 *
 * Usage:
 *   bun run bench:size                                     # mock fallback, char/4 approximation
 *   BENCH_FIXTURE=./my-ideas.json bun run bench:size
 *   ANTHROPIC_API_KEY=... bun run bench:size                # exact token counts
 *   BENCH_TOKEN_MODEL=claude-sonnet-5 bun run bench:size    # count against a different model
 */

import { loadFixture } from "./fixtures.js";
import { renderJson, renderLinks, renderTable, tableSupported } from "./renderers.js";

const COUNT_TOKENS_URL = "https://api.anthropic.com/v1/messages/count_tokens";
const DEFAULT_TOKEN_MODEL = "claude-opus-5";

/**
 * Exact token count via the Messages API's count_tokens endpoint. This is a counting call,
 * not a completion - Claude never generates anything, the API just runs its tokenizer over
 * the supplied `messages` and reports `input_tokens`.
 */
async function countTokensExact(text: string, model: string, apiKey: string): Promise<number> {
  const res = await fetch(COUNT_TOKENS_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: text }]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`count_tokens HTTP ${res.status} for model "${model}": ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { input_tokens?: number };
  if (typeof json.input_tokens !== "number") {
    throw new Error(`count_tokens response had no numeric input_tokens: ${JSON.stringify(json)}`);
  }
  return json.input_tokens;
}

/**
 * The fallback used with no API key: characters / 4, clearly labelled everywhere it surfaces
 * so nobody mistakes it for a real count. This is a coarse rule of thumb for English prose and
 * is worse than that for JSON (lots of short, repeated punctuation tokens) - it is here only
 * so the harness has something to report with zero setup and zero network calls.
 */
function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

interface Measurement {
  name: string;
  bytes: number;
  tokens: number;
}

function percentOf(value: number, baseline: number): string {
  if (baseline === 0) return "n/a";
  return `${((value / baseline) * 100).toFixed(1)}%`;
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function padLeft(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value;
}

async function main() {
  const { records, source, type, path } = await loadFixture();

  console.log(
    `Fixture: ${records.length} ${type} record(s) from ${
      source === "file" ? `file (${path})` : "MockAhaService fallback"
    }`
  );

  const renderings: Record<string, string> = {
    json: renderJson(records),
    links: renderLinks(records)
  };
  if (tableSupported(type)) {
    renderings.table = renderTable(type, records);
  } else {
    console.log(
      `Note: "${type}" has no table variant - its list endpoint returns only identity fields ` +
        "(see renderers.ts). Comparing json vs links only."
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.BENCH_TOKEN_MODEL || DEFAULT_TOKEN_MODEL;
  const useExactTokens = Boolean(apiKey);

  console.log(
    useExactTokens
      ? `Token counts: exact, via POST /v1/messages/count_tokens (model: ${model})`
      : "Token counts: APPROXIMATE (characters / 4) - set ANTHROPIC_API_KEY for exact counts"
  );
  console.log("");

  const measurements: Measurement[] = [];
  for (const [name, text] of Object.entries(renderings)) {
    const bytes = Buffer.byteLength(text, "utf8");
    const tokens =
      useExactTokens && apiKey
        ? await countTokensExact(text, model, apiKey)
        : approximateTokens(text);
    measurements.push({ name, bytes, tokens });
  }

  const baseline = measurements.find((m) => m.name === "json")!;

  const nameW = 8;
  const bytesW = 10;
  const pctW = 10;
  const tokensW = 10;

  const header =
    padRight("Rendering", nameW) +
    padLeft("Bytes", bytesW) +
    padLeft("% json", pctW) +
    padLeft("Tokens", tokensW) +
    padLeft("% json", pctW);
  console.log(header);
  console.log("-".repeat(header.length));

  for (const m of measurements) {
    console.log(
      padRight(m.name, nameW) +
        padLeft(String(m.bytes), bytesW) +
        padLeft(percentOf(m.bytes, baseline.bytes), pctW) +
        padLeft(String(m.tokens), tokensW) +
        padLeft(percentOf(m.tokens, baseline.tokens), pctW)
    );
  }

  console.log("");
  console.log(
    "Baseline is `json` - today's `JSON.stringify(records, null, 2)`. Lower % is smaller."
  );
  if (!useExactTokens) {
    console.log(
      "Token counts above are the chars/4 approximation, not the real tokenizer - treat the " +
        "relative percentages as indicative, not the absolute counts."
    );
  }
}

main().catch((error) => {
  console.error("bench:size failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
