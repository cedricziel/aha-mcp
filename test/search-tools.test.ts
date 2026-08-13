import { describe, it, expect } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerSearchTools } from '../src/core/tools/search-tools.js';
import { AhaGraphQLClient } from '../src/core/services/aha-graphql.js';

/**
 * `aha_search`'s output contract.
 *
 * Calls go through a real MCP client, so `structuredContent` is validated against the
 * advertised `outputSchema` on the way out - a call that returns at all is itself the
 * conformance assertion.
 *
 * The case these tests exist for: a hit used to reach the caller with no reference number, so
 * the only human-readable identifier was the tail of its url path. Transcribing that drops the
 * workspace prefix - `I-9930` rather than `IDEASVOC-I-9930` - and Aha answers the truncated
 * form with 404, so the record could be found but never read or linked.
 */
async function connected(hits: unknown[], over: Record<string, unknown> = {}) {
  const graphql = new AhaGraphQLClient({
    credentials: () => ({ subdomain: 'acme', accessToken: 'tok' }),
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          data: {
            searchDocuments: {
              totalCount: hits.length,
              currentPage: 1,
              totalPages: 1,
              isLastPage: true,
              nodes: hits,
              ...over
            }
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
  });

  const server = new McpServer({ name: 'aha-test', version: '1.0.0' });
  registerSearchTools(server, graphql);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const idea = {
  name: 'Support Otel HTTP Metrics in App-O11y',
  searchableId: '7615609440903611104',
  searchableType: 'Idea',
  projectId: '7387509120724661690',
  url: '/ideas/ideas/IDEASVOC-I-9930',
  updatedAt: '2026-08-01T00:00:00Z',
  searchable: {
    __typename: 'Idea',
    referenceNum: 'IDEASVOC-I-9930',
    score: 12,
    votes: 7,
    numEndorsements: 3
  }
};

/** A Page has no single-record resource template, so it cannot be linked. */
const page = {
  name: 'Observability strategy',
  searchableId: '99',
  searchableType: 'Page',
  projectId: null,
  url: '/pages/99',
  updatedAt: '2026-08-01T00:00:00Z',
  searchable: { __typename: 'Page', referenceNum: 'DOC-1' }
};

const call = async (client: Client) =>
  (await client.callTool({ name: 'aha_search', arguments: { query: 'otel' } })) as any;

describe('aha_search', () => {
  it('returns each hit with the full reference number', async () => {
    const result = await call(await connected([idea]));

    expect(result.structuredContent.results[0].reference_num).toBe('IDEASVOC-I-9930');
    // The internal id is still there, but it is no longer the only identifier on offer.
    expect(result.structuredContent.results[0].id).toBe('7615609440903611104');
  });

  it('leads the link label with the reference number, not just the name', async () => {
    const result = await call(await connected([idea]));
    const text = result.content[0].text;

    expect(text).toContain(
      '[IDEASVOC-I-9930 Support Otel HTTP Metrics in App-O11y](https://acme.aha.io/ideas/ideas/IDEASVOC-I-9930)'
    );
  });

  it('reports the demand signal an idea carries', async () => {
    const result = await call(await connected([idea]));

    expect(result.content[0].text).toContain('7 votes, 3 endorsements');
    expect(result.structuredContent.results[0]).toMatchObject({ votes: 7, endorsements: 3, score: 12 });
  });

  /**
   * Measured over 200 ideas on a live account, `votes` and `endorsements` never disagreed, so
   * printing both would repeat the same number on every line. Both still travel in
   * `structuredContent` - they are separate fields in Aha, and a weighted-vote account would
   * show it.
   */
  it('prints one number when votes and endorsements agree', async () => {
    const agreeing = { ...idea, searchable: { ...idea.searchable, votes: 15, numEndorsements: 15 } };
    const result = await call(await connected([agreeing]));

    expect(result.content[0].text).toContain(' - 15 votes');
    expect(result.content[0].text).not.toContain('endorsements');
    expect(result.structuredContent.results[0]).toMatchObject({ votes: 15, endorsements: 15 });
  });

  it('says "1 vote" rather than "1 votes"', async () => {
    const one = { ...idea, searchable: { ...idea.searchable, votes: 1, numEndorsements: 1 } };
    expect((await call(await connected([one]))).content[0].text).toContain(' - 1 vote');
  });

  // Only reachable when the two disagree, which is the branch that keeps both numbers.
  it('says "1 endorsement" rather than "1 endorsements"', async () => {
    const one = { ...idea, searchable: { ...idea.searchable, votes: 4, numEndorsements: 1 } };
    expect((await call(await connected([one]))).content[0].text).toContain(' - 4 votes, 1 endorsement');
  });

  /**
   * Every idea on the account probed scored exactly 20 - one distinct value across 200 - so
   * the score ranks nothing there and would only take room in a line a person reads.
   */
  it('keeps the score out of the text line but not out of the payload', async () => {
    const result = await call(await connected([idea]));

    expect(result.content[0].text).not.toContain('score');
    expect(result.structuredContent.results[0].score).toBe(12);
  });

  it('links a hit whose type is readable as a resource', async () => {
    const result = await call(await connected([idea]));
    const links = result.content.filter((block: any) => block.type === 'resource_link');

    expect(links).toHaveLength(1);
    expect(links[0].uri).toBe('aha://idea/IDEASVOC-I-9930');
    expect(links[0].title).toContain('IDEASVOC-I-9930');
    expect(links[0].annotations.lastModified).toBe('2026-08-01T00:00:00Z');
  });

  /**
   * Coverage is bounded by which types have a resource template, not by anything this tool
   * decides. What matters is that the unlinkable hit is still reported, with its url.
   */
  it('skips a type with no resource template without dropping the hit', async () => {
    const result = await call(await connected([idea, page]));
    const links = result.content.filter((block: any) => block.type === 'resource_link');

    expect(links.map((l: any) => l.uri)).toEqual(['aha://idea/IDEASVOC-I-9930']);
    expect(result.structuredContent.results).toHaveLength(2);
    expect(result.content[0].text).toContain('https://acme.aha.io/pages/99');
  });

  it('omits the demand fields on a type that has none, rather than sending zeros', async () => {
    const feature = {
      ...idea,
      searchableType: 'Feature',
      url: '/features/APPO11Y-43',
      searchable: { __typename: 'Feature', referenceNum: 'APPO11Y-43', score: 4 }
    };
    const result = await call(await connected([feature]));
    const hit = result.structuredContent.results[0];

    expect(hit).not.toHaveProperty('votes');
    expect(hit).not.toHaveProperty('endorsements');
    expect(hit.score).toBe(4);
    expect(result.content[0].text).not.toContain('votes');
  });

  /**
   * ReleasePhase, IdeaUser and Project have no reference number at all. The hit is still
   * worth returning - it has a name and a url - but nothing can be linked from it.
   */
  it('handles a hit that has no reference number', async () => {
    const phase = {
      name: 'Beta',
      searchableId: '5',
      searchableType: 'ReleasePhase',
      projectId: null,
      url: '/release_phases/5',
      updatedAt: '2026-08-01T00:00:00Z',
      searchable: { __typename: 'ReleasePhase' }
    };
    const result = await call(await connected([phase]));

    expect(result.structuredContent.results[0].reference_num).toBeNull();
    expect(result.content[0].text).toContain('[Beta](https://acme.aha.io/release_phases/5)');
    expect(result.content.filter((b: any) => b.type === 'resource_link')).toHaveLength(0);
  });

  it('says so when nothing matched', async () => {
    const result = await call(await connected([]));

    expect(result.content[0].text).toBe('No matches for "otel".');
    expect(result.content).toHaveLength(1);
  });
});
