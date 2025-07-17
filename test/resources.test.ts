import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from '../src/core/resources';
import { AhaService } from '../src/core/services/aha-service';

// Mock the AhaService
const mockAhaService = {
  getIdea: mock(() => Promise.resolve({ id: 'IDEA-123', name: 'Test Idea' })),
  getFeature: mock(() => Promise.resolve({ id: 'FEAT-123', name: 'Test Feature' })),
  getUser: mock(() => Promise.resolve({ id: 'USER-123', name: 'Test User' })),
  getEpic: mock(() => Promise.resolve({ id: 'EPIC-123', name: 'Test Epic' })),
  listFeatures: mock(() => Promise.resolve({ features: [{ id: 'FEAT-1' }, { id: 'FEAT-2' }] })),
  listUsers: mock(() => Promise.resolve({ users: [{ id: 'USER-1' }, { id: 'USER-2' }] })),
  listEpics: mock(() => Promise.resolve({ epics: [{ id: 'EPIC-1' }, { id: 'EPIC-2' }] }))
};

describe('Resources', () => {
  let server: McpServer;
  let resourceHandlers: Map<string, Function>;
  let originalMethods: any = {};

  beforeEach(() => {
    // Save original methods
    originalMethods = {
      getIdea: AhaService.getIdea,
      getFeature: AhaService.getFeature,
      getUser: AhaService.getUser,
      getEpic: AhaService.getEpic,
      listFeatures: AhaService.listFeatures,
      listUsers: AhaService.listUsers,
      listEpics: AhaService.listEpics
    };

    // Reset mocks
    Object.values(mockAhaService).forEach(mock => mock.mockClear());
    
    // Mock AhaService methods
    (AhaService as any).getIdea = mockAhaService.getIdea;
    (AhaService as any).getFeature = mockAhaService.getFeature;
    (AhaService as any).getUser = mockAhaService.getUser;
    (AhaService as any).getEpic = mockAhaService.getEpic;
    (AhaService as any).listFeatures = mockAhaService.listFeatures;
    (AhaService as any).listUsers = mockAhaService.listUsers;
    (AhaService as any).listEpics = mockAhaService.listEpics;

    // Create a mock server that captures resource registrations
    resourceHandlers = new Map();
    server = {
      resource: (name: string, template: string, handler: Function) => {
        resourceHandlers.set(name, handler);
      }
    } as any;

    // Register resources with the mock server
    registerResources(server);
  });

  afterEach(() => {
    // Restore original methods
    (AhaService as any).getIdea = originalMethods.getIdea;
    (AhaService as any).getFeature = originalMethods.getFeature;
    (AhaService as any).getUser = originalMethods.getUser;
    (AhaService as any).getEpic = originalMethods.getEpic;
    (AhaService as any).listFeatures = originalMethods.listFeatures;
    (AhaService as any).listUsers = originalMethods.listUsers;
    (AhaService as any).listEpics = originalMethods.listEpics;
  });

  describe('Individual Entity Resources', () => {
    describe('aha_idea resource', () => {
      it('should retrieve idea by ID', async () => {
        const handler = resourceHandlers.get('aha_idea');
        expect(handler).toBeDefined();

        const uri = new URL('aha://idea/IDEA-123');
        const result = await handler!(uri);

        expect(mockAhaService.getIdea).toHaveBeenCalledWith('IDEA-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://idea/IDEA-123');
        expect(result.contents[0].text).toContain('Test Idea');
      });

      it('should throw error for missing ID', async () => {
        const handler = resourceHandlers.get('aha_idea');
        const uri = new URL('aha://idea/');

        await expect(handler!(uri)).rejects.toThrow('Invalid idea ID: ID is missing from URI');
      });
    });

    describe('aha_feature resource', () => {
      it('should retrieve feature by ID', async () => {
        const handler = resourceHandlers.get('aha_feature');
        expect(handler).toBeDefined();

        const uri = new URL('aha://feature/FEAT-123');
        const result = await handler!(uri);

        expect(mockAhaService.getFeature).toHaveBeenCalledWith('FEAT-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://feature/FEAT-123');
        expect(result.contents[0].text).toContain('Test Feature');
      });

      it('should throw error for missing ID', async () => {
        const handler = resourceHandlers.get('aha_feature');
        const uri = new URL('aha://feature/');

        await expect(handler!(uri)).rejects.toThrow('Invalid feature ID: ID is missing from URI');
      });
    });

    describe('aha_user resource', () => {
      it('should retrieve user by ID', async () => {
        const handler = resourceHandlers.get('aha_user');
        expect(handler).toBeDefined();

        const uri = new URL('aha://user/USER-123');
        const result = await handler!(uri);

        expect(mockAhaService.getUser).toHaveBeenCalledWith('USER-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://user/USER-123');
        expect(result.contents[0].text).toContain('Test User');
      });

      it('should throw error for missing ID', async () => {
        const handler = resourceHandlers.get('aha_user');
        const uri = new URL('aha://user/');

        await expect(handler!(uri)).rejects.toThrow('Invalid user ID: ID is missing from URI');
      });
    });

    describe('aha_epic resource', () => {
      it('should retrieve epic by ID', async () => {
        const handler = resourceHandlers.get('aha_epic');
        expect(handler).toBeDefined();

        const uri = new URL('aha://epic/EPIC-123');
        const result = await handler!(uri);

        expect(mockAhaService.getEpic).toHaveBeenCalledWith('EPIC-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://epic/EPIC-123');
        expect(result.contents[0].text).toContain('Test Epic');
      });

      it('should throw error for missing ID', async () => {
        const handler = resourceHandlers.get('aha_epic');
        const uri = new URL('aha://epic/');

        await expect(handler!(uri)).rejects.toThrow('Invalid epic ID: ID is missing from URI');
      });
    });
  });

  describe('Collection Resources', () => {
    describe('aha_features resource', () => {
      it('should list features without parameters', async () => {
        const handler = resourceHandlers.get('aha_features');
        expect(handler).toBeDefined();

        const uri = new URL('aha://features');
        const result = await handler!(uri);

        expect(mockAhaService.listFeatures).toHaveBeenCalledWith(
          undefined,
          undefined,
          undefined,
          undefined
        );
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://features');
        expect(result.contents[0].text).toContain('FEAT-1');
      });

      it('should list features with query parameters', async () => {
        const handler = resourceHandlers.get('aha_features');
        const uri = new URL('aha://features?query=auth&tag=security&updatedSince=2023-01-01&assignedToUser=user123');
        const result = await handler!(uri);

        expect(mockAhaService.listFeatures).toHaveBeenCalledWith(
          'auth',
          '2023-01-01',
          'security',
          'user123'
        );
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://features?query=auth&tag=security&updatedSince=2023-01-01&assignedToUser=user123');
      });

      it('should handle partial query parameters', async () => {
        const handler = resourceHandlers.get('aha_features');
        const uri = new URL('aha://features?query=test&tag=bug');
        await handler!(uri);

        expect(mockAhaService.listFeatures).toHaveBeenCalledWith(
          'test',
          undefined,
          'bug',
          undefined
        );
      });
    });

    describe('aha_users resource', () => {
      it('should list all users', async () => {
        const handler = resourceHandlers.get('aha_users');
        expect(handler).toBeDefined();

        const uri = new URL('aha://users');
        const result = await handler!(uri);

        expect(mockAhaService.listUsers).toHaveBeenCalledWith();
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://users');
        expect(result.contents[0].text).toContain('USER-1');
      });
    });

    describe('aha_epics resource', () => {
      it('should list epics for a product', async () => {
        const handler = resourceHandlers.get('aha_epics');
        expect(handler).toBeDefined();

        const uri = new URL('aha://epics/PROJ-123');
        const result = await handler!(uri);

        expect(mockAhaService.listEpics).toHaveBeenCalledWith('PROJ-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://epics/PROJ-123');
        expect(result.contents[0].text).toContain('EPIC-1');
      });

      it('should throw error for missing product ID', async () => {
        const handler = resourceHandlers.get('aha_epics');
        const uri = new URL('aha://epics/');

        await expect(handler!(uri)).rejects.toThrow('Invalid product ID: Product ID is missing from URI');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const errorMessage = 'API Error';
      mockAhaService.getIdea.mockRejectedValue(new Error(errorMessage));

      const handler = resourceHandlers.get('aha_idea');
      const uri = new URL('aha://idea/IDEA-123');

      await expect(handler!(uri)).rejects.toThrow(errorMessage);
    });

    it('should handle network errors gracefully', async () => {
      mockAhaService.listFeatures.mockRejectedValue(new Error('Network error'));

      const handler = resourceHandlers.get('aha_features');
      const uri = new URL('aha://features');

      await expect(handler!(uri)).rejects.toThrow('Network error');
    });
  });

  describe('Resource Registration', () => {
    it('should register all expected resources', () => {
      const expectedResources = [
        'aha_idea',
        'aha_feature',
        'aha_user',
        'aha_epic',
        'aha_features',
        'aha_users',
        'aha_epics'
      ];

      expectedResources.forEach(resourceName => {
        expect(resourceHandlers.has(resourceName)).toBe(true);
      });
    });
  });
});