import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { registerResources } from '../src/core/resources';
import { registerPrompts } from '../src/core/prompts';
import { registerSampling } from '../src/core/sampling';
import { AhaService } from '../src/core/services/aha-service';

// Mock the AhaService
const mockAhaService = {
  getProduct: mock(() => Promise.resolve({ id: 'PROD-123', name: 'Test Product' })),
  listProducts: mock(() => Promise.resolve({ products: [{ id: 'PROD-1' }, { id: 'PROD-2' }] })),
};

describe('Resource Discovery - Integration Tests', () => {
  let server: any;
  let resourceHandlers: Map<string, Function>;
  let promptHandlers: Map<string, Function>;
  let originalMethods: any = {};

  beforeEach(() => {
    // Save original methods
    originalMethods = {
      getProduct: AhaService.getProduct,
      listProducts: AhaService.listProducts,
    };

    // Reset mocks
    Object.values(mockAhaService).forEach(mock => mock.mockClear());

    // Mock AhaService methods
    (AhaService as any).getProduct = mockAhaService.getProduct;
    (AhaService as any).listProducts = mockAhaService.listProducts;

    // Create mock server that captures registrations
    resourceHandlers = new Map();
    promptHandlers = new Map();

    server = {
      resource: (name: string, templateOrUri: any, handlerOrMetadata?: any, possibleHandler?: Function) => {
        let handler: Function;
        if (typeof templateOrUri === 'string' && typeof handlerOrMetadata === 'function') {
          handler = handlerOrMetadata;
        } else if (typeof templateOrUri === 'object' && typeof possibleHandler === 'function') {
          handler = possibleHandler;
        } else if (typeof templateOrUri === 'object' && typeof handlerOrMetadata === 'function') {
          handler = handlerOrMetadata;
        } else {
          handler = handlerOrMetadata;
        }
        resourceHandlers.set(name, handler);
      },
      prompt: (name: string, argsOrHandler: any, handler?: Function) => {
        const actualHandler = typeof handler === 'function' ? handler : argsOrHandler;
        promptHandlers.set(name, actualHandler);
      }
    };

    // Register all resources, prompts, and sampling
    registerResources(server);
    registerPrompts(server);
    registerSampling(server);
  });

  afterEach(() => {
    // Restore original methods
    (AhaService as any).getProduct = originalMethods.getProduct;
    (AhaService as any).listProducts = originalMethods.listProducts;
  });

  describe('Resource Guide (aha://resources)', () => {
    it('should register the resource guide resource', () => {
      expect(resourceHandlers.has('aha_resource_guide')).toBe(true);
    });

    it('should return structured synonym data when read', async () => {
      const handler = resourceHandlers.get('aha_resource_guide');
      expect(handler).toBeDefined();

      const uri = new URL('aha://resources');
      const result = await handler!(uri);

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);

      const content = result.contents[0];
      expect(content.mimeType).toBe('application/json');

      // Parse and verify structure
      const data = JSON.parse(content.text);
      expect(data.synonyms).toBeDefined();
      expect(data.terminology_guide).toBeDefined();
      expect(data.common_questions).toBeDefined();

      // Verify key synonyms are present
      expect(data.synonyms.workspace).toBeDefined();
      expect(data.synonyms['Product Area']).toBeDefined();
      expect(data.synonyms.workstream).toBeDefined();

      // Verify canonical mappings
      expect(data.synonyms.workspace.canonical).toBe('product');
      expect(data.synonyms.workstream.canonical).toBe('release');
    });
  });

  describe('Enhanced Product/Workspace Resources', () => {
    it('should register products resource', () => {
      expect(resourceHandlers.has('aha_products')).toBe(true);
    });

    it('should register product resource', () => {
      expect(resourceHandlers.has('aha_product')).toBe(true);
    });
  });

  describe('Resource Discovery Prompt', () => {
    it('should register aha_resource_discovery prompt', () => {
      expect(promptHandlers.has('aha_resource_discovery')).toBe(true);
    });

    it('should provide workspace guidance for workspace queries', async () => {
      const handler = promptHandlers.get('aha_resource_discovery');
      expect(handler).toBeDefined();

      const result = await handler!({ search_query: 'show me workspaces' });

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      const message = result.messages[0];
      expect(message.role).toBe('user');
      expect(message.content.type).toBe('text');

      const text = message.content.text.toLowerCase();
      expect(text).toContain('workspace');
      expect(text).toContain('product');
    });

    it('should provide Product Area guidance for Product Area queries', async () => {
      const handler = promptHandlers.get('aha_resource_discovery');
      const result = await handler!({ search_query: 'where are Product Areas' });

      const text = result.messages[0].content.text.toLowerCase();
      expect(text).toContain('product area');
      expect(text).toContain('not exposed');
    });

    it('should provide workstream guidance for workstream queries', async () => {
      const handler = promptHandlers.get('aha_resource_discovery');
      const result = await handler!({ search_query: 'list workstreams' });

      const text = result.messages[0].content.text.toLowerCase();
      expect(text).toContain('workstream');
      expect(text).toContain('release');
    });

    it('should provide general guidance for generic queries', async () => {
      const handler = promptHandlers.get('aha_resource_discovery');
      const result = await handler!({ search_query: 'random stuff' });

      const text = result.messages[0].content.text.toLowerCase();
      expect(text).toContain('resource');
    });
  });

  describe('Sampling Registration', () => {
    it('should register sampling without errors', () => {
      // Sampling registration should complete without throwing
      expect(() => {
        const mockServer = { setRequestHandler: () => {} };
        registerSampling(mockServer as any);
      }).not.toThrow();
    });
  });

  describe('End-to-End Resource Discovery Flow', () => {
    it('should provide complete discovery path for workspace queries', () => {
      // Verify all components are registered
      expect(promptHandlers.has('aha_resource_discovery')).toBe(true);
      expect(resourceHandlers.has('aha_resource_guide')).toBe(true);
      expect(resourceHandlers.has('aha_products')).toBe(true);
    });

    it('should handle Product Area discovery correctly', async () => {
      const handler = promptHandlers.get('aha_resource_discovery');
      const result = await handler!({ search_query: 'Product Areas' });

      const text = result.messages[0].content.text;
      expect(text).toContain('not exposed');
      expect(text).toContain('aha://products');
    });
  });

  describe('Resource Discovery - User Experience', () => {
    it('should provide actionable next steps in all discovery responses', async () => {
      const handler = promptHandlers.get('aha_resource_discovery');
      const queries = ['workspaces', 'Product Areas', 'workstreams'];

      for (const query of queries) {
        const result = await handler!({ search_query: query });
        const text = result.messages[0].content.text;

        // Should contain actual URIs to try
        expect(text).toMatch(/aha:\/\//);

        // Should provide structured guidance
        expect(text.length).toBeGreaterThan(100);
      }
    });

    it('should include aha://resources reference in discovery guidance', async () => {
      const handler = promptHandlers.get('aha_resource_discovery');
      const result = await handler!({ search_query: 'help' });

      const text = result.messages[0].content.text;
      expect(text).toContain('aha://resources');
    });
  });
});

describe('Resource Discovery - Backward Compatibility', () => {
  it('should not break existing resource registration', () => {
    const resourceHandlers = new Map();
    const mockServer = {
      resource: (name: string, ...args: any[]) => {
        resourceHandlers.set(name, true);
      }
    };

    registerResources(mockServer as any);

    // Verify existing resources still registered
    const existingResources = [
      'aha_idea',
      'aha_feature',
      'aha_epic',
      'aha_release',
      'aha_user'
    ];

    existingResources.forEach(resourceName => {
      expect(resourceHandlers.has(resourceName)).toBe(true);
    });
  });

  it('should not break existing prompt registration', () => {
    const promptHandlers = new Map();
    const mockServer = {
      prompt: (name: string, ...args: any[]) => {
        promptHandlers.set(name, true);
      }
    };

    registerPrompts(mockServer as any);

    // Verify at least some existing prompts registered
    expect(promptHandlers.size).toBeGreaterThan(0);
  });
});
