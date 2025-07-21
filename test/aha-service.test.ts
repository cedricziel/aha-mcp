import { describe, it, expect, beforeEach } from 'bun:test';
import { AhaService } from '../src/core/services/aha-service';

describe('AhaService', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.AHA_TOKEN;
    delete process.env.AHA_ACCESS_TOKEN;
    delete process.env.AHA_COMPANY;
    
    // Reset static state via reflection
    (AhaService as any).apiKey = null;
    (AhaService as any).accessToken = null;
    (AhaService as any).subdomain = null;
    (AhaService as any).featuresApi = null;
    (AhaService as any).ideasApi = null;
    (AhaService as any).usersApi = null;
    (AhaService as any).epicsApi = null;
    (AhaService as any).defaultApi = null;
    (AhaService as any).productsApi = null;
    (AhaService as any).initiativesApi = null;
    (AhaService as any).commentsApi = null;
    (AhaService as any).goalsApi = null;
    (AhaService as any).releasesApi = null;
    (AhaService as any).todosApi = null;
    (AhaService as any).competitorsApi = null;
    (AhaService as any).requirementsApi = null;
    (AhaService as any).releasePhasesApi = null;
    (AhaService as any).configuration = null;
  });

  describe('initialize', () => {
    it('should initialize with provided credentials', () => {
      expect(() => {
        AhaService.initialize('test-token', 'test-company');
      }).not.toThrow();
    });

    it('should throw error when attempting to use service without credentials', async () => {
      try {
        await AhaService.listFeatures();
        expect.unreachable('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Aha API client not initialized');
      }
    });

    it('should use Bearer token authentication when initialized with API key', () => {
      AhaService.initialize('test-api-key', 'test-company');
      
      // Access private static fields to verify Bearer token setup
      const apiKey = (AhaService as any).apiKey;
      const accessToken = (AhaService as any).accessToken;
      const configuration = (AhaService as any).configuration;
      
      // Verify the API key is stored
      expect(apiKey).toBe('test-api-key');
      
      // Verify the access token is set to the same value (for Bearer auth)
      expect(accessToken).toBe('test-api-key');
      
      // Verify the configuration uses accessToken for Bearer authentication
      expect(configuration).toBeTruthy();
      expect(configuration.accessToken).toBe('test-api-key');
      expect(configuration.apiKey).toBeUndefined();
    });

    it('should use Bearer token authentication with environment variables', () => {
      process.env.AHA_TOKEN = 'env-test-token';
      process.env.AHA_COMPANY = 'env-test-company';
      
      // Reset and reinitialize to pick up env vars
      (AhaService as any).apiKey = process.env.AHA_TOKEN;
      (AhaService as any).accessToken = process.env.AHA_TOKEN;
      (AhaService as any).subdomain = process.env.AHA_COMPANY;
      (AhaService as any).configuration = null;
      
      AhaService.initialize();
      
      const configuration = (AhaService as any).configuration;
      
      // Verify the configuration uses accessToken for Bearer authentication
      expect(configuration).toBeTruthy();
      expect(configuration.accessToken).toBe('env-test-token');
      expect(configuration.apiKey).toBeUndefined();
    });
  });

  describe('with environment variables', () => {
    beforeEach(() => {
      process.env.AHA_TOKEN = 'test-token';
      process.env.AHA_COMPANY = 'test-company';
      // Reset static state but keep env vars
      (AhaService as any).apiKey = process.env.AHA_TOKEN;
      (AhaService as any).accessToken = process.env.AHA_TOKEN;
      (AhaService as any).subdomain = process.env.AHA_COMPANY;
      (AhaService as any).featuresApi = null;
      (AhaService as any).configuration = null;
    });

    it('should initialize from environment variables', () => {
      expect(() => {
        AhaService.initialize();
      }).not.toThrow();
    });
  });

  describe('API methods', () => {
    beforeEach(() => {
      AhaService.initialize('test-token', 'test-company');
    });

    it('should have listFeatures method', () => {
      expect(typeof AhaService.listFeatures).toBe('function');
    });

    it('should have getFeature method', () => {
      expect(typeof AhaService.getFeature).toBe('function');
    });

    it('should have listUsers method', () => {
      expect(typeof AhaService.listUsers).toBe('function');
    });

    it('should have listEpics method', () => {
      expect(typeof AhaService.listEpics).toBe('function');
    });

    it('should have createFeatureComment method', () => {
      expect(typeof AhaService.createFeatureComment).toBe('function');
    });

    it('should have getIdea method', () => {
      expect(typeof AhaService.getIdea).toBe('function');
    });

    it('should have getUser method', () => {
      expect(typeof AhaService.getUser).toBe('function');
    });

    it('should have getEpic method', () => {
      expect(typeof AhaService.getEpic).toBe('function');
    });

    it('should have getProduct method', () => {
      expect(typeof AhaService.getProduct).toBe('function');
    });

    it('should have listProducts method', () => {
      expect(typeof AhaService.listProducts).toBe('function');
    });

    it('should have getInitiative method', () => {
      expect(typeof AhaService.getInitiative).toBe('function');
    });

    it('should have listInitiatives method', () => {
      expect(typeof AhaService.listInitiatives).toBe('function');
    });

    it('should have listIdeasByProduct method', () => {
      expect(typeof AhaService.listIdeasByProduct).toBe('function');
    });

    it('should have getEpicComments method', () => {
      expect(typeof AhaService.getEpicComments).toBe('function');
    });

    it('should have getIdeaComments method', () => {
      expect(typeof AhaService.getIdeaComments).toBe('function');
    });

    it('should have getInitiativeComments method', () => {
      expect(typeof AhaService.getInitiativeComments).toBe('function');
    });

    it('should have getProductComments method', () => {
      expect(typeof AhaService.getProductComments).toBe('function');
    });

    it('should have getGoalComments method', () => {
      expect(typeof AhaService.getGoalComments).toBe('function');
    });

    it('should have getReleaseComments method', () => {
      expect(typeof AhaService.getReleaseComments).toBe('function');
    });

    it('should have getReleasePhaseComments method', () => {
      expect(typeof AhaService.getReleasePhaseComments).toBe('function');
    });

    it('should have getRequirementComments method', () => {
      expect(typeof AhaService.getRequirementComments).toBe('function');
    });

    it('should have getTodoComments method', () => {
      expect(typeof AhaService.getTodoComments).toBe('function');
    });

    it('should have getGoal method', () => {
      expect(typeof AhaService.getGoal).toBe('function');
    });

    it('should have listGoals method', () => {
      expect(typeof AhaService.listGoals).toBe('function');
    });

    it('should have getGoalEpics method', () => {
      expect(typeof AhaService.getGoalEpics).toBe('function');
    });

    it('should have getRelease method', () => {
      expect(typeof AhaService.getRelease).toBe('function');
    });

    it('should have listReleases method', () => {
      expect(typeof AhaService.listReleases).toBe('function');
    });

    it('should have getReleaseFeatures method', () => {
      expect(typeof AhaService.getReleaseFeatures).toBe('function');
    });

    it('should have getReleaseEpics method', () => {
      expect(typeof AhaService.getReleaseEpics).toBe('function');
    });

    it('should have getReleasePhase method', () => {
      expect(typeof AhaService.getReleasePhase).toBe('function');
    });

    it('should have listReleasePhases method', () => {
      expect(typeof AhaService.listReleasePhases).toBe('function');
    });

    it('should have getRequirement method', () => {
      expect(typeof AhaService.getRequirement).toBe('function');
    });

    it('should have getCompetitor method', () => {
      expect(typeof AhaService.getCompetitor).toBe('function');
    });

    it('should have getTodo method', () => {
      expect(typeof AhaService.getTodo).toBe('function');
    });

    it('should have listCompetitors method', () => {
      expect(typeof AhaService.listCompetitors).toBe('function');
    });

    // Relationship/Association methods
    it('should have associateFeatureWithEpic method', () => {
      expect(typeof AhaService.associateFeatureWithEpic).toBe('function');
    });

    it('should have moveFeatureToRelease method', () => {
      expect(typeof AhaService.moveFeatureToRelease).toBe('function');
    });

    it('should have associateFeatureWithGoals method', () => {
      expect(typeof AhaService.associateFeatureWithGoals).toBe('function');
    });

    it('should have updateFeatureTags method', () => {
      expect(typeof AhaService.updateFeatureTags).toBe('function');
    });

    it('should have createEpicInProduct method', () => {
      expect(typeof AhaService.createEpicInProduct).toBe('function');
    });

    it('should have createEpicInRelease method', () => {
      expect(typeof AhaService.createEpicInRelease).toBe('function');
    });

    it('should have createInitiativeInProduct method', () => {
      expect(typeof AhaService.createInitiativeInProduct).toBe('function');
    });

    // Feature CRUD methods (Phase 8A.1)
    it('should have createFeature method', () => {
      expect(typeof AhaService.createFeature).toBe('function');
    });

    it('should have updateFeature method', () => {
      expect(typeof AhaService.updateFeature).toBe('function');
    });

    it('should have deleteFeature method', () => {
      expect(typeof AhaService.deleteFeature).toBe('function');
    });

    it('should have updateFeatureProgress method', () => {
      expect(typeof AhaService.updateFeatureProgress).toBe('function');
    });

    it('should have updateFeatureScore method', () => {
      expect(typeof AhaService.updateFeatureScore).toBe('function');
    });

    it('should have updateFeatureCustomFields method', () => {
      expect(typeof AhaService.updateFeatureCustomFields).toBe('function');
    });

    // Epic CRUD methods (Phase 8A.2)
    it('should have updateEpic method', () => {
      expect(typeof AhaService.updateEpic).toBe('function');
    });

    it('should have deleteEpic method', () => {
      expect(typeof AhaService.deleteEpic).toBe('function');
    });

    // Idea CRUD methods (Phase 8A.3)
    it('should have createIdea method', () => {
      expect(typeof AhaService.createIdea).toBe('function');
    });

    it('should have createIdeaWithCategory method', () => {
      expect(typeof AhaService.createIdeaWithCategory).toBe('function');
    });

    it('should have createIdeaWithScore method', () => {
      expect(typeof AhaService.createIdeaWithScore).toBe('function');
    });

    it('should have deleteIdea method', () => {
      expect(typeof AhaService.deleteIdea).toBe('function');
    });

    // Competitor CRUD methods (Phase 8B.1)
    it('should have createCompetitor method', () => {
      expect(typeof AhaService.createCompetitor).toBe('function');
    });

    it('should have updateCompetitor method', () => {
      expect(typeof AhaService.updateCompetitor).toBe('function');
    });

    it('should have deleteCompetitor method', () => {
      expect(typeof AhaService.deleteCompetitor).toBe('function');
    });

    // Initiative enhancement methods (Phase 8B.2)
    it('should have getInitiativeEpics method', () => {
      expect(typeof AhaService.getInitiativeEpics).toBe('function');
    });

    // Portal integration & advanced features (Phase 8C)
    it('should have createIdeaByPortalUser method', () => {
      expect(typeof AhaService.createIdeaByPortalUser).toBe('function');
    });

    it('should have createIdeaWithPortalSettings method', () => {
      expect(typeof AhaService.createIdeaWithPortalSettings).toBe('function');
    });
  });
});