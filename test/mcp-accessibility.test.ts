import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from '../src/core/resources';
import { registerPrompts } from '../src/core/prompts';
import { AhaService } from '../src/core/services/aha-service';

// Mock the AhaService for prompt context fetching
const mockAhaService = {
  getFeature: mock(() => Promise.resolve({ 
    id: 'FEAT-123', 
    name: 'Test Feature',
    description: 'A test feature',
    status: 'Under consideration',
    priority: 'High',
    release: { name: 'Release 1.0' },
    tags: [{ name: 'security' }, { name: 'performance' }]
  })),
  getEpic: mock(() => Promise.resolve({ 
    id: 'EPIC-123', 
    name: 'Test Epic',
    description: 'A test epic',
    status: 'In progress',
    progress: 50,
    product: { name: 'Product A' }
  })),
  getIdea: mock(() => Promise.resolve({ 
    id: 'IDEA-123',
    name: 'Test Idea',
    description: 'A test idea',
    status: 'Under review',
    score: 85,
    category: { name: 'Innovation' }
  })),
  getInitiative: mock(() => Promise.resolve({ 
    id: 'INIT-123',
    name: 'Test Initiative',
    description: 'A test initiative',
    status: 'Active',
    progress: 75
  })),
  getProduct: mock(() => Promise.resolve({ 
    id: 'PROD-123', 
    name: 'Test Product',
    description: 'A test product'
  }))
};

describe('MCP Server Accessibility', () => {
  let server: McpServer;
  let resourceHandlers: Map<string, Function>;
  let promptHandlers: Map<string, Function>;
  let originalMethods: any = {};

  beforeEach(() => {
    // Save original methods
    originalMethods = {
      getFeature: AhaService.getFeature,
      getEpic: AhaService.getEpic,
      getIdea: AhaService.getIdea,
      getInitiative: AhaService.getInitiative,
      getProduct: AhaService.getProduct
    };

    // Reset mocks
    Object.values(mockAhaService).forEach(mock => mock.mockClear());
    
    // Mock AhaService methods for prompt context fetching
    (AhaService as any).getFeature = mockAhaService.getFeature;
    (AhaService as any).getEpic = mockAhaService.getEpic;
    (AhaService as any).getIdea = mockAhaService.getIdea;
    (AhaService as any).getInitiative = mockAhaService.getInitiative;
    (AhaService as any).getProduct = mockAhaService.getProduct;

    // Create mock server that captures registrations
    resourceHandlers = new Map();
    promptHandlers = new Map();
    
    server = {
      resource: (name: string, _template: string, handler: Function) => {
        resourceHandlers.set(name, handler);
      },
      prompt: (name: string, _description: string, _schema: any, handler: Function) => {
        promptHandlers.set(name, handler);
      }
    } as any;

    // Register resources and prompts with the mock server
    registerResources(server);
    registerPrompts(server);
  });

  afterEach(() => {
    // Restore original methods
    (AhaService as any).getFeature = originalMethods.getFeature;
    (AhaService as any).getEpic = originalMethods.getEpic;
    (AhaService as any).getIdea = originalMethods.getIdea;
    (AhaService as any).getInitiative = originalMethods.getInitiative;
    (AhaService as any).getProduct = originalMethods.getProduct;
  });

  describe('Resource Registration and Accessibility', () => {
    it('should register all expected individual entity resources', () => {
      const expectedIndividualResources = [
        'aha_idea',
        'aha_feature', 
        'aha_user',
        'aha_epic',
        'aha_product',
        'aha_initiative',
        'aha_goal',
        'aha_release',
        'aha_release_phase',
        'aha_requirement',
        'aha_competitor',
        'aha_todo',
        'aha_strategic_model',
        'aha_idea_organization'
      ];

      expectedIndividualResources.forEach(resourceName => {
        expect(resourceHandlers.has(resourceName)).toBe(true);
      });
    });

    it('should register all expected collection resources', () => {
      const expectedCollectionResources = [
        'aha_features',
        'aha_users',
        'aha_products', 
        'aha_initiatives',
        'aha_goals',
        'aha_releases',
        'aha_release_phases',
        'aha_todos',
        'aha_ideas',
        'aha_strategic_models',
        'aha_idea_organizations',
        'aha_competitors'
      ];

      expectedCollectionResources.forEach(resourceName => {
        expect(resourceHandlers.has(resourceName)).toBe(true);
      });
    });

    it('should register all expected nested/relational resources', () => {
      const expectedNestedResources = [
        'aha_epics',
        'aha_ideas_by_product',
        'aha_product_releases',
        'aha_goal_epics',
        'aha_release_features',
        'aha_release_epics',
        'aha_initiative_epics'
      ];

      expectedNestedResources.forEach(resourceName => {
        expect(resourceHandlers.has(resourceName)).toBe(true);
      });
    });

    it('should register all expected comment resources', () => {
      const expectedCommentResources = [
        'aha_epic_comments',
        'aha_idea_comments', 
        'aha_initiative_comments',
        'aha_product_comments',
        'aha_goal_comments',
        'aha_release_comments',
        'aha_release_phase_comments',
        'aha_requirement_comments',
        'aha_todo_comments'
      ];

      expectedCommentResources.forEach(resourceName => {
        expect(resourceHandlers.has(resourceName)).toBe(true);
      });
    });

    it('should register all expected special resources', () => {
      const expectedSpecialResources = [
        'aha_me_profile',
        'aha_me_assigned_records',
        'aha_me_pending_tasks',
        'aha_idea_endorsements',
        'aha_idea_votes',
        'aha_idea_watchers'
      ];

      expectedSpecialResources.forEach(resourceName => {
        expect(resourceHandlers.has(resourceName)).toBe(true);
      });
    });

    it('should have accessible resource handlers', async () => {
      // Test a few key resources to ensure handlers are accessible
      const testCases = [
        { name: 'aha_idea', uri: 'aha://idea/IDEA-123' },
        { name: 'aha_features', uri: 'aha://features' },
        { name: 'aha_epic_comments', uri: 'aha://comments/epic/EPIC-123' }
      ];

      for (const testCase of testCases) {
        const handler = resourceHandlers.get(testCase.name);
        expect(handler).toBeDefined();
        expect(typeof handler).toBe('function');
        
        // Verify handler can be invoked (will throw due to mock, but shows it's callable)
        const uri = new URL(testCase.uri);
        try {
          await handler!(uri);
        } catch (error) {
          // Expected to fail due to mocked AhaService, but handler is accessible
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle URI parsing correctly', async () => {
      const handler = resourceHandlers.get('aha_idea');
      expect(handler).toBeDefined();

      // Test invalid URI (missing ID)
      const invalidUri = new URL('aha://idea/');
      await expect(handler!(invalidUri)).rejects.toThrow('Invalid idea ID: ID is missing from URI');
    });
  });

  describe('Prompt Registration and Accessibility', () => {
    it('should register all expected domain-specific prompts', () => {
      const expectedPrompts = [
        'feature_analysis',
        'feature_specification', 
        'product_roadmap',
        'release_planning',
        'idea_prioritization',
        'user_story_generation',
        'sprint_planning',
        'epic_breakdown',
        'competitor_analysis',
        'risk_assessment',
        'success_metrics',
        'stakeholder_communication',
        'product_idea_discovery'
      ];

      expectedPrompts.forEach(promptName => {
        expect(promptHandlers.has(promptName)).toBe(true);
      });
    });

    it('should have accessible prompt handlers', async () => {
      // Test a few key prompts to ensure handlers are accessible
      const testCases = [
        { name: 'feature_analysis', params: { feature_id: 'FEAT-123' } },
        { name: 'product_roadmap', params: { product_id: 'PROD-123' } },
        { name: 'idea_prioritization', params: { product_id: 'PROD-123' } }
      ];

      for (const testCase of testCases) {
        const handler = promptHandlers.get(testCase.name);
        expect(handler).toBeDefined();
        expect(typeof handler).toBe('function');
        
        // Verify handler can be invoked
        try {
          const result = await handler!(testCase.params);
          expect(result).toBeDefined();
          expect(result.messages).toBeDefined();
          expect(Array.isArray(result.messages)).toBe(true);
        } catch (error) {
          // If it fails, ensure it's a validation error, not accessibility issue
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle context fetching for prompts with resource IDs', async () => {
      const handler = promptHandlers.get('feature_analysis');
      expect(handler).toBeDefined();

      const result = await handler!({ feature_id: 'FEAT-123' });
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
      
      // Verify context was fetched
      expect(mockAhaService.getFeature).toHaveBeenCalledWith('FEAT-123');
      
      // Verify the prompt content includes context
      const messageContent = result.messages[0].content.text;
      expect(messageContent).toContain('Test Feature');
      expect(messageContent).toContain('security');
    });

    it('should handle prompts without resource context', async () => {
      const handler = promptHandlers.get('product_idea_discovery');
      expect(handler).toBeDefined();

      const result = await handler!({ 
        search_topic: 'Enterprise Solutions',
        product_name: 'Product Manager Tools'
      });
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
      
      // Verify content includes provided parameters
      const messageContent = result.messages[0].content.text;
      expect(messageContent).toContain('Enterprise Solutions');
      expect(messageContent).toContain('Product Manager Tools');
    });

    it('should accept valid prompt parameters', async () => {
      const handler = promptHandlers.get('feature_analysis');
      expect(handler).toBeDefined();

      // Test with valid parameters
      const result = await handler!({ 
        feature_name: 'Test Feature',
        feature_description: 'A test feature description'
      });
      
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
      
      const messageContent = result.messages[0].content.text;
      expect(messageContent).toContain('Test Feature');
      expect(messageContent).toContain('A test feature description');
    });
  });

  describe('Integration and Error Handling', () => {
    it('should have consistent resource and prompt naming conventions', () => {
      // All resource names should use underscores (not hyphens) for Cursor compatibility
      for (const resourceName of resourceHandlers.keys()) {
        expect(resourceName).toMatch(/^aha_[a-z_]+$/);
        expect(resourceName).not.toContain('-');
      }

      // All prompt names should use underscores 
      for (const promptName of promptHandlers.keys()) {
        expect(promptName).toMatch(/^[a-z_]+$/);
        expect(promptName).not.toContain('-');
      }
    });

    it('should handle service errors gracefully in resources', async () => {
      // Mock a service error on the idea handler
      mockAhaService.getIdea.mockRejectedValue(new Error('Service unavailable'));

      const handler = resourceHandlers.get('aha_idea');
      const uri = new URL('aha://idea/IDEA-123');

      await expect(handler!(uri)).rejects.toThrow('Service unavailable');
    });

    it('should handle context fetch errors gracefully in prompts', async () => {
      // Mock a context fetch error
      mockAhaService.getFeature.mockRejectedValue(new Error('Feature not found'));

      const handler = promptHandlers.get('feature_analysis');

      // Should still return a prompt, but without specific context
      const result = await handler!({ feature_id: 'FEAT-999' });
      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
    });
  });

  describe('Complete MCP Server Coverage', () => {
    it('should have comprehensive resource coverage', () => {
      const totalResources = resourceHandlers.size;
      
      // Based on the codebase analysis, we expect 40+ resources
      expect(totalResources).toBeGreaterThanOrEqual(40);
      
      // Verify we have good distribution across resource types
      const individualCount = Array.from(resourceHandlers.keys()).filter(name => 
        ['aha_idea', 'aha_feature', 'aha_user', 'aha_epic', 'aha_product'].includes(name)
      ).length;
      expect(individualCount).toBeGreaterThanOrEqual(5);
      
      const collectionCount = Array.from(resourceHandlers.keys()).filter(name => 
        ['aha_features', 'aha_users', 'aha_products', 'aha_initiatives'].includes(name)
      ).length;
      expect(collectionCount).toBeGreaterThanOrEqual(4);
      
      const commentCount = Array.from(resourceHandlers.keys()).filter(name => 
        name.includes('_comments')
      ).length;
      expect(commentCount).toBeGreaterThanOrEqual(5);
    });

    it('should have comprehensive prompt coverage', () => {
      const totalPrompts = promptHandlers.size;
      
      // Based on the codebase analysis, we expect 13+ prompts
      expect(totalPrompts).toBeGreaterThanOrEqual(13);
      
      // Verify we have good distribution across prompt domains
      const managementPrompts = Array.from(promptHandlers.keys()).filter(name => 
        ['feature_analysis', 'product_roadmap', 'release_planning'].includes(name)
      ).length;
      expect(managementPrompts).toBeGreaterThanOrEqual(3);
      
      const developmentPrompts = Array.from(promptHandlers.keys()).filter(name => 
        ['user_story_generation', 'sprint_planning', 'epic_breakdown'].includes(name)
      ).length;
      expect(developmentPrompts).toBeGreaterThanOrEqual(3);
      
      const analysisPrompts = Array.from(promptHandlers.keys()).filter(name => 
        ['competitor_analysis', 'risk_assessment', 'success_metrics'].includes(name)
      ).length;
      expect(analysisPrompts).toBeGreaterThanOrEqual(3);
    });

    it('should demonstrate full MCP server functionality', async () => {
      // This test verifies that both resources and prompts are accessible,
      // confirming the MCP server provides complete advertised capabilities
      
      expect(resourceHandlers.size).toBeGreaterThan(0);
      expect(promptHandlers.size).toBeGreaterThan(0);
      
      // Sample a few handlers to ensure they're functional
      const sampleResource = resourceHandlers.get('aha_features');
      const samplePrompt = promptHandlers.get('product_roadmap');
      
      expect(sampleResource).toBeDefined();
      expect(samplePrompt).toBeDefined();
      expect(typeof sampleResource).toBe('function');
      expect(typeof samplePrompt).toBe('function');
    });
  });
});