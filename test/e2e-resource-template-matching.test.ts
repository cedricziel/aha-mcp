import { describe, it, expect, afterAll } from 'bun:test';
import { sharedTestClient } from './utils/mcp-client-helper';

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
 * Mocking: the server subprocess is spawned with AHA_TOKEN=test-token and NODE_ENV=test, which makes
 * src/core/services/index.ts select MockAhaService and return predictable test data without requiring
 * real Aha.io credentials. This allows tests to verify ResourceTemplate matching logic without
 * depending on external API availability.
 *
 * Collection content: resources.ts classifies each collection into one of three tiers against
 * what the live Aha list endpoint actually returns - see the tiering policy notes at the top of
 * `registerResources` in resources.ts. Tier 1 (features, idea organizations here) renders a
 * markdown link list via `renderCollection`; tier 2 (ideas, products here) renders a markdown
 * table via `renderTable`; tier 3 (initiatives, goals, strategic models here) stays raw JSON
 * because those record types carry real content or nested relationship arrays a link list or
 * table would drop. Assertions below match whichever tier the resource in question landed in.
 */

describe('ResourceTemplate URI Matching E2E', () => {
  // One server for the file; see sharedTestClient. These tests only read.
  const shared = sharedTestClient();
  afterAll(() => shared.close());

  describe('Base URI Access (No Query Params)', () => {
    it('should access aha://features', async () => {
      await shared.use(async (client) => {
        // Tier 1: Feature list responses carry only identity fields - renderCollection link list.
        const contents = await client.readResource('aha://features');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('text/markdown');

        const text = contents[0].text!;
        expect(text).toContain('Features across all products');
        expect(text).toContain('FEAT-1');
        expect(text).toContain('Test Feature 1');
      });
    }, { timeout: 30000 });

    it('should access aha://products', async () => {
      await shared.use(async (client) => {
        // Tier 2: verified against a live /api/v1/products response - no description, no
        // custom_fields, so renderTable is safe. The first column is reference_prefix, not
        // reference_num - a product has no reference_num of its own.
        const contents = await client.readResource('aha://products');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('text/markdown');

        const text = contents[0].text!;
        expect(text).toContain('Products (workspaces)');
        expect(text).toContain('| Prefix | Name | Type |');
        expect(text).toContain('Test Product 1');
      });
    }, { timeout: 30000 });

    it('should access aha://initiatives', async () => {
      await shared.use(async (client) => {
        // Tier 3: Initiative nests goals/features/releases (RecordRef[]) - the same
        // fat-collection shape as goals.
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

        // MockAhaService returns flat Initiative records (matching InitiativesListResponse),
        // not each one wrapped under an `initiative` key - that wrapper is only correct for
        // the single-record getInitiative response.
        const firstInitiative = data.initiatives[0];
        expect(firstInitiative.id).toMatch(/^INIT-/);
        expect(firstInitiative.name).toContain('Test Initiative');
      });
    }, { timeout: 30000 });

    it('should access aha://goals', async () => {
      await shared.use(async (client) => {
        // Tier 3: the known fat-collection case - Goal nests features, initiatives,
        // key_results and releases.
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

        // MockAhaService returns flat Goal records (matching GoalsListResponse), not each one
        // wrapped under a `goal` key - that wrapper is only correct for getGoal.
        const firstGoal = data.goals[0];
        expect(firstGoal.id).toMatch(/^GOAL-/);
        expect(firstGoal.name).toContain('Test Goal');
      });
    }, { timeout: 30000 });

    it('should access aha://strategic-models', async () => {
      await shared.use(async (client) => {
        // Tier 3: StrategicModel nests a components array and an unverified description field.
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

        // MockAhaService returns flat StrategicModel records, not wrapped under a
        // `strategic_model` key - that wrapper is only correct for getStrategicModel.
        const firstModel = data.strategic_models[0];
        expect(firstModel.id).toMatch(/^SM-/);
        expect(firstModel.name).toContain('Test Strategic Model');
      });
    }, { timeout: 30000 });

    it('should access aha://idea-organizations', async () => {
      await shared.use(async (client) => {
        // Tier 1: verified against a live /api/v1/idea_organizations response - a slim index
        // with nothing but identity fields, so renderCollection is safe and near-lossless.
        const contents = await client.readResource('aha://idea-organizations');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('text/markdown');

        const text = contents[0].text!;
        expect(text).toContain('Idea organizations');
        expect(text).toContain('Test Organization 1');
      });
    }, { timeout: 30000 });

    it('should access aha://ideas', async () => {
      await shared.use(async (client) => {
        // Tier 2: Idea list responses carry real scalar content (status, dates) worth a table -
        // renderTable, not a link list or raw JSON.
        const contents = await client.readResource('aha://ideas');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('text/markdown');

        const text = contents[0].text!;
        expect(text).toContain('Ideas across all products');
        expect(text).toContain('| Ref | Name | Status | Created |');
        expect(text).toContain('IDEA-1');
        expect(text).toContain('Test Idea 1');
        expect(text).toContain('New');
      });
    }, { timeout: 30000 });
  });

  describe('Template URI Access (With Query Params)', () => {
    it('should access aha://features?page=1', async () => {
      await shared.use(async (client) => {
        // This should work with the template URI registration
        const contents = await client.readResource('aha://features?page=1');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('text/markdown');

        const text = contents[0].text!;
        expect(text).toContain('Features across all products');
        // MockAhaService clamps the list to 3 records regardless of page, so the record count
        // line is what confirms the query parameter reached the handler at all.
        expect(text).toContain('3 records listed.');
      });
    }, { timeout: 30000 });

    it('should access aha://products?page=1', async () => {
      await shared.use(async (client) => {
        const contents = await client.readResource('aha://products?page=1');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('text/markdown');

        const text = contents[0].text!;
        expect(text).toContain('Products (workspaces)');
        // MockAhaService clamps the list to 3 records regardless of page, so the record count
        // line is what confirms the query parameter reached the handler at all.
        expect(text).toContain('3 records listed.');
      });
    }, { timeout: 30000 });

    it('should access aha://initiatives?onlyActive=true', async () => {
      await shared.use(async (client) => {
        const contents = await client.readResource('aha://initiatives?onlyActive=true');

        expect(contents).toBeDefined();
        expect(Array.isArray(contents)).toBe(true);
        expect(contents.length).toBeGreaterThan(0);
        expect(contents[0].mimeType).toBe('application/json');

        const data = JSON.parse(contents[0].text!);
        expect(data).toBeDefined();
        expect(data.initiatives).toBeDefined();
        expect(Array.isArray(data.initiatives)).toBe(true);

        // Verify active initiatives are returned. MockAhaService returns flat Initiative
        // records now, so workflow_status sits directly on the record.
        if (data.initiatives.length > 0) {
          const firstInitiative = data.initiatives[0];
          expect(firstInitiative.workflow_status.name).toBe('Active');
        }
      });
    }, { timeout: 30000 });

    it('should access aha://goals?page=1', async () => {
      await shared.use(async (client) => {
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
      await shared.use(async (client) => {
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
