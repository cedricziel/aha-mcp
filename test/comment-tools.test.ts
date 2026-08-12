import { describe, it, expect, afterEach } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerCommentTools } from '../src/core/tools/comment-tools.js';
import { AhaService } from '../src/core/services/aha-service.js';

/**
 * Comment tools.
 *
 * The load-bearing assertion in here is that an idea's two comment streams both arrive and
 * stay distinguishable. Aha keeps internal comments at /ideas/{id}/comments and the
 * ideas-portal conversation at /ideas/{id}/idea_comments; the sets are disjoint, and reading
 * only the first looks complete while dropping whatever a customer wrote. The rest is about
 * not publishing to customers by accident.
 *
 * Calls go through a real MCP client, which validates structuredContent against the
 * advertised outputSchema - so a call that returns at all is the conformance assertion.
 */
async function connected() {
  const server = new McpServer({ name: 'aha-test', version: '1.0.0' });
  registerCommentTools(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const INTERNAL = {
  comments: [
    {
      id: '7469723628198768234',
      body: '<p>Given we are going to merge App O11y with asserts, this is next quarter.</p>',
      created_at: '2026-02-02T10:00:00.000Z',
      user: { id: '1', name: 'Cedric Ziel' },
      commentable: { id: '2', type: 'Idea' }
    }
  ]
};

const PORTAL = {
  idea_comments: [
    {
      id: '7667211158746962968',
      idea_id: 'PRJ1-I-7',
      body: '<p>Why are we rejecting this idea? Isn&#x27;t Grafana meant to be open?</p>',
      visibility: 'Visible to all ideas portal users',
      created_at: '2026-01-01T10:00:00.000Z',
      idea_commenter_portal_user: { email: 'customer@example.com' }
    }
  ]
};

describe('Comment tools', () => {
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

  it('registers a reader, an internal writer and a portal writer', async () => {
    const client = await connected();
    const names = (await client.listTools()).tools.map(t => t.name).sort();

    expect(names).toEqual(['aha_create_comment', 'aha_create_idea_portal_comment', 'aha_list_comments']);
  });

  it('reads both of an idea\'s comment streams and labels each one', async () => {
    patch('getIdeaComments', async () => INTERNAL);
    patch('getIdeaPortalComments', async () => PORTAL);
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_comments',
      arguments: { recordType: 'idea', recordId: 'PRJ1-I-7' }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.comment_count).toBe(2);
    expect(result.structuredContent.includes_portal_comments).toBe(true);
    expect(result.structuredContent.comments.map((c: any) => c.source)).toEqual([
      // Oldest first: the customer's portal question precedes the internal reply.
      'portal',
      'internal'
    ]);
    expect(result.structuredContent.comments[0].visibility).toBe('Visible to all ideas portal users');
  });

  it('renders each comment with source, visibility, author and an excerpt', async () => {
    patch('getIdeaComments', async () => INTERNAL);
    patch('getIdeaPortalComments', async () => PORTAL);
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_comments',
      arguments: { recordType: 'idea', recordId: 'PRJ1-I-7' }
    });

    const text = result.content[0].text;
    expect(text).toContain('2 comments on idea PRJ1-I-7, internal and ideas portal');
    expect(text).toContain('- portal [Visible to all ideas portal users] - customer@example.com:');
    expect(text).toContain('- internal - Cedric Ziel:');
    // Bodies are HTML; the summary is for reading, so tags and entities are resolved.
    expect(text).toContain("Isn't Grafana meant to be open?");
    expect(text).not.toContain('<p>');
  });

  it('reads the internal stream alone when portal comments are declined', async () => {
    patch('getIdeaComments', async () => INTERNAL);
    patch('getIdeaPortalComments', async () => {
      throw new Error('portal stream must not be read when includePortalComments is false');
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_comments',
      arguments: { recordType: 'idea', recordId: 'PRJ1-I-7', includePortalComments: false }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.comment_count).toBe(1);
    expect(result.structuredContent.includes_portal_comments).toBe(false);
  });

  /**
   * Only ideas have a portal stream. Reporting `includes_portal_comments: false` on the other
   * types keeps a zero from being read as "there is no portal conversation here".
   */
  it('never claims a portal read for record types that have no portal', async () => {
    patch('getFeatureComments', async () => INTERNAL);
    patch('getIdeaPortalComments', async () => {
      throw new Error('a feature has no portal comment stream');
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_comments',
      arguments: { recordType: 'feature', recordId: 'PRJ1-123' }
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.includes_portal_comments).toBe(false);
    expect(result.structuredContent.comments[0].source).toBe('internal');
  });

  it('reads comments for every record type it advertises', async () => {
    const calls: string[] = [];
    for (const method of [
      'getFeatureComments',
      'getIdeaComments',
      'getEpicComments',
      'getInitiativeComments',
      'getGoalComments',
      'getReleaseComments',
      'getReleasePhaseComments',
      'getRequirementComments',
      'getTodoComments',
      'getProductComments'
    ] as const) {
      patch(method, async () => {
        calls.push(method);
        return { comments: [] };
      });
    }
    patch('getIdeaPortalComments', async () => ({ idea_comments: [] }));
    const client = await connected();

    const types = ['feature', 'idea', 'epic', 'initiative', 'goal', 'release', 'release_phase', 'requirement', 'todo', 'product'];
    for (const recordType of types) {
      const result: any = await client.callTool({
        name: 'aha_list_comments',
        arguments: { recordType, recordId: 'X-1' }
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.record_type).toBe(recordType);
    }

    expect(calls).toHaveLength(types.length);
  });

  it('links the parent record with the URI segment its resource template uses', async () => {
    patch('getReleasePhaseComments', async () => ({ comments: [] }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_comments',
      arguments: { recordType: 'release_phase', recordId: 'PRJ1-RP-2' }
    });

    // The argument is release_phase; the resource is aha://release-phase/{id}. A link built
    // from the argument spelling would point at a template that does not match.
    const link = result.content.find((c: any) => c.type === 'resource_link');
    expect(link.uri).toBe('aha://release-phase/PRJ1-RP-2');
  });

  it('adds an internal comment and says that is what it did', async () => {
    let received: unknown;
    patch('createEpicComment', async (_id: string, body: string) => {
      received = body;
      return { id: 'C-1', body, created_at: '2026-08-12T10:00:00.000Z' };
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_create_comment',
      arguments: { recordType: 'epic', recordId: 'PRJ1-E-4', body: '<p>Scoped for Q3.</p>' }
    });

    expect(result.isError).toBeFalsy();
    expect(received).toBe('<p>Scoped for Q3.</p>');
    expect(result.structuredContent.id).toBe('C-1');
    // "internal" is stated rather than implied: the whole point is that this is not the
    // customer-facing write.
    expect(result.content[0].text).toBe('Added internal comment to epic PRJ1-E-4: Scoped for Q3.');
  });

  it('offers no internal write for product comments, which Aha has no endpoint for', async () => {
    const client = await connected();
    const tool = (await client.listTools()).tools.find(t => t.name === 'aha_create_comment')!;
    const recordType = (tool.inputSchema as any).properties.recordType;

    expect(recordType.enum).not.toContain('product');
    expect(recordType.enum).toContain('feature');
  });

  it('requires visibility on a portal comment rather than defaulting it', async () => {
    patch('createIdeaPortalComment', async () => ({ id: 'IC-1' }));
    const client = await connected();

    // Aha defaults visibility to public, i.e. to customers. Omitting it here has to fail
    // rather than quietly publish.
    const result: any = await client.callTool({
      name: 'aha_create_idea_portal_comment',
      arguments: { ideaId: 'PRJ1-I-7', body: '<p>Thanks!</p>' }
    });

    expect(result.isError).toBe(true);
  });

  it('passes visibility through and names the audience it just wrote to', async () => {
    const seen: string[] = [];
    patch('createIdeaPortalComment', async (_id: string, body: string, visibility: string) => {
      seen.push(visibility);
      return { id: 'IC-2', idea_id: 'PRJ1-I-7', body, visibility };
    });
    const client = await connected();

    const pub: any = await client.callTool({
      name: 'aha_create_idea_portal_comment',
      arguments: { ideaId: 'PRJ1-I-7', body: '<p>We reconsidered.</p>', visibility: 'public' }
    });
    const limited: any = await client.callTool({
      name: 'aha_create_idea_portal_comment',
      arguments: { ideaId: 'PRJ1-I-7', body: '<p>Internal-ish.</p>', visibility: 'employee_or_creator' }
    });

    expect(seen).toEqual(['public', 'employee_or_creator']);
    expect(pub.content[0].text).toContain('visible to all ideas portal users');
    expect(limited.content[0].text).toContain("visible to employees and the idea's creator");
    expect(pub.content.find((c: any) => c.type === 'resource_link').uri).toBe('aha://idea/PRJ1-I-7');
  });

  it('rejects a visibility value Aha does not accept', async () => {
    patch('createIdeaPortalComment', async () => ({ id: 'IC-3' }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_create_idea_portal_comment',
      arguments: { ideaId: 'PRJ1-I-7', body: '<p>x</p>', visibility: 'internal' }
    });

    expect(result.isError).toBe(true);
  });

  it('annotates the reader read-only and both writers as non-idempotent writes', async () => {
    const client = await connected();
    const tools = (await client.listTools()).tools;

    const reader = tools.find(t => t.name === 'aha_list_comments')!;
    expect(reader.annotations!.readOnlyHint).toBe(true);
    expect(reader.annotations!.destructiveHint).toBeUndefined();
    expect(reader.annotations!.idempotentHint).toBeUndefined();

    for (const name of ['aha_create_comment', 'aha_create_idea_portal_comment']) {
      const writer = tools.find(t => t.name === name)!;
      expect(writer.annotations!.readOnlyHint).toBe(false);
      // A repeated call adds another comment; it does not replace the first.
      expect(writer.annotations!.idempotentHint).toBe(false);
      expect(writer.annotations!.destructiveHint).toBe(false);
    }

    for (const tool of tools) {
      expect(tool.title).toBe(tool.annotations!.title as string);
      expect(tool.outputSchema).toBeDefined();
      expect(tool.annotations!.openWorldHint).toBe(true);
    }
  });

  it('reports a failed read as isError, naming the record', async () => {
    patch('getFeatureComments', async () => {
      throw Object.assign(new Error('Request failed with status code 404'), {
        isAxiosError: true,
        response: { status: 404, headers: {} }
      });
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_comments',
      arguments: { recordType: 'feature', recordId: 'PRJ1-123' }
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toContain('feature PRJ1-123');
    // Aha 404s both for absent records and for ones the token cannot see.
    expect(result.content[0].text).toContain('cannot see');
  });

  it('reports a failed portal write as isError without claiming it published', async () => {
    patch('createIdeaPortalComment', async () => {
      throw Object.assign(new Error('Request failed with status code 403'), {
        isAxiosError: true,
        response: { status: 403, headers: {} }
      });
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_create_idea_portal_comment',
      arguments: { ideaId: 'PRJ1-I-7', body: '<p>x</p>', visibility: 'public' }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('403');
    expect(result.content[0].text).not.toContain('Added portal comment');
  });

  it('says so plainly when a record has no comments at all', async () => {
    patch('getIdeaComments', async () => ({ comments: [] }));
    patch('getIdeaPortalComments', async () => ({ idea_comments: [] }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_comments',
      arguments: { recordType: 'idea', recordId: 'PRJ1-I-9' }
    });

    // Naming both streams matters: "no comments" alone would leave a caller unsure whether
    // the portal side was even looked at.
    expect(result.content[0].text).toBe(
      'No comments on idea PRJ1-I-9 (internal or ideas portal).'
    );
    expect(result.structuredContent.comments).toEqual([]);
  });
});
