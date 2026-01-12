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
    });

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
    });
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
    });

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
    });
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
    });

    it('should get a prompt via HTTP', async () => {
      await withTestClient(async (client) => {
        const messages = await client.getPrompt('aha_resource_discovery', {
          search_query: 'workspaces'
        });

        expect(messages).toBeDefined();
        expect(Array.isArray(messages)).toBe(true);
        expect(messages.length).toBeGreaterThan(0);
      }, { mode: 'streamable-http', timeout: 15000 });
    });
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
    });

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
    });
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
    });

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
    });

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
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      client = new TestMCPClient();

      // Try to connect with very short timeout
      await expect(
        client.connect({ mode: 'streamable-http', timeout: 100 })
      ).rejects.toThrow();
    });

    it('should handle invalid requests', async () => {
      await withTestClient(async (client) => {
        // Try to read non-existent resource
        await expect(
          client.readResource('aha://invalid-resource')
        ).rejects.toThrow();
      }, { mode: 'streamable-http', timeout: 15000 });
    });
  });
});
