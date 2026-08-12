#!/usr/bin/env bun
/**
 * DO NOT COMMIT OR SHARE THIS SCRIPT'S OUTPUT. Read this whole comment before trusting it.
 *
 * This transform is unkeyed and fully deterministic: every scrambled value is a pure function
 * of the real value it replaces, with no secret and no randomness involved anywhere. That
 * combination is exactly what makes it unsafe to publish, in three independent ways:
 *
 *   - Dates are exactly recoverable. Every timestamp in a fixture is shifted by the same
 *     constant `OFFSET_MS` (433 days, hardcoded below and visible to anyone reading this file).
 *     Given a scrambled timestamp and this source file, recovering the real one is subtraction,
 *     not cryptanalysis.
 *   - It is a confirmation oracle for guessed strings. Because the scramble of a value depends
 *     only on that value (see `genericScramble`/`scramblePrefix` - both seed a PRNG from the
 *     input string itself), anyone who suspects a particular name, workspace prefix, or
 *     reference number appears in a fixture can scramble their guess with this same script and
 *     check it against the committed output for a match. No key means no secret to keep the
 *     guesser out.
 *   - Shape leaks regardless of the above. Preserved byte lengths (names, description bodies)
 *     and preserved array cardinalities (a goal's feature count, a fixture's record count) are
 *     the entire point of this script - see below - but they are also real information about
 *     the source account that scrambling never touches.
 *
 * None of this is a bug to fix; it is inherent to a transform designed to keep byte lengths,
 * array cardinality, and timestamp ordering exactly intact (see below for why the benchmark
 * needs that). A transform strong enough to close these holes would also destroy the properties
 * this script exists to preserve. So: run this against your own captures for your own local
 * use, never against a fixture you intend to hand to someone else or commit to a shared repo.
 *
 * With that said, here is what it is actually for: turning a raw Aha fixture (captured from a
 * live account - see the module comment in fixtures.ts) into a copy with every name, reference
 * number, id, and URL replaced, for the rare case where you want to hand a capture to someone
 * else without sending them your real data and are prepared to accept the limitations above.
 *
 * The benchmark this harness supports measures rendering SIZE and rendering CORRECTNESS
 * (can a model answer a question from a smaller rendering). Neither depends on the actual
 * content of a name or a reference number - only on:
 *
 *   - the exact set of fields present (and which are null/absent),
 *   - the byte length of "name" and description "body" strings (that IS the thing under
 *     test - a shorter or longer scrambled string would change the very numbers bench:size
 *     reports),
 *   - the relative order of every timestamp (filter questions like "created before X" have
 *     ground truth computed by sorting created_at, and that ground truth must still be true
 *     of the scrambled data),
 *   - array cardinality (a goal with 7 features must still have 7 features),
 *   - the *shape* of identifiers (a reference_num keeps its prefix-type-number structure; an
 *     id keeps looking like a numeric id).
 *
 * Nothing else about a real record needs to survive, and nothing else may: names, reference
 * prefixes, emails, and URLs in these fixtures came out of a real customer account.
 *
 * ## Determinism
 *
 * Every transform below is a pure function of the *value* being scrambled (never of its
 * position in the document, never of Math.random()). Two occurrences of the same real id, the
 * same real reference prefix, or the same real href in different parts of the same fixture -
 * or in different fixtures entirely - scramble to the same output. That is what lets a nested
 * `goal.features[].reference_num` and the corresponding top-level `features[].reference_num`
 * stay consistent without this script needing to track cross-references, and it is what makes
 * a re-run produce byte-identical output.
 *
 * ## Dates: one offset for the whole fixture, not per-record jitter
 *
 * This is the subtlest requirement here. `generate-questions.ts` computes ground truth like
 * "which records were created before <the median created_at>" straight from the fixture it is
 * pointed at - it does not know or care whether that fixture is real or scrambled. If every
 * timestamp in a fixture is shifted by the *same* constant number of milliseconds, every
 * ordering relationship between them (before/after, earlier/later, the median split) survives
 * exactly, because adding a constant is monotonic. If instead each timestamp were jittered
 * independently (even deterministically per-value), records that were created seconds apart in
 * the real account could end up reordered relative to each other, silently changing which
 * records fall on which side of a "before X" question - the ground truth would still be
 * internally consistent (it is recomputed from the scrambled data after all), but the
 * *character* of the dataset the questions describe would no longer resemble the real one
 * meaningfully. A single global offset avoids that risk entirely and is simpler besides.
 *
 * ## Usage
 *
 *   bun run scripts/bench/scramble.ts <input.json> <output.json>
 *   bun run bench:scramble    # scrambles all five known types from the default cache paths
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { KNOWN_TYPES, type RecordType } from "./fixtures.js";

// --- deterministic PRNG plumbing --------------------------------------------------------

/**
 * FNV-1a over a string, folded into a 32-bit unsigned seed. Used only to seed the PRNG below,
 * not for anything cryptographic - this only needs to be stable and fast, not collision-proof
 * against an adversary. There is no adversary here, only a customer's product names.
 */
function seedFromString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 - a tiny, fast, deterministic PRNG. Good enough to pick filler characters. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The one workhorse transform: replace every letter with another letter, every digit with
 * another digit, and pass everything else (spaces, punctuation, unicode symbols) through
 * unchanged. This is what makes it possible to satisfy "same byte length" and "no real
 * content" at the same time for arbitrary strings - names, titles, ids, email local parts,
 * hex colors, HTML text nodes - without writing a separate filler generator for each field.
 * Deterministic per input value (see the module comment on why that matters), namespaced with
 * a salt so this function and scramblePrefix() below never collide on the same seed space for
 * an input that happens to look the same.
 *
 * The one exception: the leading digit of a multi-digit, all-numeric string is never mapped to
 * "0" - Aha's ids and reference numbers never start with a leading zero, and preserving that
 * looks less like a bug in this script to anyone reading the scrambled output.
 */
function genericScramble(value: string, salt = "scramble"): string {
  if (value.length === 0) return value;
  const rng = mulberry32(seedFromString(`${salt}:${value}`));
  const isAllDigits = /^\d+$/.test(value);
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (ch >= "A" && ch <= "Z") {
      out += String.fromCharCode(65 + Math.floor(rng() * 26));
    } else if (ch >= "a" && ch <= "z") {
      out += String.fromCharCode(97 + Math.floor(rng() * 26));
    } else if (ch >= "0" && ch <= "9") {
      const min = isAllDigits && i === 0 && value.length > 1 ? 1 : 0;
      out += String(min + Math.floor(rng() * (10 - min)));
    } else {
      out += ch;
    }
  }
  return out;
}

// --- reference numbers and workspace prefixes -------------------------------------------

/**
 * `ACME-E-12`, `WIDGET-G-3`, `ACME-100` - Aha reference numbers are either
 * `<PREFIX>-<NUMBER>` or `<PREFIX>-<TYPE LETTER>-<NUMBER>`, where PREFIX is the workspace's
 * reference prefix (customer-chosen, e.g. the product's short code) and is the only part of
 * this that is actually identifying. The type letter (E/I/R/G/...) and the number are just
 * sequence bookkeeping - keeping them verbatim, and only remapping the prefix, guarantees
 * scrambled reference numbers stay as unique as the real ones were (two different real refs
 * can never collide onto the same scrambled ref, because collision would require both the same
 * prefix mapping *and* the same original number, and the number is untouched).
 */
const TYPED_REF = /^([A-Za-z][A-Za-z0-9]*)-([A-Za-z])-(\d+)$/;
const PLAIN_REF = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/;

/**
 * A bare workspace prefix (e.g. a two-to-ten letter code chosen by the customer when they set
 * up their Aha workspace) maps to a same-length synthetic all-caps code - e.g. a 7-letter
 * prefix becomes another 7-letter prefix. Deterministic per input, like everything else here,
 * so the same real prefix always lands on the same synthetic one - in `reference_num`, in a URL
 * path segment, and in `project.reference_prefix` - without this script needing to remember
 * which prefixes it has already seen. Namespaced ("prefix:") so this never lands on the same
 * PRNG stream as genericScramble() being asked to scramble the same literal string for some
 * unrelated field.
 *
 * Length is preserved deliberately, unlike the rest of a reference_num's transform (which keeps
 * the type letter and number verbatim and does not care how long the synthetic prefix is): the
 * prefix appears twice more per record beyond the `reference_num` field itself - once in `url`,
 * once in `resource` - so a shorter-or-longer replacement multiplies across every record in a
 * fixture and moves bench:size's byte counts by more than the single-field view suggests.
 * Keeping the length exact is what keeps a scrambled fixture's byte count close to the real
 * one it was built from, which is the property bench:size exists to measure honestly.
 */
function scramblePrefix(prefix: string): string {
  const rng = mulberry32(seedFromString(`prefix:${prefix}`));
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < prefix.length; i++) out += letters[Math.floor(rng() * 26)];
  return out;
}

function scrambleReferenceNum(ref: string): string {
  const typed = TYPED_REF.exec(ref);
  if (typed) {
    const [, prefix, letter, number] = typed;
    return `${scramblePrefix(prefix!)}-${letter}-${number}`;
  }
  const plain = PLAIN_REF.exec(ref);
  if (plain) {
    const [, prefix, number] = plain;
    return `${scramblePrefix(prefix!)}-${number}`;
  }
  // Not a shape this script recognises - still destroy it, just without the nice prefix
  // consistency. Every reference_num actually seen in the captures this was built against
  // matches one of the two patterns above.
  return genericScramble(ref, "ref-fallback");
}

// --- dates: one global offset, applied to every timestamp shape found --------------------

/**
 * A fixed, arbitrary shift applied to every timestamp in every fixture. Not derived from the
 * data - it is the same 433 days for every run, which is what makes it "one constant offset"
 * rather than a per-fixture computed one, and is exactly why it is safe: shifting every instant
 * on a timeline by the same amount can never change which of two instants comes first. See the
 * module comment for why that property (not the specific number of days) is what matters.
 */
const OFFSET_MS = 433 * 24 * 60 * 60 * 1000;

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.(\d+))?Z$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/**
 * Shift an ISO-8601 datetime or a bare date (`start_date`/`release_date` use the latter) by
 * OFFSET_MS. The millisecond digits (when present) are carried over verbatim rather than
 * shifted themselves - they are sub-second noise relative to a 433-day offset, and reusing them
 * keeps the output exactly the same length as the input with zero extra work.
 */
function shiftDate(value: string): string {
  const dt = ISO_DATETIME.exec(value);
  if (dt) {
    const ms = dt[8];
    const shifted = new Date(Date.parse(value) + OFFSET_MS);
    const base =
      `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
      `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
    return ms !== undefined ? `${base}.${ms}Z` : `${base}Z`;
  }
  const d = ISO_DATE.exec(value);
  if (d) {
    const shifted = new Date(Date.parse(`${value}T00:00:00Z`) + OFFSET_MS);
    return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  }
  return value;
}

function looksLikeDate(value: string): boolean {
  return ISO_DATETIME.test(value) || ISO_DATE.test(value);
}

// --- emails --------------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Every real email domain seen in these fixtures happens to be the same length as
 * "example.com" (11 characters), which is a coincidence worth relying on here: hardcoding
 * "example.com" as the replacement domain keeps email byte length unchanged for the actual
 * data this script runs against, with no general-purpose length-matching logic needed.
 */
function scrambleEmail(value: string): string {
  const at = value.indexOf("@");
  const local = value.slice(0, at);
  return `${genericScramble(local, "email-local")}@example.com`;
}

// --- URLs ------------------------------------------------------------------------------

/**
 * Path segments that are part of Aha's REST route shape, not customer data - leaving them
 * alone is what "keeping the path shape" means. Everything else in a path (workspace prefixes,
 * reference numbers, numeric ids) is customer-specific and gets scrambled.
 */
const STATIC_PATH_SEGMENTS = new Set([
  "api",
  "v1",
  "features",
  "epics",
  "ideas",
  "releases",
  "goals",
  "strategic_imperatives",
  "projects",
  "milestone"
]);

/** All-caps, letters-and-digits-only path segment - the shape of a bare workspace prefix. */
const BARE_PREFIX_SEGMENT = /^[A-Z][A-Z0-9]*$/;

/**
 * Every record's `url`/`resource` points at `<workspace-subdomain>.aha.io`, which names the
 * customer's Aha account - the one piece of a URL that is genuinely identifying, since the
 * route words and record path are the same for every Aha customer. Aha's own domain ("aha.io")
 * is not customer data, so it is kept literally (it also doubles as a visible marker that this
 * is a placeholder, not a leaked real host). The subdomain is replaced character-for-character
 * like any other name field, which - unlike a fixed literal such as "example" - preserves the
 * host's exact length regardless of how long the real customer subdomain was. A non-Aha host
 * (integration_fields values carry raw GitHub/Slack URLs) has no such suffix to preserve and is
 * scrambled in full.
 */
function scrambleHost(hostname: string): string {
  const AHA_SUFFIX = ".aha.io";
  if (hostname.endsWith(AHA_SUFFIX)) {
    const subdomain = hostname.slice(0, -AHA_SUFFIX.length);
    return `${genericScramble(subdomain, "host-subdomain")}${AHA_SUFFIX}`;
  }
  return genericScramble(hostname, "host");
}

/**
 * Rewrites a URL to `https://<scrambled>.aha.io/...` (or a fully scrambled host for a non-Aha
 * URL), preserving the path's shape: static route words stay put, reference-number-shaped and
 * bare-prefix-shaped segments go through the same scramblers as the `reference_num`/
 * `reference_prefix` fields (so a URL's trailing segment and its sibling `reference_num` field
 * always agree), and anything left over (numeric ids, opaque tokens) is generically scrambled
 * so nothing real survives. The host and every path segment are transformed length-preserving,
 * so the whole URL comes out the same number of bytes it went in - which matters here more than
 * for most fields, since every record carries at least two of these (`url` and `resource`).
 *
 * Used for every `url`/`resource` field in a record, and for any string anywhere else in the
 * document that happens to start with `http(s)://` (integration_fields values, for one, carry
 * raw GitHub URLs that are just as real as the Aha ones).
 */
function scrambleUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Not a parseable absolute URL after all (a relative path, most likely) - still real
    // content, still needs to go.
    return genericScramble(raw, "url-fallback");
  }

  const host = scrambleHost(url.hostname);

  const segments = url.pathname.split("/").map((segment) => {
    if (segment.length === 0) return segment;
    if (TYPED_REF.test(segment) || PLAIN_REF.test(segment)) return scrambleReferenceNum(segment);
    if (BARE_PREFIX_SEGMENT.test(segment)) return scramblePrefix(segment);
    if (STATIC_PATH_SEGMENTS.has(segment)) return segment;
    return genericScramble(segment, "url-segment");
  });

  const search = url.search.length > 1 ? `?${genericScramble(url.search.slice(1), "url-query")}` : "";
  const hash = url.hash.length > 1 ? `#${genericScramble(url.hash.slice(1), "url-hash")}` : "";

  return `https://${host}${segments.join("/")}${search}${hash}`;
}

// --- rich-text bodies: keep the tags, scramble everything a person would read -------------

/**
 * Rich text bodies (`description.body`) are the one place real URLs, `@mentions`, and prose
 * show up interleaved with markup in the same string. "Keep the tags, replace the prose" means:
 * split the string on tag boundaries, leave every tag's name and non-URL attributes exactly as
 * they were (so the HTML is still the same shape, tag-for-tag, byte-for-byte outside the parts
 * we touch), scramble URL-bearing attribute values (href/src/data-mce-href - a real customer
 * Slack link and a signed GitHub image URL both showed up here in testing), and run every text
 * node between tags through genericScramble(). Because every part is length-preserving in
 * place, the whole body comes out exactly as long as it went in.
 */
const URL_ATTR = /((?:href|src|data-mce-href)\s*=\s*)(["'])([^"']*)\2/gi;

function scrambleTag(tag: string): string {
  return tag.replace(URL_ATTR, (_match, attrPrefix, quote, value) => {
    return `${attrPrefix}${quote}${genericScramble(value, "html-attr")}${quote}`;
  });
}

function scrambleHtmlBody(value: string): string {
  return value
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith("<") ? scrambleTag(part) : genericScramble(part, "html-text")))
    .join("");
}

// --- putting it together: walk the whole fixture tree -------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Decide how to scramble one string leaf. Order matters: reference_num/reference_prefix are
 * decided by key name (their value shape alone isn't reliably distinguishable from other
 * dash-separated strings), everything else is decided by the *shape of the value*, which is
 * what lets the same detection work regardless of which key it is nested under (a URL is a URL
 * whether it is `record.url` or `integration_fields[].value`).
 */
function scrambleString(key: string, value: string): string {
  if (value.length === 0) return value;
  if (key === "reference_num") return scrambleReferenceNum(value);
  if (key === "reference_prefix") return scramblePrefix(value);
  if (key === "body") return scrambleHtmlBody(value);
  if (looksLikeDate(value)) return shiftDate(value);
  if (/^https?:\/\//.test(value)) return scrambleUrl(value);
  if (EMAIL_RE.test(value)) return scrambleEmail(value);
  return genericScramble(value);
}

/**
 * Recurse through the fixture, preserving every field, every null/absent distinction, every
 * array's length, and every non-string value (numbers and booleans - progress percentages,
 * `parking_lot` flags, position/effort/value scores - are product-management data, not
 * customer-identifying data, and the filter questions this benchmark asks depend on their real
 * distribution, so they pass through untouched).
 */
function scrambleNode(key: string, value: unknown): unknown {
  if (typeof value === "string") return scrambleString(key, value);
  if (Array.isArray(value)) return value.map((item) => scrambleNode(key, item));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = scrambleNode(childKey, childValue);
    }
    return out;
  }
  return value;
}

export function scrambleFixture(parsed: unknown): unknown {
  return scrambleNode("", parsed);
}

// --- CLI ------------------------------------------------------------------------------------

function defaultRawPath(type: RecordType): string {
  return `${process.env.HOME}/.cache/aha-mcp-bench/${type}-raw.json`;
}

/**
 * scripts/bench/fixtures/ is gitignored - this is scratch output for local use (or for handing
 * a single file to someone else, with the limitations in the module comment accepted), never a
 * location this project commits from.
 */
function defaultScrambledPath(type: RecordType): string {
  return new URL(`./fixtures/${type}.json`, import.meta.url).pathname;
}

function scrambleOne(inputPath: string, outputPath: string): void {
  const raw = readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(raw);
  const scrambled = scrambleFixture(parsed);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(scrambled, null, 2) + "\n");
  console.log(`Scrambled ${inputPath} -> ${outputPath}`);
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;

  if (inputArg) {
    if (!outputArg) {
      throw new Error("Usage: bun run scripts/bench/scramble.ts <input.json> <output.json>");
    }
    scrambleOne(inputArg, outputArg);
    return;
  }

  // No args: batch mode, scrambling every known type from the default cache location this
  // harness was built against (see fixtures.ts / README.md) into scripts/bench/fixtures/ -
  // gitignored scratch output, not something this project commits.
  let scrambledAny = false;
  for (const type of KNOWN_TYPES) {
    const inputPath = defaultRawPath(type);
    if (!existsSync(inputPath)) {
      console.log(`Skipped "${type}": no raw fixture at ${inputPath}.`);
      continue;
    }
    scrambleOne(inputPath, defaultScrambledPath(type));
    scrambledAny = true;
  }

  if (!scrambledAny) {
    console.log(
      "No raw fixtures found under ~/.cache/aha-mcp-bench/ - nothing to scramble. Pass an " +
        "explicit <input.json> <output.json> pair to scramble a fixture from elsewhere."
    );
  }
}

main().catch((error) => {
  console.error("scramble failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
