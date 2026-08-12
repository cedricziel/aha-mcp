#!/usr/bin/env bun
/**
 * Probe what an Aha.io API token can reach on the GraphQL API (POST /api/v2/graphql).
 *
 * The REST docs do not mention the GraphQL API, so this reports what a given account and
 * token can actually do rather than what documentation implies. Nothing is written; every
 * query below is read-only.
 *
 * Usage:
 *   AHA_COMPANY=mycompany AHA_TOKEN=... bun run scripts/check-graphql.ts
 *   # or put both in .env (gitignored) and run:
 *   bun run scripts/check-graphql.ts
 *
 * The token is never printed.
 */
import { readFileSync, existsSync } from 'fs';

// Load .env without adding a dependency.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const company = process.env.AHA_COMPANY;
const token = process.env.AHA_TOKEN;

if (!company || !token) {
  console.error('Set AHA_COMPANY and AHA_TOKEN (env or .env). The token is never printed.');
  process.exit(2);
}

const endpoint = `https://${company}.aha.io/api/v2/graphql`;
console.log(`endpoint: ${endpoint}`);
console.log(`token:    <set, ${token.length} chars>\n`);

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables })
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  return { status: res.status, body };
}

/** Run a probe and print a one-line verdict. */
async function probe(label: string, query: string, variables: Record<string, unknown> = {}) {
  const { status, body } = await gql(query, variables);
  const errors: string[] = (body?.errors ?? []).map((e: any) => e.message);

  if (status === 401 || status === 403) {
    console.log(`✗ ${label.padEnd(26)} HTTP ${status} — token rejected`);
    return { ok: false, data: null };
  }
  if (errors.length) {
    console.log(`✗ ${label.padEnd(26)} ${errors[0].slice(0, 110)}`);
    return { ok: false, data: null };
  }
  if (status !== 200) {
    console.log(`✗ ${label.padEnd(26)} HTTP ${status}`);
    return { ok: false, data: null };
  }
  console.log(`✓ ${label.padEnd(26)} ok`);
  return { ok: true, data: body?.data };
}

console.log('--- can the token reach the GraphQL API at all? ---');
const auth = await probe('authentication', '{ account { id name } }');
if (!auth.ok) {
  console.log('\nGraphQL is not usable with this token. Check that the token is valid and');
  console.log('that AHA_COMPANY matches the subdomain the token belongs to.');
  process.exit(1);
}
console.log(`  account: ${auth.data?.account?.name ?? '(unnamed)'}`);

console.log('\n--- is introspection available? ---');
const intro = await probe(
  'introspection',
  '{ __schema { queryType { fields { name } } mutationType { fields { name } } } }'
);
if (intro.ok) {
  const q = intro.data.__schema.queryType.fields.length;
  const m = intro.data.__schema.mutationType?.fields?.length ?? 0;
  console.log(`  ${q} root queries, ${m} mutations visible to this token`);
}

console.log('\n--- searchDocuments: the candidate replacement for local semantic search ---');
const term = process.env.AHA_TEST_QUERY || 'roadmap';
const search = await probe(
  `searchDocuments("${term}")`,
  `query S($q: String!) {
     searchDocuments(filters: { query: $q }, per: 5) {
       totalCount
       nodes { name searchableType url }
     }
   }`,
  { q: term }
);
if (search.ok) {
  const r = search.data.searchDocuments;
  console.log(`  totalCount: ${r.totalCount}`);
  for (const n of r.nodes ?? []) console.log(`   - [${n.searchableType}] ${n.name}`);
  if (!r.nodes?.length) console.log(`   (no matches for "${term}" — try AHA_TEST_QUERY=<term>)`);
}

console.log('\n--- workspace scoping (what the local cache could not do) ---');
const projects = await probe('projects', '{ projects(per: 3) { nodes { id name } } }');
const projectId = projects.data?.projects?.nodes?.[0]?.id;
if (projectId) {
  console.log(`  using projectId ${projectId} (${projects.data.projects.nodes[0].name})`);
  await probe(
    'searchDocuments scoped',
    `query S($q: String!, $p: ID!) {
       searchDocuments(filters: { query: $q, projectId: $p }, per: 3) { totalCount }
     }`,
    { q: term, p: projectId }
  );
  await probe(
    'searchDocuments typed',
    `query S($q: String!, $t: [String!]) {
       searchDocuments(filters: { query: $q, searchableType: $t }, per: 3) { totalCount }
     }`,
    { q: term, t: ['Idea', 'Feature'] }
  );
}

// Most list queries take a non-null `filters` argument and additionally insist on a scoping
// id - a bare `filters: {}` is rejected with "Must pass a project ID or ...". Distinguish
// that (the query is available, we just under-specified it) from HTTP 403, which means the
// account or plan does not grant access.
console.log('\n--- capabilities this MCP does not expose (available on this account?) ---');
const byProject = `filters: { projectId: "${projectId}" }`;
await probe('pages (Knowledge)', '{ pages(per: 1) { totalCount nodes { id name } } }');
await probe('goals', `{ goals(${byProject}, per: 1) { totalCount nodes { id name } } }`);
await probe('initiatives', `{ initiatives(${byProject}, per: 1) { totalCount nodes { id name } } }`);
await probe('ideaThemes', `{ ideaThemes(${byProject}, per: 1) { totalCount nodes { id name } } }`);
await probe('personas', `{ personas(${byProject}, per: 1) { totalCount nodes { id name } } }`);
await probe('iterations', `{ iterations(${byProject}, per: 1) { totalCount nodes { id name } } }`);
await probe('discoveryInterviews', '{ discoveryInterviews(filters: {}, per: 1) { totalCount nodes { id } } }');

// keyResults hangs off a goal rather than a project.
const goal = await gql(`{ goals(${byProject}, per: 1) { nodes { id name } } }`);
const goalId = goal.body?.data?.goals?.nodes?.[0]?.id;
if (goalId) {
  await probe('keyResults (OKRs)', `{ keyResults(filters: { goalId: "${goalId}" }, per: 3) { totalCount nodes { id name } } }`);
} else {
  console.log(`- ${'keyResults (OKRs)'.padEnd(26)} skipped, no goal found in this workspace`);
}

console.log('\n--- REST comparison: /api/v1/me (no GraphQL equivalent exists) ---');
const meRes = await fetch(`https://${company}.aha.io/api/v1/me`, {
  headers: { Authorization: `Bearer ${token}` }
});
console.log(`${meRes.ok ? '✓' : '✗'} ${'GET /api/v1/me'.padEnd(26)} HTTP ${meRes.status}`);

console.log('\nDone. Nothing was written to Aha.');
