#!/usr/bin/env bun
/**
 * Regenerates questions.json from whatever fixtures are available, one question set per
 * record type (features/epics/ideas/releases/goals).
 *
 * Every ground-truth answer here is computed by reading a fixture, not typed in by hand - the
 * same reasoning as `bun run manifest:sync` regenerating manifest.json from a live `tools/list`
 * rather than someone editing the tool list by hand (see CLAUDE.md). A hand-written expected
 * answer drifts the moment the fixture changes; a generated one cannot.
 *
 * Fixture resolution per type, in priority order:
 *   1. `BENCH_FIXTURE_<TYPE>` (e.g. `BENCH_FIXTURE_IDEAS`) - an explicit path.
 *   2. `~/.cache/aha-mcp-bench/<type>-raw.json` - where the real captured fixtures this
 *      harness was built against live. Never part of this repo; read if present.
 *   3. For `features` only, the MockAhaService fallback (see fixtures.ts) - the mock cannot
 *      fabricate epics/ideas/releases/goals, so those types are simply omitted with a note
 *      when no real fixture is available for them.
 *
 * Re-run this whenever a fixture changes:
 *
 *   bun run scripts/bench/generate-questions.ts
 *   BENCH_FIXTURE_IDEAS=./my-ideas.json bun run scripts/bench/generate-questions.ts
 *
 * Three categories per type, matching the task this harness serves:
 *   - index: questions answerable from the shape of the collection alone (count, list of refs)
 *   - filter: questions that require scanning every record against a predicate
 *   - drilldown: questions answerable only by reading one full record, not a summary of it -
 *     this is the category a smaller rendering could plausibly break on, since both `links`
 *     and `table` omit fields a `json` rendering carries in full (most pointedly: descriptions,
 *     which none of the list endpoints' identity-only fields include a hint of).
 */

import { homedir } from "os";
import { writeFileSync } from "fs";
import {
  isRecord,
  KNOWN_TYPES,
  loadFixtureFromFile,
  loadMockFixture,
  type FixtureResult,
  type RecordType
} from "./fixtures.js";
import { tableSupported } from "./renderers.js";

interface Question {
  id: string;
  category: "index" | "filter" | "drilldown";
  question: string;
  ground_truth: unknown;
}

function identifierOf(record: Record<string, unknown>): string | undefined {
  const ref = record.reference_num;
  if (typeof ref === "string" && ref.length > 0) return ref;
  const id = record.id;
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof id === "number") return String(id);
  return undefined;
}

function nameOf(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const name = value.name;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}

/** Aha rich text fields arrive as `{ body: "<p>...</p>" }`; a few mocks use a bare string. */
function descriptionOf(record: Record<string, unknown>): string | undefined {
  const description = record.description;
  if (typeof description === "string" && description.length > 0) return description;
  if (isRecord(description) && typeof description.body === "string") return description.body;
  return undefined;
}

function refsOf(records: Record<string, unknown>[]): string[] {
  return records
    .map(identifierOf)
    .filter((id): id is string => Boolean(id))
    .sort();
}

/**
 * A generic filter every type supports: split on the median `created_at`, so "which records
 * were created before X" has a real, roughly-half-the-collection answer regardless of what
 * other fields the type carries. Computed from the fixture, not a fixed calendar date, so it
 * stays a meaningful split as the fixture changes.
 */
function createdBeforeMedianQuestion(records: Record<string, unknown>[]): Question | undefined {
  const timestamps = records
    .map((r) => (typeof r.created_at === "string" ? r.created_at : undefined))
    .filter((t): t is string => Boolean(t))
    .sort();
  if (timestamps.length === 0) return undefined;

  const medianTimestamp = timestamps[Math.floor(timestamps.length / 2)];
  const matching = refsOf(records.filter((r) => typeof r.created_at === "string" && r.created_at < medianTimestamp));

  return {
    id: "filter-created-before-median",
    category: "filter",
    question: `Which records were created before ${medianTimestamp}?`,
    ground_truth: matching
  };
}

/** The core three-category set every type gets, plus whatever `extra()` adds for that type. */
function buildQuestions(
  records: Record<string, unknown>[],
  extra: (records: Record<string, unknown>[]) => Question[]
): Question[] {
  const questions: Question[] = [
    {
      id: "index-count",
      category: "index",
      question: "How many records are in this collection?",
      ground_truth: records.length
    },
    {
      id: "index-list-refs",
      category: "index",
      question: "List the reference numbers of every record in this collection.",
      ground_truth: refsOf(records)
    }
  ];

  const medianFilter = createdBeforeMedianQuestion(records);
  if (medianFilter) questions.push(medianFilter);

  questions.push(...extra(records));
  return questions;
}

function questionsForType(type: RecordType, records: Record<string, unknown>[]): Question[] {
  switch (type) {
    case "ideas":
      return buildQuestions(records, (rs) => {
        const out: Question[] = [];
        const unassigned = rs.filter((r) => !nameOf(r.workflow_status));
        out.push({
          id: "filter-no-workflow-status",
          category: "filter",
          question: "Which ideas have no workflow status set?",
          ground_truth: refsOf(unassigned)
        });
        const described = rs.find((r) => descriptionOf(r) !== undefined);
        if (described) {
          const ref = identifierOf(described);
          out.push({
            id: "drilldown-description",
            category: "drilldown",
            question: `What does the description of ${ref} say?`,
            ground_truth: descriptionOf(described)
          });
        }
        const statused = rs.find((r) => nameOf(r.workflow_status) !== undefined);
        if (statused) {
          const ref = identifierOf(statused);
          out.push({
            id: "drilldown-status",
            category: "drilldown",
            question: `What is the workflow status of ${ref}?`,
            ground_truth: nameOf(statused.workflow_status)
          });
        }
        return out;
      });

    case "releases":
      return buildQuestions(records, (rs) => {
        const out: Question[] = [];
        const inParkingLot = rs.filter((r) => r.parking_lot === true);
        out.push({
          id: "filter-in-parking-lot",
          category: "filter",
          question: "Which releases are in the parking lot?",
          ground_truth: refsOf(inParkingLot)
        });
        const owned = rs.find((r) => nameOf(r.owner) !== undefined);
        if (owned) {
          const ref = identifierOf(owned);
          out.push({
            id: "drilldown-owner",
            category: "drilldown",
            question: `Who owns ${ref}?`,
            ground_truth: nameOf(owned.owner)
          });
        }
        return out;
      });

    case "goals":
      return buildQuestions(records, (rs) => {
        const out: Question[] = [];
        const lowProgress = rs.filter((r) => typeof r.progress === "number" && (r.progress as number) < 50);
        out.push({
          id: "filter-progress-below-50",
          category: "filter",
          question: "Which goals have progress below 50%?",
          ground_truth: refsOf(lowProgress)
        });
        const noFeatures = rs.filter((r) => !Array.isArray(r.features) || (r.features as unknown[]).length === 0);
        out.push({
          id: "filter-no-features",
          category: "filter",
          question: "Which goals have no features associated with them?",
          ground_truth: refsOf(noFeatures)
        });
        const described = rs.find((r) => descriptionOf(r) !== undefined);
        if (described) {
          const ref = identifierOf(described);
          out.push({
            id: "drilldown-description",
            category: "drilldown",
            question: `What does the description of ${ref} say?`,
            ground_truth: descriptionOf(described)
          });
        }
        return out;
      });

    case "features":
    case "epics":
      // The list endpoint for these two returns only identity fields (id, name,
      // reference_num, created_at, product_id, url, resource) - there is no status, assignee,
      // due date, or description to filter or drill into without a per-record detail fetch.
      // created_at is the only non-identity field available, so it carries both the generic
      // median filter (from buildQuestions) and the one drilldown question these types get.
      return buildQuestions(records, (rs) => {
        const first = rs[0];
        if (!first) return [];
        const ref = identifierOf(first);
        return [
          {
            id: "drilldown-created-at",
            category: "drilldown",
            question: `When was ${ref} created?`,
            ground_truth: first.created_at
          }
        ];
      });
  }
}

function envOverridePath(type: RecordType): string | undefined {
  return process.env[`BENCH_FIXTURE_${type.toUpperCase()}`];
}

function defaultCachePath(type: RecordType): string {
  return `${homedir()}/.cache/aha-mcp-bench/${type}-raw.json`;
}

async function resolveFixture(type: RecordType): Promise<FixtureResult | undefined> {
  const override = envOverridePath(type);
  if (override) return loadFixtureFromFile(override);

  const defaultPath = defaultCachePath(type);
  try {
    return loadFixtureFromFile(defaultPath);
  } catch {
    // Falls through to the mock (features only) or is omitted below.
  }

  if (type === "features") {
    console.error(
      `No fixture found for "features" (checked ${defaultPath}); falling back to MockAhaService.`
    );
    return loadMockFixture();
  }

  return undefined;
}

interface TypeSection {
  fixture_source: "file" | "mock" | "unavailable";
  fixture_path?: string;
  record_count: number;
  table_supported: boolean;
  questions: Question[];
}

async function main() {
  const types: Partial<Record<RecordType, TypeSection>> = {};

  for (const type of KNOWN_TYPES) {
    const fixture = await resolveFixture(type);
    if (!fixture) {
      types[type] = {
        fixture_source: "unavailable",
        record_count: 0,
        table_supported: tableSupported(type),
        questions: []
      };
      console.log(`Skipped "${type}": no fixture available (no BENCH_FIXTURE_${type.toUpperCase()}, no cache file).`);
      continue;
    }

    const questions = questionsForType(type, fixture.records);
    types[type] = {
      fixture_source: fixture.source,
      fixture_path: fixture.path,
      record_count: fixture.records.length,
      table_supported: tableSupported(type),
      questions
    };
    console.log(
      `"${type}": ${questions.length} question(s) from ${fixture.source} ` +
        `(${fixture.records.length} record(s)${fixture.path ? `, ${fixture.path}` : ""}).`
    );
  }

  const output = {
    generated_at: new Date().toISOString(),
    generated_by: "scripts/bench/generate-questions.ts",
    note:
      "Ground truth is computed from whichever fixture was active per type when this file " +
      "was generated (see each type's fixture_source/fixture_path below) - regenerate after " +
      "swapping any fixture rather than editing this file by hand.",
    types
  };

  const outPath = new URL("./questions.json", import.meta.url).pathname;
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error("generate-questions failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
