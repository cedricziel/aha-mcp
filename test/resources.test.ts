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
  getProduct: mock(() => Promise.resolve({ id: 'PROD-123', name: 'Test Product' })),
  getInitiative: mock(() => Promise.resolve({ id: 'INIT-123', name: 'Test Initiative' })),
  listFeatures: mock(() => Promise.resolve({ features: [{ id: 'FEAT-1' }, { id: 'FEAT-2' }] })),
  listUsers: mock(() => Promise.resolve({ users: [{ id: 'USER-1' }, { id: 'USER-2' }] })),
  listEpics: mock(() => Promise.resolve({ epics: [{ id: 'EPIC-1' }, { id: 'EPIC-2' }] })),
  listProducts: mock(() => Promise.resolve({ products: [{ id: 'PROD-1' }, { id: 'PROD-2' }] })),
  listInitiatives: mock(() => Promise.resolve({ initiatives: [{ id: 'INIT-1' }, { id: 'INIT-2' }] })),
  listIdeasByProduct: mock(() => Promise.resolve({ ideas: [{ id: 'IDEA-1' }, { id: 'IDEA-2' }] })),
  getEpicComments: mock(() => Promise.resolve({ comments: [{ id: 'COMMENT-1', body: 'Test epic comment' }] })),
  getIdeaComments: mock(() => Promise.resolve({ comments: [{ id: 'COMMENT-2', body: 'Test idea comment' }] })),
  getInitiativeComments: mock(() => Promise.resolve({ comments: [{ id: 'COMMENT-3', body: 'Test initiative comment' }] })),
  getProductComments: mock(() => Promise.resolve({ comments: [{ id: 'COMMENT-4', body: 'Test product comment' }] })),
  getGoalComments: mock(() => Promise.resolve({ comments: [{ id: 'COMMENT-5', body: 'Test goal comment' }] })),
  getReleaseComments: mock(() => Promise.resolve({ comments: [{ id: 'COMMENT-6', body: 'Test release comment' }] })),
  getReleasePhaseComments: mock(() => Promise.resolve({ comments: [{ id: 'COMMENT-7', body: 'Test release phase comment' }] })),
  getRequirementComments: mock(() => Promise.resolve({ comments: [{ id: 'COMMENT-8', body: 'Test requirement comment' }] })),
  getTodoComments: mock(() => Promise.resolve({ comments: [{ id: 'COMMENT-9', body: 'Test todo comment' }] })),
  getGoal: mock(() => Promise.resolve({ id: 'GOAL-123', name: 'Test Goal' })),
  listGoals: mock(() => Promise.resolve({ goals: [{ id: 'GOAL-1' }, { id: 'GOAL-2' }] })),
  getGoalEpics: mock(() => Promise.resolve({ epics: [{ id: 'EPIC-1' }, { id: 'EPIC-2' }] }))
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
      getProduct: AhaService.getProduct,
      getInitiative: AhaService.getInitiative,
      listFeatures: AhaService.listFeatures,
      listUsers: AhaService.listUsers,
      listEpics: AhaService.listEpics,
      listProducts: AhaService.listProducts,
      listInitiatives: AhaService.listInitiatives,
      listIdeasByProduct: AhaService.listIdeasByProduct,
      getEpicComments: AhaService.getEpicComments,
      getIdeaComments: AhaService.getIdeaComments,
      getInitiativeComments: AhaService.getInitiativeComments,
      getProductComments: AhaService.getProductComments,
      getGoalComments: AhaService.getGoalComments,
      getReleaseComments: AhaService.getReleaseComments,
      getReleasePhaseComments: AhaService.getReleasePhaseComments,
      getRequirementComments: AhaService.getRequirementComments,
      getTodoComments: AhaService.getTodoComments,
      getGoal: AhaService.getGoal,
      listGoals: AhaService.listGoals,
      getGoalEpics: AhaService.getGoalEpics
    };

    // Reset mocks
    Object.values(mockAhaService).forEach(mock => mock.mockClear());
    
    // Mock AhaService methods
    (AhaService as any).getIdea = mockAhaService.getIdea;
    (AhaService as any).getFeature = mockAhaService.getFeature;
    (AhaService as any).getUser = mockAhaService.getUser;
    (AhaService as any).getEpic = mockAhaService.getEpic;
    (AhaService as any).getProduct = mockAhaService.getProduct;
    (AhaService as any).getInitiative = mockAhaService.getInitiative;
    (AhaService as any).listFeatures = mockAhaService.listFeatures;
    (AhaService as any).listUsers = mockAhaService.listUsers;
    (AhaService as any).listEpics = mockAhaService.listEpics;
    (AhaService as any).listProducts = mockAhaService.listProducts;
    (AhaService as any).listInitiatives = mockAhaService.listInitiatives;
    (AhaService as any).listIdeasByProduct = mockAhaService.listIdeasByProduct;
    (AhaService as any).getEpicComments = mockAhaService.getEpicComments;
    (AhaService as any).getIdeaComments = mockAhaService.getIdeaComments;
    (AhaService as any).getInitiativeComments = mockAhaService.getInitiativeComments;
    (AhaService as any).getProductComments = mockAhaService.getProductComments;
    (AhaService as any).getGoalComments = mockAhaService.getGoalComments;
    (AhaService as any).getReleaseComments = mockAhaService.getReleaseComments;
    (AhaService as any).getReleasePhaseComments = mockAhaService.getReleasePhaseComments;
    (AhaService as any).getRequirementComments = mockAhaService.getRequirementComments;
    (AhaService as any).getTodoComments = mockAhaService.getTodoComments;
    (AhaService as any).getGoal = mockAhaService.getGoal;
    (AhaService as any).listGoals = mockAhaService.listGoals;
    (AhaService as any).getGoalEpics = mockAhaService.getGoalEpics;

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
    (AhaService as any).getProduct = originalMethods.getProduct;
    (AhaService as any).getInitiative = originalMethods.getInitiative;
    (AhaService as any).listFeatures = originalMethods.listFeatures;
    (AhaService as any).listUsers = originalMethods.listUsers;
    (AhaService as any).listEpics = originalMethods.listEpics;
    (AhaService as any).listProducts = originalMethods.listProducts;
    (AhaService as any).listInitiatives = originalMethods.listInitiatives;
    (AhaService as any).listIdeasByProduct = originalMethods.listIdeasByProduct;
    (AhaService as any).getEpicComments = originalMethods.getEpicComments;
    (AhaService as any).getIdeaComments = originalMethods.getIdeaComments;
    (AhaService as any).getInitiativeComments = originalMethods.getInitiativeComments;
    (AhaService as any).getProductComments = originalMethods.getProductComments;
    (AhaService as any).getGoalComments = originalMethods.getGoalComments;
    (AhaService as any).getReleaseComments = originalMethods.getReleaseComments;
    (AhaService as any).getReleasePhaseComments = originalMethods.getReleasePhaseComments;
    (AhaService as any).getRequirementComments = originalMethods.getRequirementComments;
    (AhaService as any).getTodoComments = originalMethods.getTodoComments;
    (AhaService as any).getGoal = originalMethods.getGoal;
    (AhaService as any).listGoals = originalMethods.listGoals;
    (AhaService as any).getGoalEpics = originalMethods.getGoalEpics;
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

    describe('aha_product resource', () => {
      it('should retrieve product by ID', async () => {
        const handler = resourceHandlers.get('aha_product');
        expect(handler).toBeDefined();

        const uri = new URL('aha://product/PROD-123');
        const result = await handler!(uri);

        expect(mockAhaService.getProduct).toHaveBeenCalledWith('PROD-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://product/PROD-123');
        expect(result.contents[0].text).toContain('Test Product');
      });

      it('should throw error for missing ID', async () => {
        const handler = resourceHandlers.get('aha_product');
        const uri = new URL('aha://product/');

        await expect(handler!(uri)).rejects.toThrow('Invalid product ID: ID is missing from URI');
      });
    });

    describe('aha_initiative resource', () => {
      it('should retrieve initiative by ID', async () => {
        const handler = resourceHandlers.get('aha_initiative');
        expect(handler).toBeDefined();

        const uri = new URL('aha://initiative/INIT-123');
        const result = await handler!(uri);

        expect(mockAhaService.getInitiative).toHaveBeenCalledWith('INIT-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://initiative/INIT-123');
        expect(result.contents[0].text).toContain('Test Initiative');
      });

      it('should throw error for missing ID', async () => {
        const handler = resourceHandlers.get('aha_initiative');
        const uri = new URL('aha://initiative/');

        await expect(handler!(uri)).rejects.toThrow('Invalid initiative ID: ID is missing from URI');
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

    describe('aha_products resource', () => {
      it('should list all products', async () => {
        const handler = resourceHandlers.get('aha_products');
        expect(handler).toBeDefined();

        const uri = new URL('aha://products');
        const result = await handler!(uri);

        expect(mockAhaService.listProducts).toHaveBeenCalledWith();
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://products');
        expect(result.contents[0].text).toContain('PROD-1');
      });
    });

    describe('aha_initiatives resource', () => {
      it('should list all initiatives', async () => {
        const handler = resourceHandlers.get('aha_initiatives');
        expect(handler).toBeDefined();

        const uri = new URL('aha://initiatives');
        const result = await handler!(uri);

        expect(mockAhaService.listInitiatives).toHaveBeenCalledWith();
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://initiatives');
        expect(result.contents[0].text).toContain('INIT-1');
      });
    });

    describe('aha_ideas_by_product resource', () => {
      it('should list ideas for a product', async () => {
        const handler = resourceHandlers.get('aha_ideas_by_product');
        expect(handler).toBeDefined();

        const uri = new URL('aha://ideas/PROJ-123');
        const result = await handler!(uri);

        expect(mockAhaService.listIdeasByProduct).toHaveBeenCalledWith('PROJ-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://ideas/PROJ-123');
        expect(result.contents[0].text).toContain('IDEA-1');
      });

      it('should throw error for missing product ID', async () => {
        const handler = resourceHandlers.get('aha_ideas_by_product');
        const uri = new URL('aha://ideas/');

        await expect(handler!(uri)).rejects.toThrow('Invalid product ID: Product ID is missing from URI');
      });
    });
  });

  describe('Comment Resources', () => {
    describe('aha_epic_comments resource', () => {
      it('should retrieve comments for epic', async () => {
        const handler = resourceHandlers.get('aha_epic_comments');
        expect(handler).toBeDefined();

        const uri = new URL('aha://comments/epic/EPIC-123');
        const result = await handler!(uri);

        expect(mockAhaService.getEpicComments).toHaveBeenCalledWith('EPIC-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://comments/epic/EPIC-123');
        expect(result.contents[0].text).toContain('Test epic comment');
      });

      it('should throw error for missing epic ID', async () => {
        const handler = resourceHandlers.get('aha_epic_comments');
        const uri = new URL('aha://comments/epic/');

        await expect(handler!(uri)).rejects.toThrow('Invalid epic ID: Epic ID is missing from URI');
      });
    });

    describe('aha_idea_comments resource', () => {
      it('should retrieve comments for idea', async () => {
        const handler = resourceHandlers.get('aha_idea_comments');
        expect(handler).toBeDefined();

        const uri = new URL('aha://comments/idea/IDEA-123');
        const result = await handler!(uri);

        expect(mockAhaService.getIdeaComments).toHaveBeenCalledWith('IDEA-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://comments/idea/IDEA-123');
        expect(result.contents[0].text).toContain('Test idea comment');
      });

      it('should throw error for missing idea ID', async () => {
        const handler = resourceHandlers.get('aha_idea_comments');
        const uri = new URL('aha://comments/idea/');

        await expect(handler!(uri)).rejects.toThrow('Invalid idea ID: Idea ID is missing from URI');
      });
    });

    describe('aha_initiative_comments resource', () => {
      it('should retrieve comments for initiative', async () => {
        const handler = resourceHandlers.get('aha_initiative_comments');
        expect(handler).toBeDefined();

        const uri = new URL('aha://comments/initiative/INIT-123');
        const result = await handler!(uri);

        expect(mockAhaService.getInitiativeComments).toHaveBeenCalledWith('INIT-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://comments/initiative/INIT-123');
        expect(result.contents[0].text).toContain('Test initiative comment');
      });

      it('should throw error for missing initiative ID', async () => {
        const handler = resourceHandlers.get('aha_initiative_comments');
        const uri = new URL('aha://comments/initiative/');

        await expect(handler!(uri)).rejects.toThrow('Invalid initiative ID: Initiative ID is missing from URI');
      });
    });

    describe('aha_product_comments resource', () => {
      it('should retrieve comments for product', async () => {
        const handler = resourceHandlers.get('aha_product_comments');
        expect(handler).toBeDefined();

        const uri = new URL('aha://comments/product/PROD-123');
        const result = await handler!(uri);

        expect(mockAhaService.getProductComments).toHaveBeenCalledWith('PROD-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://comments/product/PROD-123');
        expect(result.contents[0].text).toContain('Test product comment');
      });

      it('should throw error for missing product ID', async () => {
        const handler = resourceHandlers.get('aha_product_comments');
        const uri = new URL('aha://comments/product/');

        await expect(handler!(uri)).rejects.toThrow('Invalid product ID: Product ID is missing from URI');
      });
    });

    describe('aha_goal_comments resource', () => {
      it('should retrieve comments for goal', async () => {
        const handler = resourceHandlers.get('aha_goal_comments');
        expect(handler).toBeDefined();

        const uri = new URL('aha://comments/goal/GOAL-123');
        const result = await handler!(uri);

        expect(mockAhaService.getGoalComments).toHaveBeenCalledWith('GOAL-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://comments/goal/GOAL-123');
        expect(result.contents[0].text).toContain('Test goal comment');
      });

      it('should throw error for missing goal ID', async () => {
        const handler = resourceHandlers.get('aha_goal_comments');
        const uri = new URL('aha://comments/goal/');

        await expect(handler!(uri)).rejects.toThrow('Invalid goal ID: Goal ID is missing from URI');
      });
    });

    describe('aha_release_comments resource', () => {
      it('should retrieve comments for release', async () => {
        const handler = resourceHandlers.get('aha_release_comments');
        expect(handler).toBeDefined();

        const uri = new URL('aha://comments/release/REL-123');
        const result = await handler!(uri);

        expect(mockAhaService.getReleaseComments).toHaveBeenCalledWith('REL-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://comments/release/REL-123');
        expect(result.contents[0].text).toContain('Test release comment');
      });

      it('should throw error for missing release ID', async () => {
        const handler = resourceHandlers.get('aha_release_comments');
        const uri = new URL('aha://comments/release/');

        await expect(handler!(uri)).rejects.toThrow('Invalid release ID: Release ID is missing from URI');
      });
    });

    describe('aha_release_phase_comments resource', () => {
      it('should retrieve comments for release phase', async () => {
        const handler = resourceHandlers.get('aha_release_phase_comments');
        expect(handler).toBeDefined();

        const uri = new URL('aha://comments/release-phase/RP-123');
        const result = await handler!(uri);

        expect(mockAhaService.getReleasePhaseComments).toHaveBeenCalledWith('RP-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://comments/release-phase/RP-123');
        expect(result.contents[0].text).toContain('Test release phase comment');
      });

      it('should throw error for missing release phase ID', async () => {
        const handler = resourceHandlers.get('aha_release_phase_comments');
        const uri = new URL('aha://comments/release-phase/');

        await expect(handler!(uri)).rejects.toThrow('Invalid release phase ID: Release phase ID is missing from URI');
      });
    });

    describe('aha_requirement_comments resource', () => {
      it('should retrieve comments for requirement', async () => {
        const handler = resourceHandlers.get('aha_requirement_comments');
        expect(handler).toBeDefined();

        const uri = new URL('aha://comments/requirement/REQ-123');
        const result = await handler!(uri);

        expect(mockAhaService.getRequirementComments).toHaveBeenCalledWith('REQ-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://comments/requirement/REQ-123');
        expect(result.contents[0].text).toContain('Test requirement comment');
      });

      it('should throw error for missing requirement ID', async () => {
        const handler = resourceHandlers.get('aha_requirement_comments');
        const uri = new URL('aha://comments/requirement/');

        await expect(handler!(uri)).rejects.toThrow('Invalid requirement ID: Requirement ID is missing from URI');
      });
    });

    describe('aha_todo_comments resource', () => {
      it('should retrieve comments for todo', async () => {
        const handler = resourceHandlers.get('aha_todo_comments');
        expect(handler).toBeDefined();

        const uri = new URL('aha://comments/todo/TODO-123');
        const result = await handler!(uri);

        expect(mockAhaService.getTodoComments).toHaveBeenCalledWith('TODO-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://comments/todo/TODO-123');
        expect(result.contents[0].text).toContain('Test todo comment');
      });

      it('should throw error for missing todo ID', async () => {
        const handler = resourceHandlers.get('aha_todo_comments');
        const uri = new URL('aha://comments/todo/');

        await expect(handler!(uri)).rejects.toThrow('Invalid todo ID: Todo ID is missing from URI');
      });
    });
  });

  describe('Goals Resources', () => {
    describe('aha_goal resource', () => {
      it('should retrieve goal by ID', async () => {
        const handler = resourceHandlers.get('aha_goal');
        expect(handler).toBeDefined();

        const uri = new URL('aha://goal/GOAL-123');
        const result = await handler!(uri);

        expect(mockAhaService.getGoal).toHaveBeenCalledWith('GOAL-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://goal/GOAL-123');
        expect(result.contents[0].text).toContain('Test Goal');
      });

      it('should throw error for missing goal ID', async () => {
        const handler = resourceHandlers.get('aha_goal');
        const uri = new URL('aha://goal/');

        await expect(handler!(uri)).rejects.toThrow('Invalid goal ID: ID is missing from URI');
      });
    });

    describe('aha_goals resource', () => {
      it('should list all goals', async () => {
        const handler = resourceHandlers.get('aha_goals');
        expect(handler).toBeDefined();

        const uri = new URL('aha://goals');
        const result = await handler!(uri);

        expect(mockAhaService.listGoals).toHaveBeenCalledWith();
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://goals');
        expect(result.contents[0].text).toContain('GOAL-1');
      });
    });

    describe('aha_goal_epics resource', () => {
      it('should retrieve epics for goal', async () => {
        const handler = resourceHandlers.get('aha_goal_epics');
        expect(handler).toBeDefined();

        const uri = new URL('aha://goal/GOAL-123/epics');
        const result = await handler!(uri);

        expect(mockAhaService.getGoalEpics).toHaveBeenCalledWith('GOAL-123');
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('aha://goal/GOAL-123/epics');
        expect(result.contents[0].text).toContain('EPIC-1');
      });

      it('should throw error for missing goal ID', async () => {
        const handler = resourceHandlers.get('aha_goal_epics');
        const uri = new URL('aha://goal//epics');

        await expect(handler!(uri)).rejects.toThrow('Invalid goal ID: Goal ID is missing from URI');
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
        'aha_product',
        'aha_initiative',
        'aha_features',
        'aha_users',
        'aha_epics',
        'aha_products',
        'aha_initiatives',
        'aha_ideas_by_product',
        'aha_epic_comments',
        'aha_idea_comments',
        'aha_initiative_comments',
        'aha_product_comments',
        'aha_goal_comments',
        'aha_release_comments',
        'aha_release_phase_comments',
        'aha_requirement_comments',
        'aha_todo_comments',
        'aha_goal',
        'aha_goals',
        'aha_goal_epics'
      ];

      expectedResources.forEach(resourceName => {
        expect(resourceHandlers.has(resourceName)).toBe(true);
      });
    });
  });
});