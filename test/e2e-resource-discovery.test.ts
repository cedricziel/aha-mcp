import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { registerResources } from '../src/core/resources';
import { registerPrompts } from '../src/core/prompts';
import { registerSampling } from '../src/core/sampling';
import { AhaService } from '../src/core/services/aha-service';

/**
 * End-to-End tests simulating complete user workflows for resource discovery
 */

// Mock the AhaService
const mockAhaService = {
  getProduct: mock(() => Promise.resolve({
    id: 'PROD-123',
    name: 'Test Product',
    reference_prefix: 'TEST',
    description: 'A test product'
  })),
  listProducts: mock(() => Promise.resolve({
    products: [
      { id: 'PROD-1', name: 'Product 1', reference_prefix: 'P1' },
      { id: 'PROD-2', name: 'Product 2', reference_prefix: 'P2' }
    ]
  })),
  listFeatures: mock(() => Promise.resolve({
    features: [
      { id: 'FEAT-1', name: 'Feature 1', reference_num: 'TEST-1' },
      { id: 'FEAT-2', name: 'Feature 2', reference_num: 'TEST-2' }
    ]
  })),
  listReleases: mock(() => Promise.resolve({
    releases: [
      { id: 'REL-1', name: 'Release 1', reference_num: 'R1' },
      { id: 'REL-2', name: 'Release 2', reference_num: 'R2' }
    ]
  }))
};

describe('E2E: Resource Discovery Workflows', () => {
  let server: any;
  let resourceHandlers: Map<string, Function>;
  let promptHandlers: Map<string, Function>;
  let originalMethods: any = {};

  beforeEach(() => {
    // Save and mock AhaService methods
    originalMethods = {
      getProduct: AhaService.getProduct,
      listProducts: AhaService.listProducts,
      listFeatures: AhaService.listFeatures,
      listReleases: AhaService.listReleases,
    };

    Object.values(mockAhaService).forEach(mock => mock.mockClear());

    (AhaService as any).getProduct = mockAhaService.getProduct;
    (AhaService as any).listProducts = mockAhaService.listProducts;
    (AhaService as any).listFeatures = mockAhaService.listFeatures;
    (AhaService as any).listReleases = mockAhaService.listReleases;

    // Create mock server
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

    registerResources(server);
    registerPrompts(server);
    registerSampling(server);
  });

  afterEach(() => {
    (AhaService as any).getProduct = originalMethods.getProduct;
    (AhaService as any).listProducts = originalMethods.listProducts;
    (AhaService as any).listFeatures = originalMethods.listFeatures;
    (AhaService as any).listReleases = originalMethods.listReleases;
  });

  describe('Workflow: New User Searching for Workspaces', () => {
    it('should guide user from workspace query to products resource', async () => {
      // Step 1: User asks about workspaces using discovery prompt
      const discoveryHandler = promptHandlers.get('aha_resource_discovery');
      expect(discoveryHandler).toBeDefined();

      const promptResult = await discoveryHandler!({ search_query: 'show me workspaces' });

      // Verify guidance mentions products
      const promptText = promptResult.messages[0].content.text.toLowerCase();
      expect(promptText).toContain('workspace');
      expect(promptText).toContain('product');
      expect(promptText).toContain('synonymous');

      // Step 2: User reads aha://resources to learn more
      const resourceGuideHandler = resourceHandlers.get('aha_resource_guide');
      expect(resourceGuideHandler).toBeDefined();

      const guideResult = await resourceGuideHandler!(new URL('aha://resources'));
      const guideData = JSON.parse(guideResult.contents[0].text);

      // Verify synonym mapping exists
      expect(guideData.synonyms.workspace).toBeDefined();
      expect(guideData.synonyms.workspace.canonical).toBe('product');
      expect(guideData.synonyms.workspace.resources).toContain('aha_products');

      // Step 3: User accesses aha://products
      const productsHandler = resourceHandlers.get('aha_products');
      expect(productsHandler).toBeDefined();

      const productsResult = await productsHandler!(new URL('aha://products'));
      const productsData = JSON.parse(productsResult.contents[0].text);

      // Verify products are returned
      expect(productsData.products).toBeDefined();
      expect(productsData.products.length).toBe(2);
      expect(productsData.products[0].id).toBe('PROD-1');
    });

    it('should work with direct resource access after learning terminology', async () => {
      // User learned that workspace = product, goes directly to aha://product/{id}
      const productHandler = resourceHandlers.get('aha_product');
      expect(productHandler).toBeDefined();

      const result = await productHandler!(
        new URL('aha://product/PROD-123'),
        { id: 'PROD-123' }
      );

      const productData = JSON.parse(result.contents[0].text);
      expect(productData.id).toBe('PROD-123');
      expect(productData.name).toBe('Test Product');
    });
  });

  describe('Workflow: User Looking for Product Areas', () => {
    it('should clearly explain Product Areas are not available and suggest alternatives', async () => {
      // Step 1: User asks about Product Areas
      const discoveryHandler = promptHandlers.get('aha_resource_discovery');
      const promptResult = await discoveryHandler!({ search_query: 'where are Product Areas?' });

      const promptText = promptResult.messages[0].content.text;

      // Verify clear messaging
      expect(promptText).toContain('Product Area');
      expect(promptText).toContain('not exposed');
      expect(promptText).toContain('aha://products');

      // Step 2: User checks resource guide for confirmation
      const resourceGuideHandler = resourceHandlers.get('aha_resource_guide');
      const guideResult = await resourceGuideHandler!(new URL('aha://resources'));
      const guideData = JSON.parse(guideResult.contents[0].text);

      // Verify Product Area entry exists and explains unavailability
      expect(guideData.synonyms['Product Area']).toBeDefined();
      expect(guideData.synonyms['Product Area'].resources.length).toBe(0);
      expect(guideData.synonyms['Product Area'].note).toContain('not exposed');

      // Step 3: User navigates to suggested alternative (products)
      const productsHandler = resourceHandlers.get('aha_products');
      const productsResult = await productsHandler!(new URL('aha://products'));

      expect(productsResult.contents).toBeDefined();
      expect(productsResult.contents.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow: User Searching for Workstreams', () => {
    it('should guide user from workstream to releases', async () => {
      // Step 1: User asks about workstreams
      const discoveryHandler = promptHandlers.get('aha_resource_discovery');
      const promptResult = await discoveryHandler!({ search_query: 'list workstreams' });

      const promptText = promptResult.messages[0].content.text.toLowerCase();
      expect(promptText).toContain('workstream');
      expect(promptText).toContain('release');
      expect(promptText).toContain('aha://releases');

      // Step 2: User accesses aha://releases
      const releasesHandler = resourceHandlers.get('aha_releases');
      expect(releasesHandler).toBeDefined();

      const releasesResult = await releasesHandler!(new URL('aha://releases'));
      const releasesData = JSON.parse(releasesResult.contents[0].text);

      // Verify releases are returned
      expect(releasesData.releases).toBeDefined();
      expect(releasesData.releases.length).toBe(2);
      expect(releasesData.releases[0].name).toBe('Release 1');
    });
  });

  describe('Workflow: General Discovery', () => {
    it('should provide comprehensive guidance for exploratory queries', async () => {
      // Step 1: User asks generic question
      const discoveryHandler = promptHandlers.get('aha_resource_discovery');
      const promptResult = await discoveryHandler!({ search_query: 'what can I access?' });

      const promptText = promptResult.messages[0].content.text;

      // Should reference the resource guide
      expect(promptText).toContain('aha://resources');

      // Step 2: User reads resource guide
      const resourceGuideHandler = resourceHandlers.get('aha_resource_guide');
      const guideResult = await resourceGuideHandler!(new URL('aha://resources'));
      const guideData = JSON.parse(guideResult.contents[0].text);

      // Verify comprehensive information
      expect(guideData.synonyms).toBeDefined();
      expect(guideData.terminology_guide).toBeDefined();
      expect(guideData.common_questions).toBeDefined();

      // Verify common questions are helpful
      expect(guideData.common_questions['How do I find workspaces?']).toBeDefined();
      expect(guideData.common_questions['How do I find Product Areas?']).toBeDefined();
      expect(guideData.common_questions['Where are workstreams?']).toBeDefined();
    });
  });

  describe('Workflow: Experienced User Shortcut', () => {
    it('should allow direct access when user knows correct terminology', async () => {
      // Experienced user goes directly to features without discovery
      const featuresHandler = resourceHandlers.get('aha_features');
      expect(featuresHandler).toBeDefined();

      const result = await featuresHandler!(new URL('aha://features'));
      const featuresData = JSON.parse(result.contents[0].text);

      // Verify direct access works
      expect(featuresData.features).toBeDefined();
      expect(featuresData.features.length).toBe(2);
    });
  });

  describe('Workflow: Multi-Step Navigation', () => {
    it('should support drilling down from products to features', async () => {
      // Step 1: List products
      const productsHandler = resourceHandlers.get('aha_products');
      const productsResult = await productsHandler!(new URL('aha://products'));
      const productsData = JSON.parse(productsResult.contents[0].text);

      const firstProductId = productsData.products[0].id;
      expect(firstProductId).toBeDefined();

      // Step 2: Get specific product
      const productHandler = resourceHandlers.get('aha_product');
      const productResult = await productHandler!(
        new URL(`aha://product/${firstProductId}`),
        { id: firstProductId }
      );

      expect(productResult.contents).toBeDefined();

      // Step 3: Access features (global resource)
      const featuresHandler = resourceHandlers.get('aha_features');
      const featuresResult = await featuresHandler!(new URL('aha://features'));
      const featuresData = JSON.parse(featuresResult.contents[0].text);

      expect(featuresData.features).toBeDefined();
      expect(featuresData.features.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow: Error Recovery', () => {
    it('should help user recover from using wrong terminology', async () => {
      // Step 1: User tries wrong term, uses discovery
      const discoveryHandler = promptHandlers.get('aha_resource_discovery');

      // Test various incorrect or alternative terms
      const queries = [
        'show environments',
        'list projects',
        'where are my spaces'
      ];

      for (const query of queries) {
        const result = await discoveryHandler!({ search_query: query });
        const text = result.messages[0].content.text;

        // Should provide helpful fallback guidance
        expect(text).toContain('resource');
        expect(text.length).toBeGreaterThan(50); // Non-empty, helpful response
      }

      // Step 2: User accesses resource guide for complete mapping
      const resourceGuideHandler = resourceHandlers.get('aha_resource_guide');
      const guideResult = await resourceGuideHandler!(new URL('aha://resources'));
      const guideData = JSON.parse(guideResult.contents[0].text);

      // Verify guide has all needed information
      expect(Object.keys(guideData.synonyms).length).toBeGreaterThan(0);
      expect(Object.keys(guideData.common_questions).length).toBeGreaterThan(0);
    });
  });

  describe('Workflow: Case Sensitivity Handling', () => {
    it('should handle case variations in queries', async () => {
      const discoveryHandler = promptHandlers.get('aha_resource_discovery');

      const caseVariations = [
        'show me WORKSPACES',
        'show me workspaces',
        'show me Workspaces',
        'show me WoRkSpAcEs'
      ];

      for (const query of caseVariations) {
        const result = await discoveryHandler!({ search_query: query });
        const text = result.messages[0].content.text.toLowerCase();

        // All should provide workspace guidance
        expect(text).toContain('workspace');
        expect(text).toContain('product');
      }
    });
  });

  describe('Workflow: Performance and Caching', () => {
    it('should handle repeated queries efficiently', async () => {
      const discoveryHandler = promptHandlers.get('aha_resource_discovery');

      // Make multiple requests
      const results = await Promise.all([
        discoveryHandler!({ search_query: 'workspaces' }),
        discoveryHandler!({ search_query: 'workspaces' }),
        discoveryHandler!({ search_query: 'workspaces' })
      ]);

      // All should return consistent results
      results.forEach(result => {
        expect(result.messages[0].content.text).toContain('workspace');
      });

      // Verify the first and last are identical (deterministic)
      expect(results[0].messages[0].content.text)
        .toBe(results[2].messages[0].content.text);
    });
  });

  describe('Workflow: Integration with Existing Features', () => {
    it('should not interfere with existing resource access', async () => {
      // Verify that adding discovery features doesn't break existing resources
      const existingResources = [
        'aha_features',
        'aha_epics',
        'aha_releases',
        'aha_ideas'
      ];

      existingResources.forEach(resourceName => {
        const handler = resourceHandlers.get(resourceName);
        expect(handler).toBeDefined();
        expect(typeof handler).toBe('function');
      });

      // Verify new resources are also registered
      expect(resourceHandlers.has('aha_resource_guide')).toBe(true);

      // Verify total count increased
      expect(resourceHandlers.size).toBeGreaterThan(40);
    });

    it('should not interfere with existing prompts', () => {
      // Verify new prompt is registered
      expect(promptHandlers.has('aha_resource_discovery')).toBe(true);

      // Verify we have multiple prompts registered (13 total including new one)
      expect(promptHandlers.size).toBeGreaterThanOrEqual(13);
    });
  });
});
