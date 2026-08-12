import { describe, it, expect, afterEach } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerRecordTools } from '../src/core/tools/record-tools.js';
import { AhaService } from '../src/core/services/aha-service.js';

/**
 * The single-record read tools.
 *
 * These exist because reads offered only as `aha://` resources are unreachable on a host
 * that does not surface resources to its model - which left this server presenting write
 * tools alongside one search that returns six fields, none of them workflow status, release
 * membership or custom field values. The assertions below are mostly about that: the fields
 * a caller needs before writing have to arrive, both in `structuredContent` and in the text
 * block, since a client may show only one of them.
 *
 * Calls go through a real MCP client, because the client is what validates
 * `structuredContent` against the advertised `outputSchema` - so a call that returns at all
 * is itself the conformance assertion.
 */
async function connected() {
  const server = new McpServer({ name: 'aha-test', version: '1.0.0' });
  registerRecordTools(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/**
 * A feature as Aha actually returns one, trimmed. `custom_fields` and `assigned_to_user` are
 * undescribed by the output schema and must survive anyway - they are the reason these tools
 * exist, and a closed schema would reject them at call time.
 */
const FEATURE = {
  id: '6971110726488350000',
  reference_num: 'APPO11Y-16',
  name: 'Per-service blocking',
  url: 'https://test.aha.io/features/APPO11Y-16',
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-08-02T10:00:00.000Z',
  progress: 40,
  score: 80,
  workflow_status: { id: '7386770842053906242', name: 'Backlog', complete: false },
  release_reference_num: 'APPO11Y-R-3',
  assigned_to_user: { id: '1', name: 'Ada Lovelace' },
  custom_fields: [
    { name: 'Launch Tier', value: 'Tier 3' },
    { name: 'VoC Prioritization Score', value: 80 }
  ]
};

describe('Single-record read tools', () => {
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

  it('registers a reader for every type that has a single-record resource', async () => {
    const client = await connected();
    const names = (await client.listTools()).tools.map(t => t.name).sort();

    expect(names).toEqual([
      'aha_get_epic',
      'aha_get_feature',
      'aha_get_goal',
      'aha_get_idea',
      'aha_get_initiative',
      'aha_get_key_result',
      'aha_get_release'
    ]);
  });

  it('returns the whole record, including fields the schema does not describe', async () => {
    patch('getFeature', async () => FEATURE);
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_get_feature',
      arguments: { featureId: 'APPO11Y-16' }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual(FEATURE);
    // The three fields aha_search cannot return, which is the whole point of the tool.
    expect(result.structuredContent.workflow_status.name).toBe('Backlog');
    expect(result.structuredContent.release_reference_num).toBe('APPO11Y-R-3');
    expect(result.structuredContent.custom_fields).toContainEqual({
      name: 'Launch Tier',
      value: 'Tier 3'
    });
  });

  it('names status, release and assignee in the text block', async () => {
    patch('getFeature', async () => FEATURE);
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_get_feature',
      arguments: { featureId: 'APPO11Y-16' }
    });

    // A client that drops structuredContent still has to see the values that decide whether
    // a write is safe, so the summary carries them rather than only the record's name.
    expect(result.content[0].text).toBe(
      'Read feature APPO11Y-16 "Per-service blocking" ' +
        '(Backlog, release APPO11Y-R-3, assigned to Ada Lovelace) - ' +
        'https://test.aha.io/features/APPO11Y-16'
    );
  });

  it('summarises a record with no status, release or assignee without empty parentheses', async () => {
    patch('getEpic', async () => ({ reference_num: 'PRJ1-E-4', name: 'Bare epic' }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_get_epic',
      arguments: { epicId: 'PRJ1-E-4' }
    });

    expect(result.content[0].text).toBe('Read epic PRJ1-E-4 "Bare epic"');
  });

  it('reads a status Aha hands back as a bare string', async () => {
    // The output schema admits a string as well as an object; the summary has to too.
    patch('getIdea', async () => ({ idea: { reference_num: 'PRJ1-I-7', name: 'Idea', workflow_status: 'New' } }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_get_idea',
      arguments: { ideaId: 'PRJ1-I-7' }
    });

    expect(result.content[0].text).toBe('Read idea PRJ1-I-7 "Idea" (New)');
  });

  it('unwraps the records Aha nests under a single key', async () => {
    patch('getIdea', async () => ({ idea: { reference_num: 'PRJ1-I-7', name: 'Wrapped idea' } }));
    patch('getInitiative', async () => ({
      initiative: { reference_num: 'PRJ1-S-2', name: 'Wrapped initiative' }
    }));
    patch('getRelease', async () => ({
      release: { reference_num: 'PRJ1-R-3', name: 'Wrapped release', progress: 0 }
    }));
    const client = await connected();

    for (const [tool, arg, id, name] of [
      ['aha_get_idea', 'ideaId', 'PRJ1-I-7', 'Wrapped idea'],
      ['aha_get_initiative', 'initiativeId', 'PRJ1-S-2', 'Wrapped initiative'],
      ['aha_get_release', 'releaseId', 'PRJ1-R-3', 'Wrapped release']
    ] as const) {
      const result: any = await client.callTool({ name: tool, arguments: { [arg]: id } });

      expect(result.structuredContent.reference_num).toBe(id);
      expect(result.structuredContent).not.toHaveProperty('idea');
      expect(result.content[0].text).toContain(`"${name}"`);
    }
  });

  it('links each record to a resource URI a client can actually read', async () => {
    patch('getRelease', async () => ({
      release: {
        reference_num: 'PRJ1-R-3',
        name: 'Parked',
        updated_at: '2026-08-02T10:00:00.000Z'
      }
    }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_get_release',
      arguments: { releaseId: 'PRJ1-R-3' }
    });

    const link = result.content.find((c: any) => c.type === 'resource_link');
    // aha://release/{id} is a registered resource template; a link to an unreadable URI
    // would be worse than none.
    expect(link.uri).toBe('aha://release/PRJ1-R-3');
    expect(link.title).toBe('PRJ1-R-3 - Parked');
    expect(link.annotations.lastModified).toBe('2026-08-02T10:00:00.000Z');
  });

  it('falls back to the requested id when Aha returns no identifier', async () => {
    patch('getFeature', async () => ({}));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_get_feature',
      arguments: { featureId: 'APPO11Y-16' }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({});
    const link = result.content.find((c: any) => c.type === 'resource_link');
    expect(link.uri).toBe('aha://feature/APPO11Y-16');
  });

  it('annotates the readers as read-only, leaving the writer-only hints unset', async () => {
    const client = await connected();
    const tools = (await client.listTools()).tools;

    for (const tool of tools) {
      expect(tool.annotations!.readOnlyHint).toBe(true);
      expect(tool.annotations!.openWorldHint).toBe(true);
      // The spec only gives these meaning for tools that write.
      expect(tool.annotations!.destructiveHint).toBeUndefined();
      expect(tool.annotations!.idempotentHint).toBeUndefined();
      // Hosts read one or the other depending on their spec version.
      expect(tool.title).toBe(tool.annotations!.title as string);
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it('reports a failure as isError, without claiming the record does not exist', async () => {
    patch('getFeature', async () => {
      // Shaped like the axios error aha-js throws: describeAhaError reads the status off
      // response, not out of the message, so a bare Error would not exercise the mapping.
      throw Object.assign(new Error('Request failed with status code 404'), {
        isAxiosError: true,
        response: { status: 404, headers: {} }
      });
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_get_feature',
      arguments: { featureId: 'APPO11Y-16' }
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    // Aha returns 404 for a record the token cannot see as well as one that is absent, so
    // the message must not resolve that ambiguity for the caller.
    expect(result.content[0].text).toContain('404');
    expect(result.content[0].text).toContain('cannot see');
    // And it names which record failed, not just that one did.
    expect(result.content[0].text).toContain('APPO11Y-16');
  });
});
