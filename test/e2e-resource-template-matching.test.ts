import { describe, it, expect } from 'bun:test';
import { withTestClient } from './utils/mcp-client-helper';

/**
 * E2E tests for ResourceTemplate URI matching
 *
 * Tests that collection resources are accessible both with and without query parameters.
 * This verifies the dual URI registration pattern (base URI + template URI).
 *
 * Problem: ResourceTemplate patterns with `{?param}` syntax didn't match URIs without query parameters.
 * Solution: Register both a base URI (string) and a template URI (ResourceTemplate) for each collection.
 *
 * SDK Fix: Using PR #1083 (github:mgyarmathy/modelcontextprotocol--typescript-sdk#1079-uritemplate-query-params)
 * which fixes ResourceTemplate matching to properly handle:
 * - URIs without query parameters (returns empty strings for missing params)
 * - URIs with query parameters in ANY order (not just template order)
 * - URIs with partial query parameters (omitted params return as empty strings)
 *
 * Mocking: The @cedricziel/aha-js library is mocked in test/setup.ts to return predictable test data
 * without requiring real Aha.io credentials. This allows tests to verify ResourceTemplate matching logic
 * without depending on external API availability.
 */

describe('ResourceTemplate URI Matching E2E', () => {
  describe('Base URI Access (No Query Params)', () => {
    it('should access aha://features', async () => {
      await withTestClient(async (client) => {
        // This should work with the base URI registration
        const contents = await client.readResource('aha://features');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.features).toBeDefined();
        expect(Array.isArray(data.features)).toBe(true);
        expect(data.features.length).toBeGreaterThan(0);

        // Verify mock data structure
        const firstFeature = data.features[0];
        expect(firstFeature.id).toMatch(/^FEAT-/);
        expect(firstFeature.name).toContain('Test Feature');
      });
    }, { timeout: 30000 });

    it('should access aha://products', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://products');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.products).toBeDefined();
        expect(Array.isArray(data.products)).toBe(true);
        expect(data.products.length).toBeGreaterThan(0);

        // Verify mock data structure
        const firstProduct = data.products[0];
        expect(firstProduct.id).toMatch(/^PROD-/);
        expect(firstProduct.name).toContain('Test Product');
      });
    }, { timeout: 30000 });

    it('should access aha://initiatives', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://initiatives');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.initiatives).toBeDefined();
        expect(Array.isArray(data.initiatives)).toBe(true);
        expect(data.initiatives.length).toBeGreaterThan(0);

        // Verify mock data structure
        const firstInitiative = data.initiatives[0];
        expect(firstInitiative.initiative).toBeDefined();
        expect(firstInitiative.initiative.id).toMatch(/^INIT-/);
        expect(firstInitiative.initiative.name).toContain('Test Initiative');
      });
    }, { timeout: 30000 });

    it('should access aha://goals', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://goals');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.goals).toBeDefined();
        expect(Array.isArray(data.goals)).toBe(true);
        expect(data.goals.length).toBeGreaterThan(0);

        // Verify mock data structure
        const firstGoal = data.goals[0];
        expect(firstGoal.goal).toBeDefined();
        expect(firstGoal.goal.id).toMatch(/^GOAL-/);
        expect(firstGoal.goal.name).toContain('Test Goal');
      });
    }, { timeout: 30000 });

    it('should access aha://releases', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://releases');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.releases).toBeDefined();
        expect(Array.isArray(data.releases)).toBe(true);
        expect(data.releases.length).toBeGreaterThan(0);

        // Verify mock data structure
        const firstRelease = data.releases[0];
        expect(firstRelease.release).toBeDefined();
        expect(firstRelease.release.id).toMatch(/^REL-/);
        expect(firstRelease.release.name).toContain('Test Release');
      });
    }, { timeout: 30000 });

    it('should access aha://strategic-models', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://strategic-models');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.strategic_models).toBeDefined();
        expect(Array.isArray(data.strategic_models)).toBe(true);
        expect(data.strategic_models.length).toBeGreaterThan(0);

        // Verify mock data structure
        const firstModel = data.strategic_models[0];
        expect(firstModel.strategic_model).toBeDefined();
        expect(firstModel.strategic_model.id).toMatch(/^SM-/);
        expect(firstModel.strategic_model.name).toContain('Test Strategic Model');
      });
    }, { timeout: 30000 });

    it('should access aha://idea-organizations', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://idea-organizations');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.idea_organizations).toBeDefined();
        expect(Array.isArray(data.idea_organizations)).toBe(true);
        expect(data.idea_organizations.length).toBeGreaterThan(0);

        // Verify mock data structure
        const firstOrg = data.idea_organizations[0];
        expect(firstOrg.idea_organization).toBeDefined();
        expect(firstOrg.idea_organization.id).toMatch(/^ORG-/);
        expect(firstOrg.idea_organization.name).toContain('Test Organization');
      });
    }, { timeout: 30000 });

    it('should access aha://ideas', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://ideas');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.ideas).toBeDefined();
        expect(Array.isArray(data.ideas)).toBe(true);
        expect(data.ideas.length).toBeGreaterThan(0);

        // Verify mock data structure
        const firstIdea = data.ideas[0];
        expect(firstIdea.idea).toBeDefined();
        expect(firstIdea.idea.id).toMatch(/^IDEA-/);
        expect(firstIdea.idea.name).toContain('Test Idea');
      });
    }, { timeout: 30000 });
  });

  describe('Template URI Access (With Query Params)', () => {
    it('should access aha://features?page=1', async () => {
      await withTestClient(async (client) => {
        // This should work with the template URI registration
        const contents = await client.readResource('aha://features?page=1');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.features).toBeDefined();
        expect(Array.isArray(data.features)).toBe(true);

        // Query parameters are passed to the handler and affect pagination
        expect(data.pagination).toBeDefined();
        expect(data.pagination.current_page).toBe(1);
      });
    }, { timeout: 30000 });

    it('should access aha://products?page=1', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://products?page=1');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.products).toBeDefined();
        expect(Array.isArray(data.products)).toBe(true);

        // Query parameters are passed to the handler
        expect(data.pagination).toBeDefined();
        expect(data.pagination.current_page).toBe(1);
      });
    }, { timeout: 30000 });

    it('should access aha://initiatives?onlyActive=true', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://initiatives?onlyActive=true');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.initiatives).toBeDefined();
        expect(Array.isArray(data.initiatives)).toBe(true);

        // Verify active initiatives are returned
        if (data.initiatives.length > 0) {
          const firstInitiative = data.initiatives[0];
          expect(firstInitiative.initiative.workflow_status.name).toBe('Active');
        }
      });
    }, { timeout: 30000 });

    it('should access aha://goals?page=1', async () => {
      await withTestClient(async (client) => {
        const contents = await client.readResource('aha://goals?page=1');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.goals).toBeDefined();
        expect(Array.isArray(data.goals)).toBe(true);

        // Query parameters are passed to the handler
        expect(data.pagination).toBeDefined();
        expect(data.pagination.current_page).toBe(1);
      });
    }, { timeout: 30000 });
  });

  describe('Resource Discovery', () => {
    it('should list base URIs in resources/list', async () => {
      await withTestClient(async (client) => {
        const resources = await client.listResources();

        // Verify that base URIs are discoverable
        const features = resources.find(r => r.uri === 'aha://features');
        const products = resources.find(r => r.uri === 'aha://products');
        const initiatives = resources.find(r => r.uri === 'aha://initiatives');
        const goals = resources.find(r => r.uri === 'aha://goals');

        expect(features).toBeDefined();
        expect(products).toBeDefined();
        expect(initiatives).toBeDefined();
        expect(goals).toBeDefined();

        if (features) {
          expect(features.name).toBe('aha_features');
          expect(features.description).toContain('features');
        }

        if (products) {
          expect(products.name).toBe('aha_products');
          expect(products.description).toContain('products');
        }
      });
    }, { timeout: 30000 });
  });
});
