import { describe, it, expect, afterEach } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerReleaseTools } from '../src/core/tools/release-tools.js';
import { AhaService } from '../src/core/services/aha-service.js';

/**
 * Release membership reads.
 *
 * Calls go through a real MCP client, because the client validates `structuredContent`
 * against the advertised `outputSchema` - a call that returns at all is itself the
 * conformance assertion. The fixtures carry exactly the fields a live
 * `/releases/{id}/features` returns: identity only, no `workflow_status`.
 */
async function connected() {
  const server = new McpServer({ name: 'aha-test', version: '1.0.0' });
  registerReleaseTools(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** A feature as this endpoint returns one - measured: seven identity fields, nothing else. */
const feature = (n: number) => ({
  id: `697111072648835000${n}`,
  reference_num: `APPO11Y-${n}`,
  name: `Feature ${n}`,
  product_id: '7386671125809128444',
  reference_prefix: undefined,
  resource: `https://test.aha.io/api/v1/features/APPO11Y-${n}`,
  url: `https://test.aha.io/features/APPO11Y-${n}`,
  created_at: '2026-08-01T10:00:00.000Z'
});

/** An epic as this endpoint returns one - measured: six fields, one fewer than a feature. */
const epic = (n: number) => ({
  id: `746970887307929302${n}`,
  reference_num: `APPO11Y-E-${n}`,
  name: `Epic ${n}`,
  resource: `https://test.aha.io/api/v1/epics/APPO11Y-E-${n}`,
  url: `https://test.aha.io/epics/APPO11Y-E-${n}`,
  created_at: '2025-02-10T08:45:24.825Z'
});

describe('Release membership listing', () => {
  const patched: string[] = [];

  const patch = (method: keyof typeof AhaService, impl: (...args: any[]) => Promise<any>) => {
    patched.push(method as string);
    (AhaService as any)[`__original_${method}`] = (AhaService as any)[method];
    (AhaService as any)[method] = impl;
  };

  afterEach(() => {
    for (const method of patched) {
      (AhaService as any)[method] = (AhaService as any)[`__original_${method}`];
      delete (AhaService as any)[`__original_${method}`];
    }
    patched.length = 0;
  });

  it('enumerates a release and links every feature it returns', async () => {
    patch('getReleaseFeatures', async () => ({
      features: [feature(1), feature(2)],
      pagination: { total_records: 2, total_pages: 1, current_page: 1 }
    }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_release_features',
      arguments: { releaseId: 'APPO11Y-R-18' }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.release_id).toBe('APPO11Y-R-18');
    expect(result.structuredContent.features).toHaveLength(2);
    expect(result.content[0].text).toBe(
      '2 features in release APPO11Y-R-18:\n- APPO11Y-1 "Feature 1"\n- APPO11Y-2 "Feature 2"'
    );

    // One link per feature: coverage is complete here, unlike aha_search, so linking cannot
    // silently skip part of the result set.
    const links = result.content.filter((c: any) => c.type === 'resource_link');
    expect(links.map((l: any) => l.uri)).toEqual([
      'aha://feature/APPO11Y-1',
      'aha://feature/APPO11Y-2'
    ]);
  });

  it('says how much of the release it is showing, and which page holds the rest', async () => {
    // The failure this tool exists to prevent: Aha answers with 30 features for a release that
    // holds 59, and a caller reading only the array cannot tell that from a complete list.
    patch('getReleaseFeatures', async () => ({
      features: [feature(1)],
      pagination: { total_records: 59, total_pages: 2, current_page: 1 }
    }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_release_features',
      arguments: { releaseId: 'APPO11Y-R-3', perPage: 1 }
    });

    expect(result.content[0].text).toContain('1 of 59 features in release APPO11Y-R-3');
    expect(result.content[0].text).toContain('Page 1 of 2. Call again with page: 2 for the rest.');
    // Pagination reaches the client structurally too, not only as prose.
    expect(result.structuredContent.pagination).toEqual({
      total_records: 59,
      total_pages: 2,
      current_page: 1
    });
  });

  it('asks Aha for 200 per page unless told otherwise', async () => {
    // Aha's own default is 30. Taking it would make the common case - "list this release" -
    // return a page while reading like a release.
    const calls: any[] = [];
    patch('getReleaseFeatures', async (releaseId: string, page?: number, perPage?: number) => {
      calls.push({ releaseId, page, perPage });
      return { features: [], pagination: { total_records: 0, total_pages: 0, current_page: 1 } };
    });
    const client = await connected();

    await client.callTool({ name: 'aha_list_release_features', arguments: { releaseId: 'PRJ1-R-1' } });
    await client.callTool({
      name: 'aha_list_release_features',
      arguments: { releaseId: 'PRJ1-R-1', page: 3, perPage: 25 }
    });

    expect(calls[0]).toEqual({ releaseId: 'PRJ1-R-1', page: undefined, perPage: 200 });
    expect(calls[1]).toEqual({ releaseId: 'PRJ1-R-1', page: 3, perPage: 25 });
  });

  it('reports an empty page without claiming the release is empty', async () => {
    patch('getReleaseFeatures', async () => ({ features: [] }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_release_features',
      arguments: { releaseId: 'PRJ1-R-9', page: 4 }
    });

    expect(result.isError).toBeFalsy();
    // "on this page", because page 4 of a 2-page release is empty while the release is not.
    expect(result.content[0].text).toBe('Release PRJ1-R-9 has no features on this page');
    expect(result.structuredContent.features).toEqual([]);
    expect(result.structuredContent).not.toHaveProperty('pagination');
  });

  it('reports a failure as a tool error rather than an empty release', async () => {
    patch('getReleaseFeatures', async () => {
      throw new Error('Request failed with status code 404');
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_release_features',
      arguments: { releaseId: 'PRJ1-R-404' }
    });

    // An empty success would read as "this release has no features", which is the same
    // silent-partial-list failure in its worst form.
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error listing release features');
  });

  it('sends page and per_page to Aha, and neither when neither was asked for', async () => {
    // This endpoint is reached with `fetch` rather than through aha-js, so the query string is
    // hand-built and worth pinning: a dropped `per_page` would silently reinstate Aha's 30.
    const urls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ features: [], pagination: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    try {
      AhaService.initialize('test-token', 'test');
      await AhaService.getReleaseFeatures('APPO11Y-R-18', 2, 200);
      await AhaService.getReleaseFeatures('APPO11Y-R-18');

      expect(urls[0]).toBe(
        'https://test.aha.io/api/v1/releases/APPO11Y-R-18/features?page=2&per_page=200'
      );
      expect(urls[1]).toBe('https://test.aha.io/api/v1/releases/APPO11Y-R-18/features');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('enumerates a release\'s epics too, under their own key', async () => {
    // A release is not organised the same way in every workspace: one planned in epics was as
    // invisible through the features tool as it was through search.
    patch('getReleaseEpics', async () => ({
      epics: [epic(3), epic(4)],
      pagination: { total_records: 4, total_pages: 2, current_page: 1 }
    }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_release_epics',
      arguments: { releaseId: 'APPO11Y-R-3', perPage: 2 }
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('2 of 4 epics in release APPO11Y-R-3');
    expect(result.content[0].text).toContain('Call again with page: 2');
    // `epics`, not `features`: a caller reading one key should never have to work out whether
    // the other is absent because the release has none or because it called the other tool.
    expect(result.structuredContent.epics).toHaveLength(2);
    expect(result.structuredContent).not.toHaveProperty('features');
    expect(
      result.content.filter((c: any) => c.type === 'resource_link').map((l: any) => l.uri)
    ).toEqual(['aha://epic/APPO11Y-E-3', 'aha://epic/APPO11Y-E-4']);
  });

  it('names epics, not features, when an epic listing fails or comes back empty', async () => {
    patch('getReleaseEpics', async () => ({ epics: [] }));
    const client = await connected();

    const empty: any = await client.callTool({
      name: 'aha_list_release_epics',
      arguments: { releaseId: 'PRJ1-R-9' }
    });
    expect(empty.content[0].text).toBe('Release PRJ1-R-9 has no epics on this page');

    (AhaService as any).getReleaseEpics = async () => {
      throw new Error('Request failed with status code 403');
    };
    const failed: any = await client.callTool({
      name: 'aha_list_release_epics',
      arguments: { releaseId: 'PRJ1-R-9' }
    });
    expect(failed.isError).toBe(true);
    expect(failed.content[0].text).toContain('Error listing release epics');
  });

  it('passes the page size through to the epics endpoint as well', async () => {
    const calls: any[] = [];
    patch('getReleaseEpics', async (releaseId: string, page?: number, perPage?: number) => {
      calls.push({ releaseId, page, perPage });
      return { epics: [] };
    });
    const client = await connected();

    await client.callTool({ name: 'aha_list_release_epics', arguments: { releaseId: 'PRJ1-R-1' } });

    // Aha's default page size on this route is unmeasured - the largest release probed holds 4
    // epics - so the tool asks explicitly rather than inheriting whatever it turns out to be.
    expect(calls[0]).toEqual({ releaseId: 'PRJ1-R-1', page: undefined, perPage: 200 });
  });

  it('declares both listings read-only, reaching Aha, with an output schema', async () => {
    const client = await connected();
    const tools = (await client.listTools()).tools;

    expect(tools.map(t => t.name).sort()).toEqual([
      'aha_list_release_epics',
      'aha_list_release_features'
    ]);

    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.openWorldHint).toBe(true);
      // Meaningless for a reader, per the spec, so they must stay absent.
      expect(tool.annotations?.destructiveHint).toBeUndefined();
      expect(tool.annotations?.idempotentHint).toBeUndefined();
      // Titles live in both spec locations and must agree.
      expect(tool.title).toBe(tool.annotations?.title);
      expect(tool.outputSchema).toBeDefined();
    }
  });
});
