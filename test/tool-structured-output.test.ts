import { describe, it, expect, afterEach } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from '../src/core/tools.js';
import { registerSearchTools } from '../src/core/tools/search-tools.js';
import { AhaService } from '../src/core/services/aha-service.js';
import type { AhaGraphQLClient } from '../src/core/services/aha-graphql.js';

/**
 * These go through a real MCP client rather than calling handlers directly, because the
 * client is what validates `structuredContent` against the advertised `outputSchema` and
 * throws when they disagree. A call that returns at all is therefore the conformance
 * assertion; the expects below are about content.
 */
async function connected(register: (server: McpServer) => void) {
  const server = new McpServer({ name: 'aha-test', version: '1.0.0' });
  register(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

// A record with the fields the output schemas describe, plus the ones they do not: the
// extras are the point, since a closed schema would reject them at call time.
const FEATURE = {
  id: '6971110726488350000',
  reference_num: 'PRJ1-123',
  name: 'Structured output',
  url: 'https://test.aha.io/features/PRJ1-123',
  resource: 'https://test.aha.io/api/v1/features/PRJ1-123',
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-08-02T10:00:00.000Z',
  progress: 40,
  score: 12,
  workflow_status: { id: '1', name: 'In development', complete: false },
  description: { id: '2', body: '<p>nested object, undescribed by the schema</p>' },
  custom_fields: [{ key: 'team', value: 'platform' }]
};

describe('Tool structured output', () => {
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

  it('advertises an output schema on every tool', async () => {
    const client = await connected(registerTools);
    const tools = (await client.listTools()).tools;

    const without = tools.filter(t => !t.outputSchema).map(t => t.name);
    expect(without).toEqual([]);
  });

  it('leaves record schemas open so undescribed Aha fields survive the round trip', async () => {
    const client = await connected(registerTools);
    const tools = (await client.listTools()).tools;
    const schema = tools.find(t => t.name === 'aha_update_feature')!.outputSchema as any;

    // additionalProperties: false here would make every record-returning tool fail on the
    // first field Aha adds that the schema does not list.
    expect(schema.additionalProperties).not.toBe(false);
    expect(Object.keys(schema.properties)).toContain('reference_num');
  });

  it('returns the record as structuredContent, and a one-line summary in the text block', async () => {
    patch('updateFeature', async () => FEATURE);
    const client = await connected(registerTools);

    const result: any = await client.callTool({
      name: 'aha_update_feature',
      arguments: { featureId: 'PRJ1-123', featureData: { feature: { name: 'Structured output' } } }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(FEATURE);

    // The record travels in structuredContent, so the text block says what happened rather
    // than repeating it - a JSON copy here doubled the payload for no added information.
    expect(result.content[0].text).toBe(
      'Updated feature PRJ1-123 "Structured output" - https://test.aha.io/features/PRJ1-123'
    );
    expect(result.content[0].text).not.toContain('"progress"');
  });

  it('links the touched record with a display title and a freshness annotation', async () => {
    patch('updateFeature', async () => FEATURE);
    const client = await connected(registerTools);

    const result: any = await client.callTool({
      name: 'aha_update_feature',
      arguments: { featureId: 'PRJ1-123', featureData: { feature: { name: 'Structured output' } } }
    });

    const link = result.content.find((c: any) => c.type === 'resource_link');
    expect(link).toBeDefined();
    expect(link.uri).toBe('aha://feature/PRJ1-123');
    // Hosts display `title` in preference to `name`, so both are set.
    expect(link.name).toBe('Structured output');
    expect(link.title).toBe('PRJ1-123 - Structured output');
    expect(link.annotations.audience).toEqual(['user', 'assistant']);
    expect(link.annotations.priority).toBe(1);
    expect(link.annotations.lastModified).toBe('2026-08-02T10:00:00.000Z');
  });

  it('describes deletions rather than returning an empty body', async () => {
    patch('deleteFeature', async () => undefined);
    const client = await connected(registerTools);

    const result: any = await client.callTool({
      name: 'aha_delete_feature',
      arguments: { featureId: 'PRJ1-123' }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      deleted: true,
      record_type: 'feature',
      id: 'PRJ1-123'
    });
  });

  it('omits structuredContent on failures and flags them with isError', async () => {
    patch('updateFeature', async () => {
      throw new Error('Request failed with status code 404');
    });
    const client = await connected(registerTools);

    const result: any = await client.callTool({
      name: 'aha_update_feature',
      arguments: { featureId: 'NOPE-1', featureData: { feature: { name: 'x' } } }
    });

    // Output validation is skipped for error results, which is what lets a tool with an
    // output schema report a failure at all.
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toContain('404');
  });

  it('survives a create endpoint that answers with no body', async () => {
    patch('createFeature', async () => undefined);
    const client = await connected(registerTools);

    const result: any = await client.callTool({
      name: 'aha_create_feature',
      arguments: { releaseId: 'PRJ1-R-1', featureData: { feature: { name: 'no body back' } } }
    });

    // An absent structuredContent would be a protocol error, so the tool sends {}.
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({});
  });

  it('links the record it touched, so the client can re-read it as a resource', async () => {
    patch('updateFeature', async () => FEATURE);
    const client = await connected(registerTools);

    const result: any = await client.callTool({
      name: 'aha_update_feature',
      arguments: { featureId: 'PRJ1-123', featureData: { feature: { name: 'Structured output' } } }
    });

    const link = result.content.find((c: any) => c.type === 'resource_link');
    expect(link).toBeDefined();
    // reference_num over id: it is the identifier people recognise, and the resource
    // template accepts either.
    expect(link.uri).toBe('aha://feature/PRJ1-123');
    expect(link.name).toBe('Structured output');
  });

  it('falls back to the requested id when the response carries no identifier', async () => {
    patch('updateFeatureProgress', async () => ({ progress: 60 }));
    const client = await connected(registerTools);

    const result: any = await client.callTool({
      name: 'aha_update_feature_progress',
      arguments: { featureId: 'PRJ1-123', progress: 60 }
    });

    const link = result.content.find((c: any) => c.type === 'resource_link');
    expect(link.uri).toBe('aha://feature/PRJ1-123');
  });

  it('emits no link when there is no identifier to link to', async () => {
    patch('createFeature', async () => undefined);
    const client = await connected(registerTools);

    const result: any = await client.callTool({
      name: 'aha_create_feature',
      arguments: { releaseId: 'PRJ1-R-1', featureData: { feature: { name: 'no body back' } } }
    });

    // A resource_link to aha://feature/undefined would be worse than none at all.
    expect(result.content.some((c: any) => c.type === 'resource_link')).toBe(false);
  });

  it('unwraps the responses Aha nests under a single key', async () => {
    const idea = { id: '123', reference_num: 'PRJ1-I-4', name: 'Wrapped idea', score: 3 };
    patch('createIdea', async () => ({ idea }));
    const client = await connected(registerTools);

    const result: any = await client.callTool({
      name: 'aha_create_idea',
      arguments: { productId: 'PRJ1', ideaData: { idea: { name: 'Wrapped idea' } } }
    });

    // Aha answers idea creation with { idea: {...} }. structuredContent is the record
    // itself, so one contract holds whether or not a record type arrives wrapped.
    expect(result.structuredContent).toEqual(idea);
    const link = result.content.find((c: any) => c.type === 'resource_link');
    expect(link.uri).toBe('aha://idea/PRJ1-I-4');
  });

  it('returns the search envelope as structured content', async () => {
    const fakeClient = {
      searchDocuments: async () => ({
        totalCount: 2,
        totalCountIsCapped: false,
        currentPage: 1,
        totalPages: 1,
        isLastPage: true,
        results: [
          {
            name: 'Login flow',
            searchableType: 'Feature',
            searchableId: '7446889503515556446',
            referenceNum: 'PRJ1-1',
            projectId: '123',
            url: 'https://test.aha.io/features/PRJ1-1',
            updatedAt: '2026-08-01T10:00:00.000Z',
            score: null,
            votes: null,
            endorsements: null
          },
          {
            // A hit with the nullable fields actually null, which the schema allows.
            name: null,
            searchableType: 'Idea',
            searchableId: null,
            referenceNum: null,
            projectId: null,
            url: 'https://test.aha.io/ideas/PRJ1-I-1',
            updatedAt: '2026-08-02T10:00:00.000Z',
            score: null,
            votes: null,
            endorsements: null
          }
        ]
      })
    } as unknown as AhaGraphQLClient;

    const client = await connected(server => registerSearchTools(server, fakeClient));
    const result: any = await client.callTool({
      name: 'aha_search',
      arguments: { query: 'login' }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.total_count).toBe(2);
    expect(result.structuredContent.total_count_is_capped).toBe(false);
    expect(result.structuredContent.record_types).toBe('all');
    expect(result.structuredContent.workspace_id).toBeNull();
    expect(result.structuredContent.results).toHaveLength(2);
    expect(result.structuredContent.results[0].url).toBe('https://test.aha.io/features/PRJ1-1');
  });

  it('renders search hits as markdown links rather than repeating the payload', async () => {
    const fakeClient = {
      searchDocuments: async () => ({
        totalCount: 2,
        totalCountIsCapped: false,
        currentPage: 1,
        totalPages: 1,
        isLastPage: true,
        results: [
          {
            name: 'Login flow',
            searchableType: 'Feature',
            searchableId: '7446889503515556446',
            referenceNum: 'PRJ1-1',
            projectId: '123',
            url: 'https://test.aha.io/features/PRJ1-1',
            updatedAt: '2026-08-01T10:00:00.000Z',
            score: null,
            votes: null,
            endorsements: null
          },
          {
            name: null,
            searchableType: 'Idea',
            searchableId: null,
            referenceNum: null,
            projectId: null,
            url: 'https://test.aha.io/ideas/PRJ1-I-1',
            updatedAt: '2026-08-02T10:00:00.000Z',
            score: null,
            votes: null,
            endorsements: null
          }
        ]
      })
    } as unknown as AhaGraphQLClient;

    const client = await connected(server => registerSearchTools(server, fakeClient));
    const result: any = await client.callTool({ name: 'aha_search', arguments: { query: 'login' } });

    // Building the links here is what keeps the model from re-emitting - and mangling - a
    // URL it only ever needed to pass through.
    // The label leads with the reference number, because that is what a follow-up read needs
    // and the part that goes missing when it is reconstructed from a url path.
    expect(result.content[0].text).toBe(
      '2 matches for "login":\n' +
        '- [PRJ1-1 Login flow](https://test.aha.io/features/PRJ1-1) - Feature\n' +
        '- [Untitled](https://test.aha.io/ideas/PRJ1-I-1) - Idea'
    );
  });

  it('says so plainly when a search matches nothing', async () => {
    const fakeClient = {
      searchDocuments: async () => ({
        totalCount: 0,
        totalCountIsCapped: false,
        currentPage: 1,
        totalPages: 0,
        isLastPage: true,
        results: []
      })
    } as unknown as AhaGraphQLClient;

    const client = await connected(server => registerSearchTools(server, fakeClient));
    const result: any = await client.callTool({ name: 'aha_search', arguments: { query: 'nope' } });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe('No matches for "nope".');
    expect(result.structuredContent.results).toEqual([]);
  });
});
