import { describe, it, expect, afterEach } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerGoalTools } from '../src/core/tools/goal-tools.js';
import { registerRecordTools } from '../src/core/tools/record-tools.js';
import { AhaService } from '../src/core/services/aha-service.js';

/**
 * Goal and key result tools - Aha's own model of an OKR.
 *
 * Calls go through a real MCP client, because the client is what validates
 * `structuredContent` against the advertised `outputSchema`: a call that returns at all is
 * itself the conformance assertion. The record fixtures below are trimmed copies of what a
 * live account returns, including the two shapes that surprised this implementation - a goal
 * with no top-level `workflow_status`, and a key result with no `url`.
 */
async function connected() {
  const server = new McpServer({ name: 'aha-test', version: '1.0.0' });
  registerGoalTools(server);
  registerRecordTools(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** A goal as Aha returns one: status lives under success_metric, not at the top level. */
const GOAL = {
  id: '7612778824262504715',
  reference_num: 'COMPANY1-G-8',
  name: 'Achieve Core 4 targets',
  url: 'https://test.aha.io/strategic_imperatives/COMPANY1-G-8',
  product_id: '7386671125809128444',
  progress: 0,
  progress_source: 'progress_manual',
  updated_at: '2026-08-02T10:00:00.000Z',
  time_frame: { id: '7592743972694344319', name: 'FY27' },
  success_metric: {
    name: null,
    workflow_status: { id: '1', name: 'On track', complete: false }
  },
  key_results: [{ id: 'KR-1', reference_num: 'COMPANY1-G-8-KR-1', name: 'Active users' }]
};

/** A key result as Aha returns one. No `url` and no `resource` - measured, not assumed. */
const KEY_RESULT = {
  id: '7612778881209601719',
  reference_num: 'COMPANY1-G-8-KR-1',
  name: 'Active users',
  position: 1,
  progress: 30,
  starting_metric: '0%',
  current_metric: '30%',
  target_metric: '90%',
  updated_at: '2026-08-02T10:00:00.000Z',
  workflow_status: { id: '1', name: 'On track', complete: false }
};

describe('Goal and key result tools', () => {
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

  it('registers a writer for every OKR operation, and a reader beside each', async () => {
    const client = await connected();
    const names = (await client.listTools()).tools.map(t => t.name);

    // Every type with a write tool must have a read tool: a client that surfaces tools but
    // not resources would otherwise be able to overwrite an objective it cannot read.
    expect(names).toContain('aha_get_goal');
    expect(names).toContain('aha_get_key_result');
    expect(names.filter(n => n.includes('goal') || n.includes('key_result')).sort()).toEqual([
      'aha_create_goal',
      'aha_create_key_result',
      'aha_delete_goal',
      'aha_delete_key_result',
      'aha_get_goal',
      'aha_get_key_result',
      'aha_list_key_results',
      'aha_update_goal',
      'aha_update_key_result'
    ]);
  });

  it('creates a goal in the workspace it was told to, and links the result', async () => {
    const calls: any[] = [];
    patch('createGoal', async (productId: string, goalData: any) => {
      calls.push({ productId, goalData });
      return { goal: GOAL };
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_create_goal',
      arguments: {
        productId: 'PRJ1',
        goalData: { goal: { name: 'Achieve Core 4 targets', time_frame: 'FY27' } }
      }
    });

    expect(result.isError).toBeFalsy();
    expect(calls[0].productId).toBe('PRJ1');
    expect(calls[0].goalData.goal.time_frame).toBe('FY27');
    // Unwrapped: structuredContent is the goal itself, never Aha's `{ goal: ... }` wrapper.
    expect(result.structuredContent.reference_num).toBe('COMPANY1-G-8');
    expect(result.structuredContent).not.toHaveProperty('goal');
    const link = result.content.find((c: any) => c.type === 'resource_link');
    expect(link.uri).toBe('aha://goal/COMPANY1-G-8');
  });

  it('reads a goal status out of its success metric, where Aha actually keeps it', async () => {
    patch('getGoal', async () => ({ goal: GOAL }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_get_goal',
      arguments: { goalId: 'COMPANY1-G-8' }
    });

    // A goal has no top-level workflow_status, so a summary that only looked there would
    // report no status at all for every goal in the account.
    expect(result.content[0].text).toBe(
      'Read goal COMPANY1-G-8 "Achieve Core 4 targets" (On track) - ' +
        'https://test.aha.io/strategic_imperatives/COMPANY1-G-8'
    );
    expect(result.structuredContent.product_id).toBe('7386671125809128444');
  });

  it('passes productId through to the update only when given one', async () => {
    const calls: any[] = [];
    patch('updateGoal', async (goalId: string, goalData: any, productId?: string) => {
      calls.push({ goalId, goalData, productId });
      return { goal: GOAL };
    });
    const client = await connected();

    await client.callTool({
      name: 'aha_update_goal',
      arguments: { goalId: 'COMPANY1-G-8', goalData: { goal: { workflow_status: 'On track' } } }
    });
    await client.callTool({
      name: 'aha_update_goal',
      arguments: {
        goalId: 'COMPANY1-G-8',
        goalData: { goal: { progress: 40 } },
        productId: '7386671125809128444'
      }
    });

    // Aha documents the update as workspace-scoped; the account-level route is the default,
    // so an omitted productId must stay omitted rather than becoming a guess.
    expect(calls[0].productId).toBeUndefined();
    expect(calls[1].productId).toBe('7386671125809128444');
  });

  it('names the workspace in a goal deletion, and reports the type it deleted', async () => {
    const calls: any[] = [];
    patch('deleteGoal', async (productId: string, goalId: string) => {
      calls.push({ productId, goalId });
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_delete_goal',
      arguments: { productId: 'PRJ1', goalId: 'COMPANY1-G-8' }
    });

    expect(calls[0]).toEqual({ productId: 'PRJ1', goalId: 'COMPANY1-G-8' });
    expect(result.structuredContent).toEqual({
      deleted: true,
      record_type: 'goal',
      id: 'COMPANY1-G-8'
    });
  });

  it('lists key results as readable lines with a link each', async () => {
    patch('listKeyResults', async () => ({
      key_results: [KEY_RESULT, { ...KEY_RESULT, id: 'KR-2', reference_num: 'COMPANY1-G-8-KR-2', name: 'Retention', current_metric: null, target_metric: null, workflow_status: { name: 'Not started' } }],
      pagination: { total_records: 2, total_pages: 1, current_page: 1 }
    }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_key_results',
      arguments: { goalId: 'COMPANY1-G-8' }
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe(
      '2 key results on goal COMPANY1-G-8:\n' +
        '- COMPANY1-G-8-KR-1 "Active users" (On track, 30% of 90%)\n' +
        '- COMPANY1-G-8-KR-2 "Retention" (Not started)'
    );
    // A key result has no url, so these links are the only pointer a client can follow -
    // and unlike aha_search, every record in the result gets one.
    const links = result.content.filter((c: any) => c.type === 'resource_link');
    expect(links.map((l: any) => l.uri)).toEqual([
      'aha://key_result/COMPANY1-G-8-KR-1',
      'aha://key_result/COMPANY1-G-8-KR-2'
    ]);
    expect(result.structuredContent.goal_id).toBe('COMPANY1-G-8');
    expect(result.structuredContent.pagination.total_records).toBe(2);
  });

  it('says so plainly when a goal has no key results', async () => {
    patch('listKeyResults', async () => ({ key_results: [], pagination: { total_records: 0 } }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_list_key_results',
      arguments: { goalId: 'COMPANY1-G-8' }
    });

    expect(result.content[0].text).toBe('Goal COMPANY1-G-8 has no key results');
    expect(result.structuredContent.key_results).toEqual([]);
  });

  it('summarises a key result by its metrics, and does not invent a url for it', async () => {
    patch('getKeyResult', async () => ({ key_result: KEY_RESULT }));
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_get_key_result',
      arguments: { keyResultId: 'COMPANY1-G-8-KR-1' }
    });

    expect(result.content[0].text).toBe(
      'Read key result COMPANY1-G-8-KR-1 "Active users" (On track, 30% of 90%)'
    );
    expect(result.structuredContent).not.toHaveProperty('url');
    const link = result.content.find((c: any) => c.type === 'resource_link');
    expect(link.uri).toBe('aha://key_result/COMPANY1-G-8-KR-1');
    expect(link.annotations.lastModified).toBe('2026-08-02T10:00:00.000Z');
  });

  it('accepts a key result status as a bare name as well as an object', async () => {
    const calls: any[] = [];
    patch('updateKeyResult', async (keyResultId: string, keyResultData: any) => {
      calls.push({ keyResultId, keyResultData });
      return { key_result: KEY_RESULT };
    });
    const client = await connected();

    // Both must be accepted by the input schema: a caller re-grading an OKR has a status
    // name in hand, one echoing back a record it just read has the object.
    for (const workflow_status of ['On track', { name: 'On track' }] as const) {
      const result: any = await client.callTool({
        name: 'aha_update_key_result',
        arguments: {
          keyResultId: 'COMPANY1-G-8-KR-1',
          keyResultData: { key_result: { workflow_status, current_metric: '30%' } }
        }
      });
      expect(result.isError).toBeFalsy();
    }

    expect(calls).toHaveLength(2);
    expect(calls[0].keyResultData.key_result.current_metric).toBe('30%');
  });

  it('annotates the readers and writers the way the spec gives the hints meaning', async () => {
    const client = await connected();
    const tools = (await client.listTools()).tools;
    const byName = new Map(tools.map(t => [t.name, t]));

    const listKeyResults = byName.get('aha_list_key_results')!;
    expect(listKeyResults.annotations!.readOnlyHint).toBe(true);
    // Only meaningful for writers, so omitted on a reader.
    expect(listKeyResults.annotations!.destructiveHint).toBeUndefined();
    expect(listKeyResults.annotations!.idempotentHint).toBeUndefined();

    for (const name of ['aha_delete_goal', 'aha_delete_key_result']) {
      expect(byName.get(name)!.annotations!.destructiveHint).toBe(true);
    }
    for (const name of ['aha_create_goal', 'aha_create_key_result']) {
      // A repeated create makes another record.
      expect(byName.get(name)!.annotations!.idempotentHint).toBe(false);
    }
    for (const name of ['aha_update_goal', 'aha_update_key_result']) {
      expect(byName.get(name)!.annotations!.idempotentHint).toBe(true);
      expect(byName.get(name)!.annotations!.destructiveHint).toBe(false);
    }
    for (const tool of tools) {
      expect(tool.annotations!.openWorldHint).toBe(true);
      // Hosts read one or the other depending on their spec version.
      expect(tool.title).toBe(tool.annotations!.title as string);
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it('reports a failed write as isError, naming the record and not the cause it cannot know', async () => {
    patch('updateKeyResult', async () => {
      // Shaped like the axios error aha-js throws.
      throw Object.assign(new Error('Request failed with status code 404'), {
        isAxiosError: true,
        response: { status: 404, headers: {} }
      });
    });
    const client = await connected();

    const result: any = await client.callTool({
      name: 'aha_update_key_result',
      arguments: {
        keyResultId: 'COMPANY1-G-8-KR-9',
        keyResultData: { key_result: { current_metric: '50%' } }
      }
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toContain('COMPANY1-G-8-KR-9');
    // Aha returns 404 for a record the token cannot see as well as for one that is absent.
    expect(result.content[0].text).toContain('cannot see');
  });
});
