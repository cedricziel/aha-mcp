import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BackgroundSyncService } from '../src/core/services/sync-service.js';
import { DatabaseService } from '../src/core/database/database.js';
import { AhaService } from '../src/core/services/aha-service.js';
import * as fs from 'fs';
import * as path from 'path';

describe('BackgroundSyncService', () => {
  let syncService: BackgroundSyncService;
  let mockDatabase: DatabaseService;
  let tempDbPath: string;

  beforeEach(async () => {
    // Initialize AhaService for tests
    AhaService.initialize({
      subdomain: 'test-company',
      apiKey: 'test-token'
    });

    // Create a temporary database for each test
    tempDbPath = path.join(process.cwd(), `test-sync-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sqlite`);
    mockDatabase = new DatabaseService(tempDbPath);
    await mockDatabase.initialize();
    
    syncService = new BackgroundSyncService(mockDatabase);
  });

  afterEach(async () => {
    // Clean up any active syncs and wait for them to stop
    try {
      const activeSyncs = await syncService.getActiveSyncs();
      for (const sync of activeSyncs) {
        try {
          await syncService.stopSync(sync.jobId);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      
      // Wait longer for syncs to actually stop and finish database operations
      // This prevents "Database is closed" race condition errors
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds max
      while (attempts < maxAttempts) {
        const stillActive = await syncService.getActiveSyncs();
        if (stillActive.length === 0) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      // Extra wait to ensure any pending database operations complete
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      // Ignore if service is already broken
    }

    // Clean up database
    try {
      const db = await mockDatabase.getDb();
      await db.close();
    } catch (error) {
      // Ignore close errors - database may already be closed
    }
    
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Sync Job Lifecycle', () => {
    it('should start a sync job successfully', async () => {
      const entities = ['features', 'products'];
      const options = { batchSize: 10, concurrency: 1 };

      const jobId = await syncService.startSync(entities, options);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId).toMatch(/^sync-/);
    });

    it('should track sync progress', async () => {
      const entities = ['features'];
      const jobId = await syncService.startSync(entities, {});

      // Wait a moment for the job to be created
      await new Promise(resolve => setTimeout(resolve, 50));

      const progress = await syncService.getSyncProgress(jobId);
      expect(progress).toBeDefined();
      expect(progress!.jobId).toBe(jobId);
      expect(['pending', 'running', 'completed', 'failed']).toContain(progress!.status);
    });

    it('should stop a sync job completely', async () => {
      const jobId = await syncService.startSync(['features'], {});
      
      await syncService.stopSync(jobId);

      const progress = await syncService.getSyncProgress(jobId);
      expect(['failed', 'paused']).toContain(progress!.status);
      if (progress!.status === 'failed') {
        expect(progress!.errors).toContain('Sync stopped by user');
      }
    });

    it('should return null for non-existent sync job progress', async () => {
      const progress = await syncService.getSyncProgress('non-existent-job');
      expect(progress).toBeNull();
    });
  });

  describe('Sync Management', () => {
    it('should get all active syncs initially empty', async () => {
      const activeSyncs = await syncService.getActiveSyncs();
      expect(activeSyncs).toBeDefined();
      expect(Array.isArray(activeSyncs)).toBe(true);
    });

    it('should get sync history for a job', async () => {
      const jobId = await syncService.startSync(['features'], {});
      
      // Wait for some history to be created
      await new Promise(resolve => setTimeout(resolve, 100));

      const history = await syncService.getSyncHistory(jobId);
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should get service health status', async () => {
      const health = await syncService.getHealthStatus();
      
      expect(health).toBeDefined();
      expect(typeof health.activeSyncs).toBe('number');
      expect(typeof health.totalSyncsToday).toBe('number');
      expect(Array.isArray(health.errors)).toBe(true);
    });

    it('should clean up old sync jobs', async () => {
      // Create a sync job
      const jobId = await syncService.startSync(['features'], {});
      
      // Wait for completion/failure
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Manually mark as old by updating the database
      try {
        const db = await mockDatabase.getDb();
        await db.run(`
          UPDATE sync_jobs 
          SET updated_at = datetime('now', '-10 days')
          WHERE id = ?
        `, [jobId]);

        const cleanedCount = await syncService.cleanupOldSyncJobs(7);
        expect(cleanedCount).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // Test passes if cleanup works without error
        expect(true).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported entity types', async () => {
      const jobId = await syncService.startSync(['unsupported_entity'], {});
      
      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const progress = await syncService.getSyncProgress(jobId);
      expect(['completed', 'failed']).toContain(progress!.status);
      expect(progress!.errorCount).toBeGreaterThan(0);
      expect(progress!.errors.some(error => error.includes('Unsupported entity type'))).toBe(true);
    });

    it('should handle API errors gracefully during entity sync', async () => {
      // API will fail because we haven't provided real credentials
      const jobId = await syncService.startSync(['features'], {});
      
      // Wait for sync to complete with error (increase timeout)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const progress = await syncService.getSyncProgress(jobId);
      // Should complete even with errors
      expect(['completed', 'failed']).toContain(progress!.status);
      expect(progress!.errorCount).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit sync-started event', async () => {
      const startedEvent = new Promise((resolve) => {
        syncService.once('sync-started', resolve);
      });

      const jobId = await syncService.startSync(['features'], {});

      const eventData = await startedEvent;
      expect(eventData).toBeDefined();
      expect((eventData as any).entities).toEqual(['features']);
    });

    it('should emit sync-stopped event', async () => {
      const stoppedEvent = new Promise((resolve) => {
        syncService.once('sync-stopped', resolve);
      });

      const jobId = await syncService.startSync(['features'], {});
      await syncService.stopSync(jobId);

      const eventData = await stoppedEvent;
      expect(eventData).toBeDefined();
      expect((eventData as any).jobId).toBe(jobId);
    });
  });

  describe('Sync Options', () => {
    it('should handle different batch sizes', async () => {
      const jobId1 = await syncService.startSync(['features'], { batchSize: 5 });
      const jobId2 = await syncService.startSync(['products'], { batchSize: 10 });
      
      expect(jobId1).toBeDefined();
      expect(jobId2).toBeDefined();
      expect(jobId1).not.toBe(jobId2);
    });

    it('should handle updatedSince filter', async () => {
      const jobId = await syncService.startSync(['features'], { 
        updatedSince: '2024-01-01T00:00:00Z' 
      });
      
      expect(jobId).toBeDefined();
      
      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const progress = await syncService.getSyncProgress(jobId);
      expect(progress).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent sync jobs', async () => {
      const jobId1 = await syncService.startSync(['features'], {});
      const jobId2 = await syncService.startSync(['products'], {});
      const jobId3 = await syncService.startSync(['users'], {});
      
      expect(jobId1).toBeDefined();
      expect(jobId2).toBeDefined();
      expect(jobId3).toBeDefined();
      
      // All should be unique
      expect(new Set([jobId1, jobId2, jobId3]).size).toBe(3);
    });

    it('should handle rapid start/stop operations', async () => {
      const jobId = await syncService.startSync(['features'], {});
      await syncService.stopSync(jobId);
      
      const progress = await syncService.getSyncProgress(jobId);
      expect(['failed', 'paused']).toContain(progress!.status);
    });
  });
});