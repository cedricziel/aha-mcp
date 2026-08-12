# Resource rendering benchmark

Measures whether replacing `JSON.stringify(records, null, 2)` with a markdown rendering
(a link list, or a table for the types that have enough fields for one) makes an Aha
collection resource cheaper to read, and whether it still lets a model answer realistic
questions about that collection without extra round trips.

## This harness ships with no data

Every file under `scripts/bench/` is code. None of it is a fixture, and none of it is a
committed capture of a real Aha account. `scripts/bench/fixtures/` and `scripts/bench/
questions.json` are gitignored on purpose - see "Getting fixture data" below for why, and for
the one command you need to run before anything else here produces a number worth trusting.

## Pieces

- `fixtures.ts` - loads a collection fixture, from (in priority order) `BENCH_FIXTURE` (a real
  Aha list response) or `MockAhaService` as a zero-setup fallback. A `BENCH_FIXTURE` pointed at
  a missing path fails with a clear error naming the path, rather than silently falling back to
  the mock. Also unwraps the type (`features`/`epics`/`ideas`/`releases`/`goals`) from whichever
  key the fixture file's top-level object uses.
- `scramble.ts` - `bun run bench:scramble`. Turns a raw captured fixture into an anonymised
  copy, for the rare case where you want to hand a capture to someone else. Read the module's
  header comment in full before using it for that - it documents, prominently, why its output
  is not safe to publish or commit, only to trust for local use or a deliberately-accepted
  hand-off.
- `renderers.ts` - the renderings under comparison: `json` (today's behaviour, the baseline),
  `links` (the existing markdown link-list renderer from `src/core/resource-output.ts`), and
  `table` (new, local to this directory - **only exists for `ideas`/`releases`/`goals`**; see
  below for why).
- `size.ts` - `bun run bench:size`. Deterministic byte/token measurement, zero model calls
  unless `ANTHROPIC_API_KEY` is set.
- `serve.ts` - `bun run bench:serve`. A standalone MCP server exposing one fixture as
  `bench://collection/json`, `bench://collection/links`, `bench://collection/table` (when
  supported), and `bench://record/{ref}` for drilldown. Does not import `src/core/resources.ts`.
- `generate-questions.ts` - `bun run bench:questions`. Regenerates `questions.json` from
  whatever fixtures are currently available - see "Regenerating questions.json" below.
- `questions.json` - generated output, not committed: per-type index/filter/drilldown questions
  with ground truth computed from the fixture that was active when it was last generated. Every
  reference number and quoted description in it is only as real as the fixture it was generated
  from, so it must never be committed alongside a capture of a real account.
- `agent-run.ts` - `bun run bench:agent-run`. Drives the real `claude` CLI headlessly against
  `serve.ts` over MCP, for `ideas`/`releases`/`goals` only, comparing `json` vs `table`. Records
  total tokens, resource-read count, wall time, and a best-effort correctness check per run,
  repeated (default 5x) per combination, and prints median/min/max. Reads its questions from
  `questions.json`, so `bun run bench:questions` must have been run first.

## Why `table` doesn't exist for every type

`GET .../features` and `GET .../epics` return only identity fields in their list response -
`id, name, reference_num, created_at, product_id, url, resource`. There is no status, assignee,
due date, or progress to put in a table without a per-record detail fetch, which would defeat
the point of comparing renderings of the *same* list response. So:

- **features / epics**: no table variant. Compare `json` vs `links` only.
- **ideas**: `Ref | Name | Status | Created`
- **releases**: `Ref | Name | Start | Release | Owner | ParkingLot`
- **goals**: `Ref | Name | Progress | TimeFrame | Features | Initiatives | KeyResults`
  (the last three are counts, not the nested lists - those stay in the `json` rendering)

Every column set was checked against a real list response for that type before being written.

## Getting fixture data

This harness ships with no data of its own - see "This harness ships with no data" above. The
first step, before any of the commands below produce a number worth trusting, is capturing your
own fixture from a live Aha account:

1. Hit the relevant list endpoint yourself - `GET .../features`, `.../epics`, `.../ideas`,
   `.../releases`, or `.../goals` - and save the raw response body (the whole envelope,
   `{ features: [...], pagination: {...} }` etc., not just the array).
2. Drop it at `~/.cache/aha-mcp-bench/<type>-raw.json` (e.g. `~/.cache/aha-mcp-bench/
   ideas-raw.json`) - entirely outside this git worktree, which is why `scramble.ts` and
   `generate-questions.ts` both default to looking there. Nothing in this project writes to
   that directory automatically; capturing a fixture is, and always was, a manual step.
3. Run `bun run bench:questions` to derive `questions.json`'s ground truth from whatever
   fixtures you have captured (see "Regenerating questions.json" below).
4. Run `bun run bench:size` and/or `bun run bench:agent-run` against the same fixture.

Captured data and generated questions stay out of this repo **by design**:
`scripts/bench/fixtures/` and `scripts/bench/questions.json` are both listed in the root
`.gitignore`, so an accidental `git add -A` cannot reintroduce them. This harness previously
shipped a committed, scrambled fixture and a `questions.json` generated from it; both were
removed because the scrambling could not be made safe to publish - see `scramble.ts`'s header
comment for exactly why. Nothing derived from a real Aha account belongs in this repo. If you
want realistic numbers, capture your own; nobody else's account should ever need to be involved.

## Running it

```bash
# Deterministic size comparison - no network calls, no API key needed. With no BENCH_FIXTURE,
# falls back to MockAhaService and prints a loud warning (see fixtures.ts for why that fallback
# understates real JSON cost).
bun run bench:size
BENCH_FIXTURE=/path/to/ideas-raw.json bun run bench:size

# Exact token counts instead of the chars/4 approximation
ANTHROPIC_API_KEY=... bun run bench:size

# Regenerate questions.json from whatever fixtures are available (see "Getting fixture data")
bun run bench:questions
BENCH_FIXTURE_IDEAS=/path/to/ideas.json bun run bench:questions

# Serve one fixture as three MCP resource variants for manual inspection
bun run bench:serve
BENCH_FIXTURE=/path/to/goals-raw.json bun run bench:serve

# Drive the real claude CLI headlessly (ideas/releases/goals, json vs table, 5x each) -
# reads questions.json, so bun run bench:questions must have been run first
bun run bench:agent-run

# Anonymise a raw capture before handing it to someone else - read scramble.ts's header
# comment first, it documents why the output is for local use, not for sharing or committing
bun run bench:scramble
bun run scripts/bench/scramble.ts /path/to/my-raw-export.json /path/to/output.json
```

### Env vars

| Var | Used by | Meaning |
| --- | --- | --- |
| `BENCH_FIXTURE` | `fixtures.ts` (and anything that loads through it) | Path to a fixture file - the raw body of an Aha list endpoint (`{ features: [...], pagination: {...} }` etc.), or a bare array (treated as `features`). A path that does not exist fails with a clear error rather than silently falling back to the mock. |
| `BENCH_TOKEN_MODEL` | `size.ts` | Model to count tokens against when `ANTHROPIC_API_KEY` is set. Default `claude-opus-5`. |
| `ANTHROPIC_API_KEY` | `size.ts` | When set, `size.ts` calls `POST /v1/messages/count_tokens` for exact counts instead of the chars/4 approximation. |
| `BENCH_FIXTURE_<TYPE>` | `generate-questions.ts` | Per-type fixture override, e.g. `BENCH_FIXTURE_GOALS`. Falls back to `~/.cache/aha-mcp-bench/<type>-raw.json` if present, then (features only) to the mock. |
| `BENCH_AGENT_MODEL` | `agent-run.ts` | `--model` passed to `claude`. Default `haiku` (cheap and fast; the point is whether *any* reasonable model can answer from the rendering, not maximizing capability). |
| `BENCH_AGENT_REPEATS` | `agent-run.ts` | Runs per (type, variant, question) combination. Default 5. |
| `BENCH_AGENT_TYPES` | `agent-run.ts` | Comma-separated subset of `ideas,releases,goals`. Default all three. |
| `BENCH_AGENT_VARIANTS` | `agent-run.ts` | Comma-separated subset of `json,table`. Default both. |
| `BENCH_AGENT_QUESTION_IDS` | `agent-run.ts` | Comma-separated question ids to run instead of the default one-per-category selection. |
| `BENCH_AGENT_RESULTS_PATH` | `agent-run.ts` | Where raw per-run results are written. Default `~/.cache/aha-mcp-bench/results.json` - deliberately outside the repo. |

### Regenerating `questions.json`

Ground truth in `questions.json` is computed from a fixture, not hand-written - the same
reasoning as `bun run manifest:sync` regenerating `manifest.json` from a live `tools/list`
rather than someone hand-editing the tool list (see the root `CLAUDE.md`). Re-run
`bun run bench:questions` any time a fixture changes; a stale `questions.json` just means the
ground truth in it describes a fixture that is no longer current, not that the harness is wrong.

## What this harness does and does not prove

**Does prove:**

- The exact byte and (optionally token) cost of `json` vs `links` vs `table` for a given real
  fixture, with no model involved (`bench:size`).
- For `ideas`/`releases`/`goals`, whether a specific model (default: Haiku) can answer a
  specific question from a specific rendering with a specific number of resource reads, and how
  many total tokens that costs end to end, across repeated runs (`bench:agent-run`).

**Does not prove:**

- That every question a real user would ask is represented - `questions.json`'s default
  selection is one question per category per type, not an exhaustive set. Set
  `BENCH_AGENT_QUESTION_IDS` to broaden it, at proportionally higher cost and time.
- Anything about `features` or `epics` beyond size - there is no table variant for those types,
  so no agent runs are needed or performed for them; the `json` vs `links` question is already
  settled by `bench:size` alone.
- Behaviour on other models. `agent-run.ts` defaults to Haiku for cost; a larger model may need
  fewer resource reads on the same rendering, or none of this may generalize to it at all.
- Ground truth correctness for the `drilldown-description` questions is a *best-effort*
  substring check against a representative prefix of the plain-text description, because the
  model is expected to paraphrase prose, not quote it. Treat `correct: true` there as
  "plausible", every other question's `correct` flag as closer to "verified" (numbers, ref
  codes, and short names are usually reproduced verbatim).
- Anything about the absolute token counts `agent-run.ts` reports beyond this Claude Code
  installation. Every run spends 2-3 `ToolSearch` calls finding `ReadMcpResourceTool` before it
  can read anything, which is overhead from this machine's tool surface, not from the rendering
  being tested. It is identical across `json` and `table` runs, so it should not bias the
  *comparison* between them, but it does inflate every run's absolute numbers above what "just
  reading one resource" would otherwise cost.
