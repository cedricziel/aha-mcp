import { describe, it, expect } from 'bun:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '../src/core/tools.js';
import { registerSyncTools } from '../src/core/tools/sync-tools.js';
import { registerEmbeddingTools } from '../src/core/tools/embedding-tools.js';

describe('MCP Tools Registration', () => {
  describe('Core Tools Registration', () => {
    it('should register all core tools without throwing errors', () => {
      const server = new McpServer(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: {} }
      );

      // The main test - registration should not throw
      expect(() => registerTools(server)).not.toThrow();
    });

    it('should detect duplicate tool registration', () => {
      const server = new McpServer(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: {} }
      );

      // Register once
      expect(() => registerTools(server)).not.toThrow();
      
      // Registering again should throw due to duplicate tool names
      expect(() => registerTools(server)).toThrow();
    });
  });

  describe('Sync Tools Registration', () => {
    it('should register sync tools without throwing errors', () => {
      const server = new McpServer(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: {} }
      );

      // Mock minimal services for registration
      const mockSyncService = {
        getSyncProgress: () => Promise.resolve(null),
        getSyncHistory: () => Promise.resolve([]),
        getActiveSyncs: () => Promise.resolve([]),
        getHealthStatus: () => Promise.resolve({ errors: [], activeSyncs: 0 }),
        startSync: () => Promise.resolve('test-job'),
        pauseSync: () => Promise.resolve(),
        stopSync: () => Promise.resolve(),
        cleanupOldSyncJobs: () => Promise.resolve(0),
      };

      const mockDatabaseService = {
        getSyncStatusSummary: () => Promise.resolve({}),
        getHealthStatus: () => Promise.resolve({ connected: true }),
        getConfig: () => Promise.resolve({}),
        updateConfig: () => Promise.resolve(),
      };

      expect(() => registerSyncTools(server, mockSyncService as any, mockDatabaseService as any)).not.toThrow();
    });
  });

  describe('Embedding Tools Registration', () => {
    it('should register embedding tools without throwing errors', () => {
      const server = new McpServer(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: {} }
      );

      expect(() => registerEmbeddingTools(server)).not.toThrow();
    });
  });

  describe('Combined Registration', () => {
    it('should register all tool types together without conflicts', () => {
      const server = new McpServer(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: {} }
      );

      // This tests the full registration flow that happens in production
      // registerTools already includes sync and embedding tools internally
      expect(() => registerTools(server)).not.toThrow();
    });

    it('should detect duplicate registrations on server reuse', () => {
      const server = new McpServer(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: {} }
      );

      // First registration should succeed
      expect(() => registerTools(server)).not.toThrow();
      
      // Subsequent registrations should fail due to duplicates
      expect(() => registerTools(server)).toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid server gracefully', () => {
      // This tests that our tool registration functions handle edge cases
      expect(() => registerEmbeddingTools(null as any)).toThrow();
    });

    it('should handle empty server gracefully', () => {
      const server = new McpServer(
        { name: '', version: '' },
        { capabilities: {} }
      );

      // Should still register tools even with minimal server info
      expect(() => registerTools(server)).not.toThrow();
    });
  });

  describe('Tool Registration Validation', () => {
    it('should complete core tools registration successfully', () => {
      const server = new McpServer(
        { name: 'validation-server', version: '1.0.0' },
        { capabilities: {} }
      );

      // This is the key test - no exceptions should be thrown during registration
      let registrationCompleted = false;
      
      try {
        registerTools(server);
        registrationCompleted = true;
      } catch (error) {
        console.error('Registration failed:', error);
      }

      expect(registrationCompleted).toBe(true);
    });

    it('should complete sync tools registration successfully', () => {
      const server = new McpServer(
        { name: 'sync-validation-server', version: '1.0.0' },
        { capabilities: {} }
      );

      const mockServices = {
        getSyncProgress: () => Promise.resolve(null),
        getSyncHistory: () => Promise.resolve([]),
        getActiveSyncs: () => Promise.resolve([]),
        getHealthStatus: () => Promise.resolve({ errors: [], activeSyncs: 0 }),
        startSync: () => Promise.resolve('test-job'),
        pauseSync: () => Promise.resolve(),
        stopSync: () => Promise.resolve(),
        cleanupOldSyncJobs: () => Promise.resolve(0),
      };

      const mockDbServices = {
        getSyncStatusSummary: () => Promise.resolve({}),
        getHealthStatus: () => Promise.resolve({ connected: true }),
        getConfig: () => Promise.resolve({}),
        updateConfig: () => Promise.resolve(),
      };

      let registrationCompleted = false;
      
      try {
        registerSyncTools(server, mockServices as any, mockDbServices as any);
        registrationCompleted = true;
      } catch (error) {
        console.error('Sync registration failed:', error);
      }

      expect(registrationCompleted).toBe(true);
    });

    it('should complete embedding tools registration successfully', () => {
      const server = new McpServer(
        { name: 'embedding-validation-server', version: '1.0.0' },
        { capabilities: {} }
      );

      let registrationCompleted = false;
      
      try {
        registerEmbeddingTools(server);
        registrationCompleted = true;
      } catch (error) {
        console.error('Embedding registration failed:', error);
      }

      expect(registrationCompleted).toBe(true);
    });
  });
});