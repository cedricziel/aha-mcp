import { describe, it, expect, afterEach } from 'bun:test';
import { TestMCPClient, withTestClient } from './utils/mcp-client-helper';

describe('E2E Streamable HTTP Transport', () => {
  let client: TestMCPClient | null = null;

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
    }, 20000); // Timeout for CI environments

    it('should handle multiple sequential requests', async () => {
      await withTestClient(async (client) => {
        // First request
        const resources1 = await client.listResources();
        expect(Array.isArray(resources1)).toBe(true);

        // Second request
        const resources2 = await client.listResources();
        expect(Array.isArray(resources2)).toBe(true);

        // Should get same results
        expect(resources1.length).toBe(resources2.length);
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000); // Timeout for CI environments
  });

  describe('Resource Operations', () => {
    it('should list resources via HTTP', async () => {
      await withTestClient(async (client) => {
        const resources = await client.listResources();

        expect(Array.isArray(resources)).toBe(true);
        expect(resources.length).toBeGreaterThan(0);

        const ahaResource = resources.find(r => r.uri.startsWith('aha://'));
        expect(ahaResource).toBeDefined();
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should read the resource guide via HTTP', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://resources');

        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);

        const content = contents[0];
        expect(content.mimeType).toBe('application/json');

        const data = JSON.parse(content.text!);
        expect(data.synonyms).toBeDefined();
        expect(data.terminology_guide).toBeDefined();
      }, { mode: 'streamable-http', timeout: 20000 });
    }, 25000);
  });

  describe('Prompt Operations', () => {
    it('should list prompts via HTTP', async () => {
      await withTestClient(async (client) => {
        const prompts = await client.listPrompts();

        expect(Array.isArray(prompts)).toBe(true);
        expect(prompts.length).toBeGreaterThan(0);

        const discoveryPrompt = prompts.find(p => p.name === 'aha_resource_discovery');
        expect(discoveryPrompt).toBeDefined();
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should give every prompt a display title', async () => {
      await withTestClient(async (client) => {
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
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should complete a workspace argument via HTTP', async () => {
      await withTestClient(async (client) => {
        // The spawned server runs against MockAhaService, whose workspaces are PROD1..PROD3.
        const values = await client.complete('product_roadmap', 'product_id', 'PROD');

        expect(values).toContain('PROD1');
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should offer nothing for an unknown workspace rather than erroring', async () => {
      await withTestClient(async (client) => {
        const values = await client.complete('product_roadmap', 'product_id', 'zzzznope');

        expect(values).toEqual([]);
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should get a prompt via HTTP', async () => {
      await withTestClient(async (client) => {
        const messages = await client.getPrompt('aha_resource_discovery', {
          search_query: 'workspaces'
        });

        expect(messages).toBeDefined();
        expect(Array.isArray(messages)).toBe(true);
        expect(messages.length).toBeGreaterThan(0);
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);
  });

  describe('Server Instructions', () => {
    it('should return instructions in the initialize response', async () => {
      await withTestClient(async (client) => {
        const instructions = client.getInstructions();

        expect(instructions).toBeDefined();
        // Says what the server is, and asks for links rather than descriptions.
        expect(instructions).toContain('reference_num');
        expect(instructions).toMatch(/markdown link/i);
        // The spawned server runs with AHA_COMPANY=test-company, so the configured
        // subdomain should have made it into the initialize response.
        expect(instructions).toContain('https://test-company.aha.io');
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);
  });

  describe('Tool Operations', () => {
    it('should list tools via HTTP', async () => {
      await withTestClient(async (client) => {
        const tools = await client.listTools();

        expect(Array.isArray(tools)).toBe(true);
        expect(tools.length).toBeGreaterThan(0);

        // Check for a known tool
        const createFeatureComment = tools.find(t => t.name === 'aha_create_feature_comment');
        expect(createFeatureComment).toBeDefined();
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should annotate every tool with behaviour hints', async () => {
      await withTestClient(async (client) => {
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
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should give every tool a display title in both spec locations', async () => {
      await withTestClient(async (client) => {
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
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should declare a JSON Schema dialect the spec permits', async () => {
      await withTestClient(async (client) => {
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
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should accept a call on a no-argument tool with arguments omitted', async () => {
      await withTestClient(async (client) => {
        // `arguments` is optional in CallToolRequest, so leaving it out must not read as a
        // malformed request.
        const result: any = await client.callToolWithoutArguments('server_status');

        expect(result.isError).toBeFalsy();
        expect(result.structuredContent?.version).toBeDefined();
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);

    it('should call a tool via HTTP', async () => {
      await withTestClient(async (client) => {
        // Use a simple tool that doesn't require complex setup
        const result = await client.callTool('aha_create_feature_comment', {
          featureId: 'TEST-1',
          body: 'Test comment'
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);
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
    }, 20000);

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
    }, 20000);

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
    }, 20000);
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
      await withTestClient(async (client) => {
        // Try to read non-existent resource
        await expect(
          client.readResource('aha://invalid-resource')
        ).rejects.toThrow();
      }, { mode: 'streamable-http', timeout: 15000 });
    }, 20000);
  });
});
