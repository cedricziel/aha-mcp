import { describe, it, expect } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '../src/core/tools.js';
import { registerSearchTools } from '../src/core/tools/search-tools.js';

const newServer = (name = 'test-server') =>
  new McpServer({ name, version: '1.0.0' }, { capabilities: {} });

describe('MCP Tools Registration', () => {
  describe('Core Tools Registration', () => {
    it('should register all core tools without throwing errors', () => {
      expect(() => registerTools(newServer())).not.toThrow();
    });

    it('should detect duplicate tool registration', () => {
      const server = newServer();

      expect(() => registerTools(server)).not.toThrow();
      // Registering again should throw due to duplicate tool names
      expect(() => registerTools(server)).toThrow();
    });
  });

  describe('Search Tools Registration', () => {
    it('should register search tools without throwing errors', () => {
      expect(() => registerSearchTools(newServer())).not.toThrow();
    });

    it('should be included in the core registration', () => {
      const server = newServer();
      registerTools(server);

      // registerTools calls registerSearchTools, so a second direct call collides.
      expect(() => registerSearchTools(server)).toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid server gracefully', () => {
      expect(() => registerSearchTools(null as any)).toThrow();
    });

    it('should handle empty server gracefully', () => {
      // Should still register tools even with minimal server info
      expect(() => registerTools(newServer(''))).not.toThrow();
    });
  });

  describe('Tool Registration Validation', () => {
    it('should complete core tools registration successfully', () => {
      const server = newServer('validation-server');

      let registrationCompleted = false;
      try {
        registerTools(server);
        registrationCompleted = true;
      } catch (error) {
        console.error('Registration failed:', error);
      }

      expect(registrationCompleted).toBe(true);
    });

    it('should register aha_search among the core tools', () => {
      const server = newServer('search-validation-server');
      registerTools(server);

      const registered = Object.keys((server as any)._registeredTools ?? {});
      expect(registered).toContain('aha_search');
    });

    it('should no longer register the removed sync and embedding tools', () => {
      const server = newServer('removed-tools-server');
      registerTools(server);

      const registered = Object.keys((server as any)._registeredTools ?? {});
      const removed = registered.filter(name =>
        /^aha_(sync_|generate_embed|embedding_|pause_embed|stop_embed|semantic_search|generate_entity_embed|find_similar|vector_status|get_entity_embed|delete_entity_embed)/.test(
          name
        )
      );
      expect(removed).toEqual([]);
    });
  });
});
