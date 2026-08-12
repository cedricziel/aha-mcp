#!/usr/bin/env bun
/**
 * The agent-loop half of the benchmark, narrowed to the cases the size numbers alone cannot
 * settle: ideas, releases, and goals. Features and epics are excluded on purpose - their list
 * endpoints return only identity fields (see renderers.ts), so there is no table variant to
 * compare and the json-vs-links question is already answered by scripts/bench/size.ts without
 * spending a single model token.
 *
 * For every (type, variant, question) combination this drives the real `claude` CLI headlessly
 * against scripts/bench/serve.ts over MCP, `--mcp-config`-scoped so the model can see nothing
 * but the bench server's resources, and reads back `--output-format stream-json` so both the
 * tool-call trace (to count resource reads) and the final usage/result numbers come out of one
 * invocation. Each combination runs BENCH_AGENT_REPEATS times (default 5) because a single run
 * is noise - model behaviour on an identical prompt varies run to run, especially in how many
 * times it calls ToolSearch before it finds ReadMcpResourceTool.
 *
 * The headline number is UNCACHED INPUT TOKENS, not total tokens and not payload size - see
 * "Why uncached input, not total tokens" below for why total tokens is the wrong headline here.
 *
 * Flag names below were confirmed against `claude --help` on this machine before writing this
 * script:
 *   -p / --print                     non-interactive, required for everything below
 *   --output-format stream-json      per-event trace AND the final usage/result in one format
 *   --mcp-config <file>              point at a throwaway config naming only the bench server
 *   --strict-mcp-config              ignore this machine's own ~/.claude MCP servers entirely
 *   --tools <list>                   restrict the built-in tool set to just resource access,
 *                                     so a run cannot "cheat" by reading a file off disk instead
 *   --permission-mode dontAsk        headless-safe: never blocks on an interactive approval
 *   --model <alias>                  e.g. "sonnet" - see BENCH_AGENT_MODEL below
 *
 * Empirically, the model still spends 2-3 ToolSearch calls finding ReadMcpResourceTool even
 * with --tools narrowed to four names - that overhead is inherent to Claude Code's deferred
 * tool loading in this installation, not something this script controls. It is identical
 * regardless of which resource variant is being read, so it should not bias the json-vs-table
 * comparison, but it does inflate every run's absolute token count above what "just reading a
 * resource" would otherwise cost - keep that in mind when reading the summary table.
 *
 * Why uncached input, not total tokens
 * -------------------------------------
 * Every run shares the exact same system prompt and `--tools` list, so Anthropic's server-side
 * prompt cache (5-minute TTL) serves that fixed prefix as a `cache_read` hit on essentially
 * every run after the first one, regardless of type/variant/question. That is by far the
 * biggest chunk of `total_input_tokens` (tens of thousands of tokens) and it has NOTHING to do
 * with which rendering was read - it is the same bytes every time. The one piece of a run's
 * input that actually differs between `json` and `table` is the tool_result content itself:
 * the rendered collection text, appended fresh to *this* conversation's message history. That
 * content cannot be a `cache_read` (nothing earlier in this brand-new conversation could have
 * written it to cache) - it shows up as `cache_creation_input_tokens` or plain `input_tokens`.
 * So "uncached input" (`input_tokens + cache_creation_input_tokens`, equivalently
 * `total_input_tokens - cache_read_input_tokens`) is the number a real payload-size difference
 * would actually move; `total_input_tokens` mostly reflects how recently *any* bench run
 * happened, not what this run read. Runs are additionally interleaved (json, table, json,
 * table, ...) within each question's repeats so that whichever variant happens to run when the
 * shared-prefix cache is warmer doesn't get a systematic advantage either way.
 *
 * Env vars:
 *   BENCH_AGENT_MODEL          model alias/id passed to --model (default: sonnet - haiku is too
 *                              weak to be representative of real tool-use behaviour, which is
 *                              exactly what this script measures)
 *   BENCH_AGENT_REPEATS        runs per (type, variant, question) combination (default: 5)
 *   BENCH_AGENT_TYPES          comma-separated subset of ideas,releases,goals (default: all three)
 *   BENCH_AGENT_VARIANTS       comma-separated subset of json,table (default: both)
 *   BENCH_AGENT_QUESTION_IDS   comma-separated question ids to run instead of every question in
 *                              questions.json for the selected types
 *   BENCH_AGENT_TIMEOUT_MS     per-attempt kill timeout (default: 120000)
 *   BENCH_AGENT_RESULTS_PATH   where raw per-run results are written, INCREMENTALLY after every
 *                              single run so a killed or crashed sweep never loses progress
 *                              (default: ~/.cache/aha-mcp-bench/results.json - never in the repo)
 *
 * Ground truth is compared against the model's free-text answer with a deliberately simple
 * heuristic (see isGroundTruthMatch below): substring matching for numbers, ref codes, and
 * short strings works well because models tend to reproduce those verbatim, but the
 * drilldown-description questions ask the model to describe prose it will paraphrase rather
 * than quote, so those "correct" flags are the least trustworthy in this report and should be
 * read as "plausible", not "verified".
 *
 * A run that errors (non-zero exit, timeout, or no final `result` event) is retried exactly
 * once. If the retry also fails, it is recorded as a failure row - the sweep keeps going rather
 * than aborting on one bad run.
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { fileURLToPath } from "url";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SERVE_SCRIPT = fileURLToPath(new URL("./serve.ts", import.meta.url));
const QUESTIONS_PATH = fileURLToPath(new URL("./questions.json", import.meta.url));

const CONTESTED_TYPES = ["ideas", "releases", "goals"] as const;
type ContestedType = (typeof CONTESTED_TYPES)[number];
const VARIANTS = ["json", "table"] as const;
type Variant = (typeof VARIANTS)[number];

interface Question {
  id: string;
  category: "index" | "filter" | "drilldown";
  question: string;
  ground_truth: unknown;
}

interface TypeSection {
  fixture_source: string;
  fixture_path?: string;
  record_count: number;
  table_supported: boolean;
  questions: Question[];
}

interface QuestionsFile {
  types: Record<string, TypeSection>;
}

function readEnvList(name: string, fallback: readonly string[]): string[] {
  const raw = process.env[name];
  if (!raw) return [...fallback];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

const MODEL = process.env.BENCH_AGENT_MODEL || "sonnet";
const REPEATS = Math.max(1, Number(process.env.BENCH_AGENT_REPEATS) || 5);
const TIMEOUT_MS = Number(process.env.BENCH_AGENT_TIMEOUT_MS) || 120_000;
const RESULTS_PATH =
  process.env.BENCH_AGENT_RESULTS_PATH || `${homedir()}/.cache/aha-mcp-bench/results.json`;
const SELECTED_TYPES = readEnvList("BENCH_AGENT_TYPES", CONTESTED_TYPES) as ContestedType[];
const SELECTED_VARIANTS = readEnvList("BENCH_AGENT_VARIANTS", VARIANTS) as Variant[];
const SELECTED_QUESTION_IDS = process.env.BENCH_AGENT_QUESTION_IDS
  ? new Set(readEnvList("BENCH_AGENT_QUESTION_IDS", []))
  : undefined;

/**
 * The built-in tools a run is allowed to touch: reading one MCP resource, listing a
 * directory-shaped one, listing what resources exist, and the tool-search mechanism needed to
 * discover any of the above at all under Claude Code's deferred tool loading. Nothing that
 * touches the filesystem or network directly - a run should only be able to answer from what
 * the bench server serves it.
 */
const ALLOWED_TOOLS = "ReadMcpResourceTool,ReadMcpResourceDirTool,ListMcpResourcesTool,ToolSearch";

function loadQuestions(): QuestionsFile {
  if (!existsSync(QUESTIONS_PATH)) {
    throw new Error(`${QUESTIONS_PATH} does not exist - run generate-questions.ts first.`);
  }
  return JSON.parse(readFileSync(QUESTIONS_PATH, "utf8"));
}

/** Every question for the type, unless BENCH_AGENT_QUESTION_IDS narrows the set. */
function selectQuestions(section: TypeSection): Question[] {
  if (SELECTED_QUESTION_IDS) {
    return section.questions.filter((q) => SELECTED_QUESTION_IDS.has(q.id));
  }
  return section.questions;
}

function writeMcpConfig(path: string, fixturePath: string): void {
  const config = {
    mcpServers: {
      bench: {
        command: "bun",
        args: ["run", SERVE_SCRIPT],
        env: { BENCH_FIXTURE: fixturePath }
      }
    }
  };
  writeFileSync(path, JSON.stringify(config, null, 2));
}

function buildPrompt(variant: Variant, question: string): string {
  return [
    'You have access to an MCP server named "bench" exposing one collection of Aha records.',
    `Start by reading the resource bench://collection/${variant}.`,
    "If, and only if, you need a detail that resource does not contain, you may also read " +
      "bench://record/{ref} for one specific record's full JSON.",
    "Do not use any other tool and do not guess - answer only from what you read, and say so " +
      "plainly if the resource does not contain enough to answer.",
    "",
    `Question: ${question}`,
    "",
    "Give a direct, concise answer."
  ].join("\n");
}

/**
 * Deliberately simple: substring matching against the model's free-text answer. This works
 * well for numbers, reference codes, and short names because models reproduce those verbatim;
 * it is much shakier for the drilldown-description questions, where the ground truth is prose
 * the model is expected to paraphrase, not quote. See the module comment for how to read the
 * `correct` flag on those questions.
 */
function isGroundTruthMatch(groundTruth: unknown, resultText: string): boolean {
  if (typeof groundTruth === "number") {
    return resultText.includes(String(groundTruth));
  }
  if (typeof groundTruth === "string") {
    const plain = groundTruth.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (plain.length === 0) return resultText.trim().length === 0;
    // A representative prefix, not the whole string - see the caveat above.
    const probe = plain.length > 60 ? plain.slice(0, 60) : plain;
    return resultText.toLowerCase().includes(probe.toLowerCase());
  }
  if (Array.isArray(groundTruth)) {
    if (groundTruth.length === 0) {
      return /\bnone\b|\bno matching\b|\bzero\b|\b0\b|\bempty\b/i.test(resultText);
    }
    return groundTruth.every((item) => typeof item === "string" && resultText.includes(item));
  }
  return false;
}

interface StreamEvent {
  type: string;
  message?: { content?: Array<Record<string, unknown>> };
  result?: string;
  is_error?: boolean;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  total_cost_usd?: number;
  duration_api_ms?: number;
  duration_ms?: number;
}

interface RunResult {
  type: ContestedType;
  variant: Variant;
  question_id: string;
  category: string;
  run_index: number;
  retried: boolean;
  /** input_tokens + cache_read_input_tokens + cache_creation_input_tokens. Reference only. */
  total_input_tokens: number;
  /** input_tokens + cache_creation_input_tokens - the headline metric. See module comment. */
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  output_tokens: number;
  resource_reads: number;
  wall_time_ms: number;
  duration_api_ms: number;
  cost_usd: number;
  correct: boolean;
  error?: string;
  // Kept in the raw results file (outside the repo) for debugging, never printed to stdout.
  result_text?: string;
}

/** One attempt at a (type, variant, question) run - see runWithRetry for the retry wrapper. */
async function attemptOnce(
  type: ContestedType,
  variant: Variant,
  question: Question,
  runIndex: number,
  mcpConfigPath: string
): Promise<Omit<RunResult, "retried">> {
  const prompt = buildPrompt(variant, question.question);
  const args = [
    "-p",
    prompt,
    "--mcp-config",
    mcpConfigPath,
    "--strict-mcp-config",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "dontAsk",
    "--tools",
    ALLOWED_TOOLS,
    "--model",
    MODEL
  ];

  const start = Date.now();
  const stdout: string[] = [];
  const stderr: string[] = [];

  const exitInfo = await new Promise<{ code: number | null; timedOut: boolean }>((resolve) => {
    const child = spawn("claude", args, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => stdout.push(chunk.toString("utf8")));
    child.stderr.on("data", (chunk) => stderr.push(chunk.toString("utf8")));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut });
    });
  });

  const wallTimeMs = Date.now() - start;
  const base = {
    type,
    variant,
    question_id: question.id,
    category: question.category,
    run_index: runIndex,
    total_input_tokens: 0,
    uncached_input_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    output_tokens: 0,
    resource_reads: 0,
    wall_time_ms: wallTimeMs,
    duration_api_ms: 0,
    cost_usd: 0,
    correct: false
  };

  let resourceReads = 0;
  let finalEvent: StreamEvent | undefined;
  for (const line of stdout.join("").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: StreamEvent;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (event.type === "assistant") {
      for (const block of event.message?.content ?? []) {
        if (block.type === "tool_use" && block.name === "ReadMcpResourceTool") {
          resourceReads += 1;
        }
      }
    }
    if (event.type === "result") {
      finalEvent = event;
    }
  }

  if (exitInfo.timedOut) {
    return { ...base, resource_reads: resourceReads, error: `timed out after ${TIMEOUT_MS}ms` };
  }

  if (!finalEvent) {
    return {
      ...base,
      resource_reads: resourceReads,
      error: `no final "result" event in stdout (exit code ${exitInfo.code}); stderr: ${stderr.join("").slice(0, 500)}`
    };
  }

  const usage = finalEvent.usage ?? {};
  const inputTokens = usage.input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheCreation = usage.cache_creation_input_tokens ?? 0;
  const resultText = finalEvent.result ?? "";

  return {
    ...base,
    total_input_tokens: inputTokens + cacheRead + cacheCreation,
    uncached_input_tokens: inputTokens + cacheCreation,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheCreation,
    output_tokens: usage.output_tokens ?? 0,
    resource_reads: resourceReads,
    duration_api_ms: finalEvent.duration_api_ms ?? 0,
    cost_usd: finalEvent.total_cost_usd ?? 0,
    correct: finalEvent.is_error ? false : isGroundTruthMatch(question.ground_truth, resultText),
    error: finalEvent.is_error ? "claude reported is_error: true" : undefined,
    result_text: resultText
  };
}

/** Retry exactly once on failure, so one flaky run doesn't sink an otherwise-good sweep. */
async function runWithRetry(
  type: ContestedType,
  variant: Variant,
  question: Question,
  runIndex: number,
  mcpConfigPath: string
): Promise<RunResult> {
  const first = await attemptOnce(type, variant, question, runIndex, mcpConfigPath);
  if (!first.error) return { ...first, retried: false };

  console.log(`    retrying after error: ${first.error.slice(0, 150)}`);
  const second = await attemptOnce(type, variant, question, runIndex, mcpConfigPath);
  return { ...second, retried: true };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

/** Build the ordered list of (variant, repIndex) attempts, interleaved to avoid the run-order
 * cache confound described in the module comment: json/table alternate within every repeat
 * round rather than running all of one variant before the other. */
function interleavedRuns(variants: Variant[], repeats: number): Array<{ variant: Variant; rep: number }> {
  const runs: Array<{ variant: Variant; rep: number }> = [];
  for (let rep = 0; rep < repeats; rep++) {
    for (const variant of variants) {
      runs.push({ variant, rep });
    }
  }
  return runs;
}

async function main() {
  console.log(`Model: ${MODEL} | repeats: ${REPEATS} | types: ${SELECTED_TYPES.join(",")}`);

  const questionsFile = loadQuestions();
  mkdirSync(RESULTS_PATH.slice(0, RESULTS_PATH.lastIndexOf("/")), { recursive: true });

  const allResults: RunResult[] = [];
  const persist = () =>
    writeFileSync(
      RESULTS_PATH,
      JSON.stringify(
        { generated_at: new Date().toISOString(), model: MODEL, repeats: REPEATS, results: allResults },
        null,
        2
      )
    );

  let attempted = 0;
  let completed = 0;
  const overallStart = Date.now();

  for (const type of SELECTED_TYPES) {
    const section = questionsFile.types[type];
    if (!section || section.fixture_source === "unavailable" || !section.fixture_path) {
      console.log(`Skipping "${type}": no fixture recorded in questions.json.`);
      continue;
    }

    const configPath = `/tmp/bench-mcp-config-${type}.json`;
    writeMcpConfig(configPath, section.fixture_path);

    const questions = selectQuestions(section);
    const variantsForType = SELECTED_VARIANTS.filter((v) => v !== "table" || section.table_supported);
    if (SELECTED_VARIANTS.includes("table") && !section.table_supported) {
      console.log(`Note: ${type} has no table variant - running json only for this type.`);
    }

    for (const question of questions) {
      const runs = interleavedRuns(variantsForType, REPEATS);
      console.log(
        `Running ${type}/${question.id} (${question.category}) x${runs.length} ` +
          `(variants interleaved: ${variantsForType.join(",")})...`
      );
      for (const { variant, rep } of runs) {
        attempted += 1;
        const result = await runWithRetry(type, variant, question, rep, configPath);
        allResults.push(result);
        persist(); // incremental write - never lose progress if this process is interrupted
        if (result.error) {
          console.log(`  [${variant}] rep ${rep + 1}: FAILED - ${result.error.slice(0, 150)}`);
        } else {
          completed += 1;
          console.log(
            `  [${variant}] rep ${rep + 1}: uncached=${result.uncached_input_tokens} ` +
              `cacheRead=${result.cache_read_input_tokens} out=${result.output_tokens} ` +
              `reads=${result.resource_reads} correct=${result.correct} ` +
              `(${(result.wall_time_ms / 1000).toFixed(1)}s)`
          );
        }
      }
      const elapsedMin = (Date.now() - overallStart) / 60000;
      console.log(`  (elapsed so far: ${elapsedMin.toFixed(1)} min)`);
    }
  }

  console.log(
    `\nCompleted ${completed}/${attempted} attempted runs (retries included in "attempted"). ` +
      `Wrote raw rows to ${RESULTS_PATH} (not part of the repo).`
  );

  // --- PRIMARY summary: grouped by (type, variant) only, as requested ------------------------
  type GroupKey = string;
  const byTypeVariant = new Map<GroupKey, RunResult[]>();
  for (const r of allResults) {
    if (r.error) continue; // failure rows are reported separately below, not folded into medians
    const key = `${r.type} ${r.variant}`;
    const list = byTypeVariant.get(key) ?? [];
    list.push(r);
    byTypeVariant.set(key, list);
  }

  console.log("\n=== Summary by (type, variant) - across every question and repeat ===");
  console.log(
    pad("Type", 10) + pad("Variant", 8) + pad("N", 5) +
      pad("UncachedIn(med/min/max)", 26) + pad("CacheRead(med)", 15) +
      pad("Out(med)", 10) + pad("Reads(med)", 11) + pad("Time(med,s)", 12) + "Correct"
  );
  console.log("-".repeat(120));
  for (const [key, results] of byTypeVariant) {
    const [type, variant] = key.split(" ");
    const uncached = results.map((r) => r.uncached_input_tokens);
    const cacheRead = results.map((r) => r.cache_read_input_tokens);
    const out = results.map((r) => r.output_tokens);
    const reads = results.map((r) => r.resource_reads);
    const times = results.map((r) => r.wall_time_ms / 1000);
    const correctCount = results.filter((r) => r.correct).length;

    const uncachedStr = `${fmt(median(uncached))} / ${Math.min(...uncached)} / ${Math.max(...uncached)}`;

    console.log(
      pad(type, 10) + pad(variant, 8) + pad(String(results.length), 5) +
        pad(uncachedStr, 26) + pad(fmt(median(cacheRead)), 15) +
        pad(fmt(median(out)), 10) + pad(fmt(median(reads)), 11) +
        pad(fmt(median(times)), 12) + `${correctCount}/${results.length}`
    );
  }

  // --- SECONDARY breakdown: per (type, variant, question), for transparency ------------------
  const byQuestion = new Map<GroupKey, RunResult[]>();
  for (const r of allResults) {
    if (r.error) continue;
    const key = `${r.type} ${r.variant} ${r.question_id}`;
    const list = byQuestion.get(key) ?? [];
    list.push(r);
    byQuestion.set(key, list);
  }

  console.log("\n=== Detail by (type, variant, question) ===");
  console.log(
    pad("Type", 9) + pad("Variant", 8) + pad("Question", 28) + pad("N", 4) +
      pad("UncachedIn(med)", 16) + pad("CacheCreate(med)", 17) + pad("CacheRead(med)", 15) +
      pad("Reads(med)", 11) + "Correct"
  );
  console.log("-".repeat(130));
  for (const [key, results] of byQuestion) {
    const [type, variant, questionId] = key.split(" ");
    const uncached = median(results.map((r) => r.uncached_input_tokens));
    const cacheCreate = median(results.map((r) => r.cache_creation_input_tokens));
    const cacheRead = median(results.map((r) => r.cache_read_input_tokens));
    const reads = median(results.map((r) => r.resource_reads));
    const correctCount = results.filter((r) => r.correct).length;

    console.log(
      pad(type, 9) + pad(variant, 8) + pad(questionId, 28) + pad(String(results.length), 4) +
        pad(fmt(uncached), 16) + pad(fmt(cacheCreate), 17) + pad(fmt(cacheRead), 15) +
        pad(fmt(reads), 11) + `${correctCount}/${results.length}`
    );
  }

  const failures = allResults.filter((r) => r.error);
  if (failures.length > 0) {
    console.log(`\n${failures.length} run(s) failed even after retry:`);
    for (const f of failures) {
      console.log(`  ${f.type}/${f.variant}/${f.question_id} rep ${f.run_index + 1}: ${f.error?.slice(0, 150)}`);
    }
  }

  console.log(
    "\nUncachedIn = input_tokens + cache_creation_input_tokens (= total minus cache_read) - the " +
      "number a real payload-size difference actually moves. CacheRead is dominated by this " +
      "installation's fixed system-prompt/tool-list prefix, shared across every run regardless " +
      "of type/variant/question - see the module comment for why total tokens is the wrong " +
      "headline here. Reads counts ReadMcpResourceTool calls; >1 means a follow-up read beyond " +
      "the initial collection resource."
  );
}

main().catch((error) => {
  console.error("agent-run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
