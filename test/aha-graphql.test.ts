import { describe, it, expect } from 'bun:test';
import {
  AhaGraphQLClient,
  MAX_PER_PAGE,
  MIN_PER_PAGE,
  SEARCHABLE_TYPES,
  TOTAL_COUNT_CEILING
} from '../src/core/services/aha-graphql';

/**
 * The behaviours pinned here were established by probing a live Aha account, so they
 * describe the real API rather than assumptions: `per` defaults to 20 and is clamped
 * server-side to 10..200, `totalCount` saturates at 10000, and argument or scoping problems
 * arrive as GraphQL errors alongside an HTTP 200.
 */

interface Captured {
  url: string;
  body: { query: string; variables: any };
  headers: Record<string, string>;
}

/** A fetch stub that records the request and replays a canned response. */
function stub(
  response: unknown,
  status = 200
): { client: AhaGraphQLClient; calls: Captured[] } {
  const calls: Captured[] = [];
  const client = new AhaGraphQLClient({
    credentials: () => ({ subdomain: 'acme', accessToken: 'tok' }),
    fetchImpl: async (url, init) => {
      calls.push({
        url,
        body: JSON.parse(String(init.body)),
        headers: init.headers as Record<string, string>
      });
      return new Response(JSON.stringify(response), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });
  return { client, calls };
}

const page = (over: Record<string, unknown> = {}) => ({
  data: {
    searchDocuments: {
      totalCount: 3,
      currentPage: 1,
      totalPages: 1,
      isLastPage: true,
      nodes: [
        {
          name: 'Alerting: silence by label',
          searchableId: '123',
          searchableType: 'Idea',
          projectId: 'p1',
          // Aha returns an app path here, not a URL.
          url: '/ideas/ideas/IDEA-1',
          updatedAt: '2026-08-01T00:00:00Z'
        }
      ],
      ...over
    }
  }
});

describe('AhaGraphQLClient', () => {
  describe('endpoint and auth', () => {
    it('targets the v2 GraphQL endpoint for the configured subdomain', async () => {
      const { client, calls } = stub(page());
      await client.searchDocuments({ query: 'alert' });

      expect(calls[0].url).toBe('https://acme.aha.io/api/v2/graphql');
      expect(calls[0].headers.Authorization).toBe('Bearer tok');
    });

    it('explains what to configure when the subdomain is missing', () => {
      const client = new AhaGraphQLClient({
        credentials: () => ({ subdomain: null, accessToken: 'tok' })
      });
      expect(() => client.endpoint()).toThrow(/AHA_COMPANY|configure_server/);
    });

    it('explains what to configure when the token is missing', async () => {
      const client = new AhaGraphQLClient({
        credentials: () => ({ subdomain: 'acme', accessToken: null }),
        fetchImpl: async () => new Response('{}')
      });
      await expect(client.searchDocuments({ query: 'x' })).rejects.toThrow(/AHA_TOKEN|configure_server/);
    });

    it('reads credentials per request, so configure_server takes effect', async () => {
      let token = 'first';
      const seen: string[] = [];
      const client = new AhaGraphQLClient({
        credentials: () => ({ subdomain: 'acme', accessToken: token }),
        fetchImpl: async (_u, init) => {
          seen.push((init.headers as any).Authorization);
          return new Response(JSON.stringify(page()));
        }
      });

      await client.searchDocuments({ query: 'a' });
      token = 'second';
      await client.searchDocuments({ query: 'a' });

      expect(seen).toEqual(['Bearer first', 'Bearer second']);
    });
  });

  describe('filters', () => {
    it('sends only the query when nothing else is given', async () => {
      const { client, calls } = stub(page());
      await client.searchDocuments({ query: 'alert' });

      expect(calls[0].body.variables.filters).toEqual({ query: 'alert' });
    });

    it('passes workspace and record-type filters through', async () => {
      const { client, calls } = stub(page());
      await client.searchDocuments({
        query: 'alert',
        projectId: 'ws-1',
        searchableType: ['Idea', 'Feature']
      });

      expect(calls[0].body.variables.filters).toEqual({
        query: 'alert',
        projectId: 'ws-1',
        searchableType: ['Idea', 'Feature']
      });
    });

    it('omits an empty record-type list rather than sending one that matches nothing', async () => {
      const { client, calls } = stub(page());
      await client.searchDocuments({ query: 'alert', searchableType: [] });

      expect(calls[0].body.variables.filters).not.toHaveProperty('searchableType');
    });

    it('coerces a workspace id to a string, which a number silently is not', async () => {
      // Aha accepts a numeric projectId without complaint and matches nothing at all, so a
      // caller passing the id as a number would get an empty result with no hint why. Real
      // workspace ids (7387506590217164236) also exceed 2^53, so a number cannot even hold
      // one exactly - which is why the API surface types this as a string throughout.
      const { client, calls } = stub(page());
      await client.searchDocuments({ query: 'alert', projectId: 12345 as any });

      expect(calls[0].body.variables.filters.projectId).toBe('12345');
    });

    it('rejects a blank query, without promising a match-all', async () => {
      const { client } = stub(page());
      await expect(client.searchDocuments({ query: '   ' })).rejects.toThrow(/no match-all/);
    });

    /**
     * `*` was documented by this server as a match-all and is not one: alone it returns an
     * arbitrary subset, and with `projectId` set it returns zero for every workspace tried.
     * The empty result is the damaging part - it reads as an empty workspace, and gets
     * diagnosed as a broken workspace filter - so it is refused before the request goes out.
     */
    it('refuses a wildcard-only query rather than returning nothing', async () => {
      const { client, calls } = stub(page());

      for (const query of ['*', '**', ' * ']) {
        await expect(client.searchDocuments({ query })).rejects.toThrow(
          /does not support "\*" as a match-all/
        );
      }

      expect(calls).toHaveLength(0);
    });

    it('says what to do instead when it refuses a wildcard', async () => {
      const { client } = stub(page());
      const error = await client.searchDocuments({ query: '*' }).catch((e: Error) => e);

      // A refusal that does not name a working alternative just moves the dead end.
      expect(error.message).toMatch(/a\*/);
      expect(error.message).toMatch(/recordTypes/);
      expect(error.message).toMatch(/aha:\/\//);
    });

    it('still allows a wildcard inside a real term', async () => {
      const { client, calls } = stub(page());
      await client.searchDocuments({ query: 'APPO11Y*', projectId: 'ws-1' });

      expect(calls[0].body.variables.filters).toEqual({
        query: 'APPO11Y*',
        projectId: 'ws-1'
      });
    });
  });

  describe('pagination', () => {
    it('defaults to 20 per page', async () => {
      const { client, calls } = stub(page());
      await client.searchDocuments({ query: 'a' });

      expect(calls[0].body.variables.per).toBe(20);
      expect(calls[0].body.variables.page).toBe(1);
    });

    it('clamps per to the server maximum', async () => {
      const { client, calls } = stub(page());
      await client.searchDocuments({ query: 'a', per: 5000 });

      expect(calls[0].body.variables.per).toBe(MAX_PER_PAGE);
    });

    it('raises per to the server floor, which silently does this anyway', async () => {
      const { client, calls } = stub(page());
      // Asking for 4 returns 10 from Aha, so promise 10 rather than 4.
      await client.searchDocuments({ query: 'a', per: 4 });

      expect(calls[0].body.variables.per).toBe(MIN_PER_PAGE);
    });

    it('clamps nonsensical paging values', async () => {
      const { client, calls } = stub(page());
      await client.searchDocuments({ query: 'a', per: 0, page: 0 });

      expect(calls[0].body.variables.per).toBe(MIN_PER_PAGE);
      expect(calls[0].body.variables.page).toBe(1);
    });
  });

  describe('results', () => {
    it('maps hits and paging metadata', async () => {
      const { client } = stub(page());
      const r = await client.searchDocuments({ query: 'alert' });

      expect(r.totalCount).toBe(3);
      expect(r.isLastPage).toBe(true);
      expect(r.results[0]).toMatchObject({
        name: 'Alerting: silence by label',
        searchableType: 'Idea',
        searchableId: '123'
      });
    });

    it('flags a saturated total count instead of implying an exact total', async () => {
      const { client } = stub(page({ totalCount: TOTAL_COUNT_CEILING }));
      const r = await client.searchDocuments({ query: 'the' });

      expect(r.totalCountIsCapped).toBe(true);
    });

    it('does not flag a total below the ceiling', async () => {
      const { client } = stub(page({ totalCount: 9999 }));
      expect((await client.searchDocuments({ query: 'the' })).totalCountIsCapped).toBe(false);
    });

    it('tolerates a null node list', async () => {
      const { client } = stub(page({ nodes: null }));
      expect((await client.searchDocuments({ query: 'a' })).results).toEqual([]);
    });
  });

  describe('record links', () => {
    const withUrl = (url: unknown) =>
      page({
        nodes: [
          {
            name: 'Alerting: silence by label',
            searchableId: '123',
            searchableType: 'Idea',
            projectId: 'p1',
            url,
            updatedAt: '2026-08-01T00:00:00Z'
          }
        ]
      });

    const firstUrl = async (url: unknown) => {
      const { client } = stub(withUrl(url));
      return (await client.searchDocuments({ query: 'alert' })).results[0].url;
    };

    it('resolves the app path against the account host', async () => {
      expect(await firstUrl('/ideas/ideas/IDEA-1')).toBe('https://acme.aha.io/ideas/ideas/IDEA-1');
    });

    it('leaves an absolute url alone, should Aha start returning one', async () => {
      expect(await firstUrl('https://acme.aha.io/features/PRJ1-1')).toBe(
        'https://acme.aha.io/features/PRJ1-1'
      );
    });

    it('does not lose the separator on a path with no leading slash', async () => {
      expect(await firstUrl('features/PRJ1-1')).toBe('https://acme.aha.io/features/PRJ1-1');
    });

    it('passes an empty url through rather than emitting a bare host', async () => {
      expect(await firstUrl('')).toBe('');
    });

    it('exposes the account host', () => {
      const { client } = stub(page());
      expect(client.host()).toBe('https://acme.aha.io');
    });
  });

  describe('error reporting', () => {
    it('surfaces GraphQL errors, which arrive with HTTP 200', async () => {
      const { client } = stub({ errors: [{ message: 'Must pass a project ID' }] });
      await expect(client.searchDocuments({ query: 'a' })).rejects.toThrow(/Must pass a project ID/);
    });

    it('reports a rejected token distinctly', async () => {
      const { client } = stub({}, 401);
      await expect(client.searchDocuments({ query: 'a' })).rejects.toThrow(/401/);
    });

    it('reports a forbidden query as a possible licensing issue', async () => {
      const { client } = stub({}, 403);
      await expect(client.searchDocuments({ query: 'a' })).rejects.toThrow(/403/);
    });

    it('reports a non-JSON response rather than throwing a parse error', async () => {
      const client = new AhaGraphQLClient({
        credentials: () => ({ subdomain: 'acme', accessToken: 'tok' }),
        fetchImpl: async () => new Response('<html>gateway error</html>', { status: 502 })
      });
      await expect(client.searchDocuments({ query: 'a' })).rejects.toThrow(/non-JSON|502/);
    });
  });

  describe('SEARCHABLE_TYPES', () => {
    it('matches the live SearchableDocument union', () => {
      expect(SEARCHABLE_TYPES).toHaveLength(20);
      // Types confirmed to return results on a real account.
      for (const t of ['Idea', 'Feature', 'Epic', 'Initiative', 'Goal', 'KeyResult', 'Page', 'Comment', 'Task']) {
        expect(SEARCHABLE_TYPES).toContain(t as any);
      }
    });
  });
});
