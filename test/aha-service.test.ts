import { describe, it, expect, beforeEach } from 'bun:test';
import { AhaService } from '../src/core/services/aha-service';

describe('AhaService', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.AHA_TOKEN;
    delete process.env.AHA_COMPANY;
    
    // Reset static state via reflection
    (AhaService as any).apiKey = null;
    (AhaService as any).subdomain = null;
    (AhaService as any).featuresApi = null;
    (AhaService as any).ideasApi = null;
    (AhaService as any).usersApi = null;
    (AhaService as any).epicsApi = null;
    (AhaService as any).defaultApi = null;
    (AhaService as any).productsApi = null;
    (AhaService as any).initiativesApi = null;
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
  });

  describe('with environment variables', () => {
    beforeEach(() => {
      process.env.AHA_TOKEN = 'test-token';
      process.env.AHA_COMPANY = 'test-company';
      // Reset static state but keep env vars
      (AhaService as any).apiKey = process.env.AHA_TOKEN;
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
  });
});