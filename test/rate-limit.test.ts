import { describe, it, expect } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import * as z from 'zod/v4';
import {
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  TokenBucket,
  configuredRateLimit,
  installToolRateLimit
} from '../src/core/rate-limit.js';

describe('TokenBucket', () => {
  it('allows a full burst, then refuses', () => {
    const bucket = new TokenBucket({ perMinute: 3, now: () => 0 });

    expect(bucket.take()).toBeNull();
    expect(bucket.take()).toBeNull();
    expect(bucket.take()).toBeNull();
    expect(bucket.take()).not.toBeNull();
  });

  it('reports a wait long enough that a token is there afterwards', () => {
    let now = 0;
    const bucket = new TokenBucket({ perMinute: 60, now: () => now });

    expect(bucket.take()).toBeNull();
    // Drain the remaining 59 tokens without advancing the clock.
    for (let i = 0; i < 59; i++) bucket.take();

    const wait = bucket.take();
    expect(wait).not.toBeNull();

    now += wait! * 1000;
    expect(bucket.take()).toBeNull();
  });

  it('refills continuously rather than in windows', () => {
    let now = 0;
    const bucket = new TokenBucket({ perMinute: 60, now: () => now });
    for (let i = 0; i < 60; i++) bucket.take();
    expect(bucket.take()).not.toBeNull();

    // 60/minute is one a second, so a second buys exactly one call, not a fresh window.
    now += 1000;
    expect(bucket.take()).toBeNull();
    expect(bucket.take()).not.toBeNull();
  });

  it('never refills beyond its capacity', () => {
    let now = 0;
    const bucket = new TokenBucket({ perMinute: 2, now: () => now });
    now += 60 * 60 * 1000;

    expect(bucket.take()).toBeNull();
    expect(bucket.take()).toBeNull();
    expect(bucket.take()).not.toBeNull();
  });
});

describe('configuredRateLimit', () => {
  it('defaults when unset', () => {
    expect(configuredRateLimit({})).toBe(DEFAULT_RATE_LIMIT_PER_MINUTE);
    expect(configuredRateLimit({ MCP_TOOL_RATE_LIMIT_PER_MINUTE: '' })).toBe(DEFAULT_RATE_LIMIT_PER_MINUTE);
  });

  it('reads an explicit limit, including 0 for disabled', () => {
    expect(configuredRateLimit({ MCP_TOOL_RATE_LIMIT_PER_MINUTE: '30' })).toBe(30);
    expect(configuredRateLimit({ MCP_TOOL_RATE_LIMIT_PER_MINUTE: '0' })).toBe(0);
  });

  it('falls back to the default on nonsense rather than refusing to start', () => {
    expect(configuredRateLimit({ MCP_TOOL_RATE_LIMIT_PER_MINUTE: 'lots' })).toBe(DEFAULT_RATE_LIMIT_PER_MINUTE);
    expect(configuredRateLimit({ MCP_TOOL_RATE_LIMIT_PER_MINUTE: '-5' })).toBe(DEFAULT_RATE_LIMIT_PER_MINUTE);
  });
});

describe('installToolRateLimit', () => {
  const connect = async (perMinute: number, now?: () => number) => {
    const server = new McpServer({ name: 'aha-test', version: '1.0.0' });
    const bucket = installToolRateLimit(server, { perMinute, now });

    let calls = 0;
    server.registerTool(
      'counted',
      {
        title: 'Counted',
        description: 'Counts invocations that got past the limiter',
        inputSchema: { value: z.string().optional() },
        annotations: { title: 'Counted', readOnlyHint: true, openWorldHint: false }
      },
      async () => {
        calls += 1;
        return { content: [{ type: 'text' as const, text: `call ${calls}` }] };
      }
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return { client, bucket, calls: () => calls };
  };

  it('refuses over-budget calls as tool errors, not protocol errors', async () => {
    const { client, calls } = await connect(2, () => 0);

    expect((await client.callTool({ name: 'counted', arguments: {} })).isError).toBeFalsy();
    expect((await client.callTool({ name: 'counted', arguments: {} })).isError).toBeFalsy();

    const refused: any = await client.callTool({ name: 'counted', arguments: {} });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain('Rate limit reached');
    // Actionable for a model: it says how long to wait.
    expect(refused.content[0].text).toMatch(/Retry counted in \d+ seconds?/);

    // The handler never ran for the refused call.
    expect(calls()).toBe(2);
  });

  it('lets calls through again once the bucket refills', async () => {
    let now = 0;
    const { client } = await connect(60, () => now);
    for (let i = 0; i < 60; i++) await client.callTool({ name: 'counted', arguments: {} });

    expect((await client.callTool({ name: 'counted', arguments: {} })).isError).toBe(true);

    now += 2000;
    expect((await client.callTool({ name: 'counted', arguments: {} })).isError).toBeFalsy();
  });

  it('does not install a bucket when the limit is 0', async () => {
    const { client, bucket } = await connect(0, () => 0);
    expect(bucket).toBeNull();

    for (let i = 0; i < 5; i++) {
      expect((await client.callTool({ name: 'counted', arguments: {} })).isError).toBeFalsy();
    }
  });

  it('leaves arguments and results untouched for calls it allows', async () => {
    const server = new McpServer({ name: 'aha-test', version: '1.0.0' });
    installToolRateLimit(server, { perMinute: 10, now: () => 0 });

    server.registerTool(
      'echo',
      {
        title: 'Echo',
        description: 'Echoes its argument',
        inputSchema: { value: z.string() },
        outputSchema: z.looseObject({ value: z.string() }),
        annotations: { title: 'Echo', readOnlyHint: true, openWorldHint: false }
      },
      async ({ value }) => ({
        content: [{ type: 'text' as const, text: value }],
        structuredContent: { value }
      })
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result: any = await client.callTool({ name: 'echo', arguments: { value: 'through' } });
    expect(result.content[0].text).toBe('through');
    expect(result.structuredContent).toEqual({ value: 'through' });
  });
});
