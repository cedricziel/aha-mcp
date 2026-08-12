/**
 * Loads the collection fixture the rest of scripts/bench/ measures against.
 *
 * "Collection fixture" means an array of Aha records shaped exactly as the REST API returns
 * them - e.g. the `features` array out of `GET /api/v1/products/{id}/features` - not the
 * `{ features: [...], pagination: {...} }` envelope Aha wraps it in. Every renderer in
 * renderers.ts, and the questions generator, take that bare array plus a `type` naming which
 * record kind it is (features/epics/ideas/releases/goals), because the table renderer's
 * columns differ per type - see renderers.ts for why.
 *
 * Two sources, in priority order:
 *
 *   1. `BENCH_FIXTURE` - a path to a JSON file. This is how you point the harness at a real
 *      export pulled from a live account, which is what the size and question numbers are
 *      actually meant to answer questions about. The file is expected in the shape Aha's REST
 *      list endpoints actually return: `{ features: [...], pagination: {...} }`,
 *      `{ ideas: [...], pagination: {...} }`, and so on for epics/releases/goals. The `type`
 *      is inferred from which of those keys holds an array - not from the filename - so
 *      `ideas-raw.json` and `my-export.json` both work as long as the top-level key is
 *      right. A bare JSON array (no envelope) is still accepted for backward compatibility and
 *      treated as `features`, since that was this script's only supported shape originally.
 *      A path that does not exist fails loudly, naming the path - it never falls through to
 *      the mock, because a caller who set `BENCH_FIXTURE` explicitly wants that file's numbers,
 *      and silently substituting the mock's would be misleading in a way a plain error is not.
 *   2. `MockAhaService` (src/core/services/aha-service.mock.ts) - the same fake service the
 *      unit tests use. This is the zero-setup fallback when `BENCH_FIXTURE` is unset; it only
 *      knows how to fabricate features, so this path always reports type "features". There used
 *      to be a middle tier here - a committed, scrambled real fixture - but the scrambling this
 *      harness could do (see scramble.ts) turned out not to be safe to publish: a constant
 *      per-fixture date offset makes every timestamp exactly recoverable, and value-derived
 *      seeding makes the transform a confirmation oracle for a guessed name. So: no fixture data
 *      ships in this repo at all. Anyone who wants realistic numbers captures their own.
 *
 * The mock fallback is a safety net, not a representative sample. `generateMockFeature` in
 * aha-service.mock.ts hardcodes a one-line `description.body` ("Description for test feature
 * N"); real Aha features carry full HTML bodies from the rich text editor, often several
 * paragraphs. Every byte and token number this harness produces from the mock fallback
 * therefore *understates* what JSON actually costs in production - the gap between JSON and
 * the markdown alternatives can only be larger on real data, never smaller. `listFeatures`
 * also caps out at 3 records regardless of the page size requested, so index/filter questions
 * ("how many", "which ones") are close to trivial on the fallback. Treat any number that comes
 * out of the fallback as a floor, not an estimate - pass a real `BENCH_FIXTURE` before trusting
 * the comparison for anything that matters.
 */

import { existsSync, readFileSync } from "fs";

/**
 * The five record kinds this harness knows how to unwrap and (for three of them) tabulate.
 * Matches the top-level key Aha's REST list endpoints wrap their array in.
 */
export type RecordType = "features" | "epics" | "ideas" | "releases" | "goals";

export const KNOWN_TYPES: readonly RecordType[] = ["features", "epics", "ideas", "releases", "goals"];

export interface FixtureResult {
  /** The bare array of Aha records, exactly as the API (or the mock) returned them. */
  records: Record<string, unknown>[];
  /** Which of the five kinds this collection is - drives which table columns apply. */
  type: RecordType;
  /** Where the fixture came from - lets callers decide whether to trust the numbers. */
  source: "file" | "mock";
  /** The file path, when source is "file" - useful for labelling output. */
  path?: string;
  /** Set only when `source` is "mock" - the loud warning callers should also print. */
  warning?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const MOCK_FALLBACK_WARNING =
  "\n" +
  "=".repeat(78) +
  "\n" +
  "WARNING: BENCH_FIXTURE is not set. Falling back to MockAhaService.\n" +
  "\n" +
  "The mock's feature descriptions are one line each (\"Description for test\n" +
  "feature N\"). Real Aha features carry full HTML bodies from the rich text\n" +
  "editor, frequently several paragraphs. Every size number this run produces\n" +
  "understates the real JSON cost - treat it as a floor, not an estimate. The\n" +
  "mock also only fabricates features, and caps out at 3 records regardless of\n" +
  "page size, so filter/table questions are close to trivial on this fixture.\n" +
  "\n" +
  "Point BENCH_FIXTURE at a JSON file (the raw response body from one of Aha's\n" +
  "list endpoints: GET .../features, .../epics, .../ideas, .../releases, or\n" +
  ".../goals) for numbers worth trusting. This harness ships with no fixture\n" +
  "data of its own - see README.md for how to capture one.\n" +
  "=".repeat(78);

/**
 * Pull the record array and its type out of a parsed fixture file. Aha's list endpoints wrap
 * the array under a key matching the type - `{ ideas: [...], pagination: {...} }` - so the
 * type is inferred from *which* key holds an array, not from the filename or any hint we pass
 * in. A bare array (no envelope) is accepted too, for fixtures built before this harness grew
 * type awareness; it is assumed to be `features` since that was the only shape ever supported.
 */
function unwrapFixtureBody(parsed: unknown, path: string): { records: unknown[]; type: RecordType } {
  if (Array.isArray(parsed)) {
    return { records: parsed, type: "features" };
  }

  if (isRecord(parsed)) {
    for (const type of KNOWN_TYPES) {
      const candidate = parsed[type];
      if (Array.isArray(candidate)) {
        return { records: candidate, type };
      }
    }
  }

  throw new Error(
    `BENCH_FIXTURE at "${path}" is not a recognizable Aha fixture. Expected either a bare ` +
      `JSON array, or an object with one of ${KNOWN_TYPES.join("/")} as an array-valued key ` +
      "(the raw shape Aha's list endpoints return)."
  );
}

/** Load and unwrap a specific fixture file - the shared logic behind loadFixture(). */
export function loadFixtureFromFile(path: string): FixtureResult {
  if (!existsSync(path)) {
    throw new Error(`Fixture file "${path}" does not exist.`);
  }

  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Fixture file "${path}" is not valid JSON: ${(error as Error).message}`);
  }

  const { records, type } = unwrapFixtureBody(parsed, path);
  return { records: records.filter(isRecord), type, source: "file", path };
}

/** Fabricate a fixture from MockAhaService - see the module comment for its limitations. */
export async function loadMockFixture(): Promise<FixtureResult> {
  // Imported lazily so a caller who always supplies BENCH_FIXTURE never pays for loading the
  // mock service module at all.
  const { MockAhaService } = await import(
    "../../src/core/services/aha-service.mock.js"
  );
  const mock = new MockAhaService();
  // perPage is passed generously, but generateMockFeature/listFeatures caps the result at 3
  // records no matter what is asked for - see the module comment above.
  const response = await mock.listFeatures(undefined, undefined, undefined, undefined, 1, 200);
  const records = (response.features ?? []).filter(isRecord);

  return { records, type: "features", source: "mock", warning: MOCK_FALLBACK_WARNING };
}

/**
 * Load the fixture named by `BENCH_FIXTURE`; failing that, the mock. There is no middle tier
 * any more - see the module comment for why the committed scrambled fixture this used to fall
 * back to was removed. A missing `BENCH_FIXTURE` path fails loudly, naming the path, rather than
 * silently sliding to the mock: a caller who set the env var wants that file's numbers, and a
 * quiet substitution would misreport whose data the run actually measured. Prints the mock
 * warning to stderr (not stdout) so a caller piping stdout to a file - or, for serve.ts, using
 * stdout as the MCP transport - still sees it.
 */
export async function loadFixture(): Promise<FixtureResult> {
  const fixturePath = process.env.BENCH_FIXTURE;
  if (fixturePath) {
    return loadFixtureFromFile(fixturePath);
  }

  console.error(MOCK_FALLBACK_WARNING);
  return loadMockFixture();
}
