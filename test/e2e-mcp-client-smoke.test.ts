import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { TestMCPClient, withTestClient } from './utils/mcp-client-helper';

/**
 * Smoke test to verify the E2E test infrastructure works
 * This test verifies that we can spawn a real server, connect with a real MCP client,
 * and execute basic operations.
 */

describe('E2E MCP Client - Smoke Test', () => {
  let client: TestMCPClient | null = null;

  afterEach(async () => {
    if (client && client.isConnected()) {
      await client.disconnect();
    }
    client = null;

    // Wait a bit to ensure process cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should connect to the server and get server info', async () => {
    client = new TestMCPClient();
    await client.connect({ timeout: 15000 });

    expect(client.isConnected()).toBe(true);

    const capabilities = client.getServerCapabilities();
    expect(capabilities).toBeDefined();

    const version = client.getServerVersion();
    expect(version).toBeDefined();
    expect(version.name).toContain('Aha');
  });

  it('should list resources', async () => {
    await withTestClient(async (client) => {
      const resources = await client.listResources();

      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);

      // Should have resources with aha:// scheme
      const ahaResource = resources.find(r => r.uri.startsWith('aha://'));
      expect(ahaResource).toBeDefined();
    }, { timeout: 15000 });
  });

  it('should read the resource guide', async () => {
    await withTestClient(async (client) => {
      try {
        const contents = await client.readResource('aha://resources');

        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);

        const content = contents[0];
        expect(content.mimeType).toBe('application/json');

        const data = JSON.parse(content.text!);
        expect(data.synonyms).toBeDefined();
        expect(data.terminology_guide).toBeDefined();
        expect(data.common_questions).toBeDefined();
      } catch (error) {
        console.error('Full error:', error);
        throw error;
      }
    }, { timeout: 20000 });
  });

  it('should list prompts', async () => {
    await withTestClient(async (client) => {
      const prompts = await client.listPrompts();

      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);

      // Should have resource discovery prompt
      const discoveryPrompt = prompts.find(p => p.name === 'aha_resource_discovery');
      expect(discoveryPrompt).toBeDefined();
    }, { timeout: 15000 });
  });

  it('should get a prompt', async () => {
    await withTestClient(async (client) => {
      try {
        const messages = await client.getPrompt('aha_resource_discovery', {
          search_query: 'show me workspaces'
        });

        expect(Array.isArray(messages)).toBe(true);
        expect(messages.length).toBeGreaterThan(0);

        const message = messages[0];
        expect(message.role).toBe('user');
        expect(message.content.text).toContain('workspace');
      } catch (error) {
        console.error('Full error:', error);
        console.error('Error code:', (error as any).code);
        console.error('Error message:', (error as any).message);
        throw error;
      }
    }, { timeout: 20000 });
  });
});
