import { describe, it, expect, afterEach, afterAll } from 'bun:test';
import { TestMCPClient, sharedTestClient } from './utils/mcp-client-helper';

/**
 * These tests share one server for the whole file rather than spawning one each - see
 * sharedTestClient for why. The two timeouts still have to stay in step for the tests that
 * do start their own: the `timeout` passed to the client is the *total* readiness budget,
 * which the helper splits across three attempts on fresh ports, and the bun timeout on each
 * `it` has to cover all three plus the teardown between them. Lowering the latter back to
 * 20s reintroduces the flake this was set to fix - a starved spawn on CI failed the whole
 * run, and took a release with it (#317).
 */
describe('E2E Streamable HTTP Transport', () => {
  let client: TestMCPClient | null = null;

  // One HTTP server for the file; see sharedTestClient. The tests that assert on a failed
  // connection still build their own client, above.
  const shared = sharedTestClient({ mode: 'streamable-http', timeout: 15000 });
  afterAll(() => shared.close());

  afterEach(async () => {
    if (client && client.isConnected()) {
      await client.disconnect();
    }
    client = null;
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Basic Connectivity', () => {
    it('should connect via Streamable HTTP and get server info', async () => {
      client = new TestMCPClient();
      await client.connect({ mode: 'streamable-http', timeout: 15000 });

      expect(client.isConnected()).toBe(true);

      const capabilities = client.getServerCapabilities();
      expect(capabilities).toBeDefined();

      const version = client.getServerVersion();
      expect(version).toBeDefined();
      expect(version.name).toContain('Aha');
    }, 30000); // Timeout for CI environments

    it('should handle multiple sequential requests', async () => {
      await shared.use(async (client) => {
        // First request
        const resources1 = await client.listResources();
        expect(Array.isArray(resources1)).toBe(true);

        // Second request
        const resources2 = await client.listResources();
        expect(Array.isArray(resources2)).toBe(true);

        // Should get same results
        expect(resources1.length).toBe(resources2.length);
      });
    }, 30000); // Timeout for CI environments
  });

  describe('Resource Operations', () => {
    it('should list resources via HTTP', async () => {
      await shared.use(async (client) => {
        const resources = await client.listResources();

        expect(Array.isArray(resources)).toBe(true);
        expect(resources.length).toBeGreaterThan(0);

        const ahaResource = resources.find(r => r.uri.startsWith('aha://'));
        expect(ahaResource).toBeDefined();
      });
    }, 30000);

    it('should read the resource guide via HTTP', async () => {
      await shared.use(async (client) => {
        const contents = await client.readResource('aha://resources');

        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);

        const content = contents[0];
        expect(content.mimeType).toBe('application/json');

        const data = JSON.parse(content.text!);
        expect(data.synonyms).toBeDefined();
        expect(data.terminology_guide).toBeDefined();
      });
    }, 35000);
  });

  describe('Prompt Operations', () => {
    it('should list prompts via HTTP', async () => {
      await shared.use(async (client) => {
        const prompts = await client.listPrompts();

        expect(Array.isArray(prompts)).toBe(true);
        expect(prompts.length).toBeGreaterThan(0);

        const discoveryPrompt = prompts.find(p => p.name === 'aha_resource_discovery');
        expect(discoveryPrompt).toBeDefined();
      });
    }, 30000);

    it('should give every prompt a display title', async () => {
      await shared.use(async (client) => {
        const prompts = await client.listPrompts();

        // Prompts are user-controlled, surfaced as slash commands, so the label a person
        // picks from should not be the underscore name.
        const untitled = prompts.filter(p => !p.title).map(p => p.name);
        expect(untitled).toEqual([]);

        for (const prompt of prompts) {
          expect(typeof prompt.title).toBe('string');
          expect(prompt.title).not.toBe(prompt.name);
        }

        const discovery = prompts.find(p => p.name === 'aha_resource_discovery');
        expect(discovery.title).toBe('Find the right Aha resource');
      });
    }, 30000);

    it('should complete a workspace argument via HTTP', async () => {
      await shared.use(async (client) => {
        // The spawned server runs against MockAhaService, whose workspaces are PROD1..PROD3.
        const values = await client.complete('product_roadmap', 'product_id', 'PROD');

        expect(values).toContain('PROD1');
      });
    }, 30000);

    it('should offer nothing for an unknown workspace rather than erroring', async () => {
      await shared.use(async (client) => {
        const values = await client.complete('product_roadmap', 'product_id', 'zzzznope');

        expect(values).toEqual([]);
      });
    }, 30000);

    it('should get a prompt via HTTP', async () => {
      await shared.use(async (client) => {
        const messages = await client.getPrompt('aha_resource_discovery', {
          search_query: 'workspaces'
        });

        expect(messages).toBeDefined();
        expect(Array.isArray(messages)).toBe(true);
        expect(messages.length).toBeGreaterThan(0);
      });
    }, 30000);
  });

  describe('Server Instructions', () => {
    it('should return instructions in the initialize response', async () => {
      await shared.use(async (client) => {
        const instructions = client.getInstructions();

        expect(instructions).toBeDefined();
        // Says what the server is, and asks for links rather than descriptions.
        expect(instructions).toContain('reference_num');
        expect(instructions).toMatch(/markdown link/i);
        // The spawned server runs with AHA_COMPANY=test-company, so the configured
        // subdomain should have made it into the initialize response.
        expect(instructions).toContain('https://test-company.aha.io');
      });
    }, 30000);
  });

  describe('Tool Operations', () => {
    it('should list tools via HTTP', async () => {
      await shared.use(async (client) => {
        const tools = await client.listTools();

        expect(Array.isArray(tools)).toBe(true);
        expect(tools.length).toBeGreaterThan(0);

        // Check for a known tool
        const createFeatureComment = tools.find(t => t.name === 'aha_create_feature_comment');
        expect(createFeatureComment).toBeDefined();
      });
    }, 30000);

    it('should annotate every tool with behaviour hints', async () => {
      await shared.use(async (client) => {
        const tools = await client.listTools();

        const unannotated = tools.filter(t => !t.annotations).map(t => t.name);
        expect(unannotated).toEqual([]);

        for (const tool of tools) {
          const annotations = tool.annotations!;
          expect(typeof annotations.title).toBe('string');
          expect(typeof annotations.readOnlyHint).toBe('boolean');
          expect(typeof annotations.openWorldHint).toBe('boolean');

          // destructiveHint and idempotentHint are only meaningful for writers,
          // so read-only tools deliberately leave them unset.
          if (annotations.readOnlyHint) {
            expect(annotations.destructiveHint).toBeUndefined();
            expect(annotations.idempotentHint).toBeUndefined();
          } else {
            expect(typeof annotations.destructiveHint).toBe('boolean');
            expect(typeof annotations.idempotentHint).toBe('boolean');
          }
        }

        const search = tools.find(t => t.name === 'aha_search');
        expect(search?.annotations?.readOnlyHint).toBe(true);

        const deleteFeature = tools.find(t => t.name === 'aha_delete_feature');
        expect(deleteFeature?.annotations?.readOnlyHint).toBe(false);
        expect(deleteFeature?.annotations?.destructiveHint).toBe(true);

        const createFeature = tools.find(t => t.name === 'aha_create_feature');
        expect(createFeature?.annotations?.destructiveHint).toBe(false);
        expect(createFeature?.annotations?.idempotentHint).toBe(false);
      });
    }, 30000);

    it('should give every tool a display title in both spec locations', async () => {
      await shared.use(async (client) => {
        const tools = await client.listTools();

        // Tool.title is the current spec field; annotations.title is what pre-2025-06-18
        // clients read, and the spec gives it precedence over `name` when `title` is
        // absent. Both are populated so no client falls back to the underscored name -
        // this asserts they stay in step rather than drifting apart.
        const untitled = tools.filter(t => !t.title).map(t => t.name);
        expect(untitled).toEqual([]);

        for (const tool of tools) {
          expect(tool.title).toBe(tool.annotations!.title);
        }
      });
    }, 30000);

    it('should declare a JSON Schema dialect the spec permits', async () => {
      await shared.use(async (client) => {
        const tools = await client.listTools();

        // The SDK converts Zod with a hardcoded draft-07 target, which the spec allows as an
        // explicit dialect even though it recommends 2020-12. Pinned so an SDK upgrade that
        // changes the target shows up here rather than in a client.
        const dialects = new Set(
          tools.map(t => (t.inputSchema as any).$schema ?? '2020-12 (no $schema, per spec default)')
        );
        for (const dialect of dialects) {
          expect(['http://json-schema.org/draft-07/schema#', '2020-12 (no $schema, per spec default)'])
            .toContain(dialect);
        }

        for (const tool of tools) {
          // MUST be a valid schema object with an object root.
          expect((tool.inputSchema as any).type).toBe('object');
        }

        // Output schemas are relabelled to 2020-12 by installOutputSchemaDialect, because a
        // validator implementing only the recommended dialect rejects the tool outright rather
        // than degrading - which is what happened in Claude Code, to every tool at once. Run
        // over the spawned server so the tools registered in server.ts (server_status and the
        // configuration tools) are covered too, not just the ones registerTools adds.
        const outputDialects = tools.map(t => ({
          name: t.name,
          dialect: (t.outputSchema as any)?.$schema
        }));
        expect(outputDialects.filter(t => t.dialect !== 'https://json-schema.org/draft/2020-12/schema'))
          .toEqual([]);
      });
    }, 30000);

    it('should accept a call on a no-argument tool with arguments omitted', async () => {
      await shared.use(async (client) => {
        // `arguments` is optional in CallToolRequest, so leaving it out must not read as a
        // malformed request.
        const result: any = await client.callToolWithoutArguments('server_status');

        expect(result.isError).toBeFalsy();
        expect(result.structuredContent?.version).toBeDefined();
      });
    }, 30000);

    it('should call a tool via HTTP', async () => {
      await shared.use(async (client) => {
        // Use a simple tool that doesn't require complex setup
        const result = await client.callTool('aha_create_feature_comment', {
          featureId: 'TEST-1',
          body: 'Test comment'
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
      });
    }, 30000);
  });

  describe('HTTP-Specific Features', () => {
    it('should have correct health endpoint response', async () => {
      client = new TestMCPClient();
      await client.connect({ mode: 'streamable-http', timeout: 15000 });

      // Access internal httpBaseUrl for testing
      const baseUrl = (client as any).httpBaseUrl;
      const response = await fetch(`${baseUrl}/health`);

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.transport).toBe('streamable-http');
      expect(data.protocolVersion).toBe('2025-06-18');
    }, 30000);

    it('should have correct status endpoint response', async () => {
      client = new TestMCPClient();
      await client.connect({ mode: 'streamable-http', timeout: 15000 });

      const baseUrl = (client as any).httpBaseUrl;
      const response = await fetch(`${baseUrl}/status`);

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.name).toContain('Aha');
      expect(data.transport).toBe('streamable-http');
      expect(data.endpoints).toBeDefined();
      expect(data.endpoints.mcp).toBeDefined();
    }, 30000);

    it('should support CORS headers', async () => {
      client = new TestMCPClient();
      await client.connect({ mode: 'streamable-http', timeout: 15000 });

      const baseUrl = (client as any).httpBaseUrl;
      const response = await fetch(`${baseUrl}/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET'
        }
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      client = new TestMCPClient();

      // Try to connect with very short timeout
      await expect(
        client.connect({ mode: 'streamable-http', timeout: 100 })
      ).rejects.toThrow();
    }, 10000);

    it('should handle invalid requests', async () => {
      await shared.use(async (client) => {
        // Try to read non-existent resource
        await expect(
          client.readResource('aha://invalid-resource')
        ).rejects.toThrow();
      });
    }, 30000);
  });
});
