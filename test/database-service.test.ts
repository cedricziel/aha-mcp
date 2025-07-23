import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { DatabaseService } from '../src/core/database/database.js';
import { Database } from 'sqlite';
import * as fs from 'fs';
import * as path from 'path';

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let tempDbPath: string;

  beforeEach(async () => {
    // Create a temporary database file for each test
    tempDbPath = path.join(process.cwd(), `test-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sqlite`);
    databaseService = new DatabaseService(tempDbPath);
    await databaseService.initialize();
  });

  afterEach(async () => {
    // Clean up temporary database
    try {
      const db = await databaseService.getDb();
      await db.close();
    } catch (error) {
      // Ignore close errors
    }
    
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should initialize with default path when no path provided', async () => {
      const service = new DatabaseService();
      expect(service).toBeDefined();
      expect(typeof service.initialize).toBe('function');
    });

    it('should initialize database with custom path', async () => {
      expect(databaseService).toBeDefined();
      const db = await databaseService.getDb();
      expect(db).toBeDefined();
    });

    it('should create all required tables', async () => {
      const db = await databaseService.getDb();
      
      // Check for core tables
      const tables = await db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      
      const tableNames = tables.map(t => t.name);
      
      // Core entity tables
      expect(tableNames).toContain('products');
      expect(tableNames).toContain('features');
      expect(tableNames).toContain('ideas');
      expect(tableNames).toContain('epics');
      expect(tableNames).toContain('initiatives');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('releases');
      expect(tableNames).toContain('goals');
      expect(tableNames).toContain('comments');
      
      // Sync tables
      expect(tableNames).toContain('sync_jobs');
      expect(tableNames).toContain('sync_history');
      expect(tableNames).toContain('sync_status');
      
      // Embedding tables
      expect(tableNames).toContain('embedding_jobs');
      expect(tableNames).toContain('embeddings');
      expect(tableNames).toContain('embedding_metadata');
      
      // Config and search tables
      expect(tableNames).toContain('server_config');
      expect(tableNames).toContain('search_cache');
    });

    it('should insert default configuration values', async () => {
      const db = await databaseService.getDb();
      const configs = await db.all('SELECT key, value FROM server_config ORDER BY key');
      
      expect(configs.length).toBeGreaterThan(0);
      
      const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]));
      expect(configMap['sync_interval_minutes']).toBe('30');
      expect(configMap['enable_semantic_search']).toBe('true');
      expect(configMap['embedding_model']).toBe('all-MiniLM-L6-v2');
    });
  });

  describe('Entity Operations', () => {
    describe('Product Operations', () => {
      it('should upsert a product successfully', async () => {
        const productData = {
          id: 'PROD-123',
          name: 'Test Product',
          description: 'A test product',
          reference_prefix: 'TEST',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };

        await databaseService.upsertProduct(productData);

        const db = await databaseService.getDb();
        const product = await db.get('SELECT * FROM products WHERE id = ?', [productData.id]);
        
        expect(product).toBeDefined();
        expect(product.id).toBe(productData.id);
        expect(product.name).toBe(productData.name);
        expect(product.description).toBe(productData.description);
      });

      it('should update existing product on upsert', async () => {
        const productData = {
          id: 'PROD-123',
          name: 'Test Product',
          description: 'Original description',
          reference_prefix: 'TEST'
        };

        // Insert initial product
        await databaseService.upsertProduct(productData);

        // Update the product
        const updatedData = {
          ...productData,
          name: 'Updated Product',
          description: 'Updated description'
        };
        await databaseService.upsertProduct(updatedData);

        const db = await databaseService.getDb();
        const product = await db.get('SELECT * FROM products WHERE id = ?', [productData.id]);
        
        expect(product.name).toBe('Updated Product');
        expect(product.description).toBe('Updated description');
      });
    });

    describe('Feature Operations', () => {
      it('should upsert a feature successfully', async () => {
        const featureData = {
          id: 'FEAT-123',
          name: 'Test Feature',
          description: 'A test feature',
          reference_num: 'TEST-123',
          feature_type: 'enhancement',
          workflow_status: 'new',
          progress: 0.25,
          score: 85.5,
          product_id: 'PROD-123',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };

        await databaseService.upsertFeature(featureData);

        const db = await databaseService.getDb();
        const feature = await db.get('SELECT * FROM features WHERE id = ?', [featureData.id]);
        
        expect(feature).toBeDefined();
        expect(feature.id).toBe(featureData.id);
        expect(feature.name).toBe(featureData.name);
        expect(feature.progress).toBe(featureData.progress);
        expect(feature.score).toBe(featureData.score);
      });

      it('should handle features without optional fields', async () => {
        const featureData = {
          id: 'FEAT-456',
          name: 'Minimal Feature'
        };

        await databaseService.upsertFeature(featureData);

        const db = await databaseService.getDb();
        const feature = await db.get('SELECT * FROM features WHERE id = ?', [featureData.id]);
        
        expect(feature).toBeDefined();
        expect(feature.id).toBe(featureData.id);
        expect(feature.name).toBe(featureData.name);
        expect(feature.description).toBeNull();
        expect(feature.progress).toBeNull();
      });
    });
  });

  describe('Sync Job Operations', () => {
    it('should create a sync job successfully', async () => {
      const entities = ['features', 'products'];
      const options = { batchSize: 50, concurrency: 2 };
      
      const jobId = await databaseService.createSyncJob(entities, options);
      
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId).toMatch(/^sync-/);

      const db = await databaseService.getDb();
      const job = await db.get('SELECT * FROM sync_jobs WHERE id = ?', [jobId]);
      
      expect(job).toBeDefined();
      expect(job.id).toBe(jobId);
      expect(job.status).toBe('pending');
      expect(JSON.parse(job.entities)).toEqual(entities);
      expect(job.configuration ? JSON.parse(job.configuration) : null).toEqual(options);
    });

    it('should update sync job progress', async () => {
      const jobId = await databaseService.createSyncJob(['features'], {});
      
      const updates = {
        status: 'running',
        progress: 50,
        current_entity: 'features',
        processed_count: 25,
        error_count: 2,
        started_at: new Date()
      };

      await databaseService.updateSyncJobProgress(jobId, updates);

      const db = await databaseService.getDb();
      const job = await db.get('SELECT * FROM sync_jobs WHERE id = ?', [jobId]);
      
      expect(job.status).toBe('running');
      expect(job.progress).toBe(50);
      expect(job.current_entity).toBe('features');
      expect(job.processed_count).toBe(25);
      expect(job.error_count).toBe(2);
      expect(job.started_at).toBeDefined();
    });

    it('should retrieve sync job by id', async () => {
      const entities = ['products'];
      const jobId = await databaseService.createSyncJob(entities, {});
      
      const job = await databaseService.getSyncJob(jobId);
      
      expect(job).toBeDefined();
      expect(job!.id).toBe(jobId);
      expect(job!.status).toBe('pending');
      expect(job!.entities).toEqual(entities);
    });

    it('should return null for non-existent sync job', async () => {
      const job = await databaseService.getSyncJob('non-existent-job');
      expect(job).toBeNull();
    });

    it('should get active sync jobs', async () => {
      // Create some jobs with different statuses
      const jobId1 = await databaseService.createSyncJob(['features'], {});
      const jobId2 = await databaseService.createSyncJob(['products'], {});
      const jobId3 = await databaseService.createSyncJob(['users'], {});
      
      // Update statuses
      await databaseService.updateSyncJobProgress(jobId1, { status: 'running' });
      await databaseService.updateSyncJobProgress(jobId2, { status: 'completed' });
      await databaseService.updateSyncJobProgress(jobId3, { status: 'paused' });
      
      const activeJobs = await databaseService.getActiveSyncJobs();
      
      // Should include running and paused, but not completed
      expect(activeJobs.length).toBe(2);
      const activeIds = activeJobs.map(job => job.id);
      expect(activeIds).toContain(jobId1);
      expect(activeIds).toContain(jobId3);
      expect(activeIds).not.toContain(jobId2);
    });
  });

  describe('Sync History Operations', () => {
    it('should add sync history entry', async () => {
      const jobId = await databaseService.createSyncJob(['features'], {});
      
      await databaseService.addSyncHistory(
        jobId,
        'features',
        'sync_start',
        'FEAT-123',
        { message: 'Started syncing features' }
      );

      const history = await databaseService.getSyncHistory(jobId, 10);
      
      expect(history.length).toBe(1);
      expect(history[0].job_id).toBe(jobId);
      expect(history[0].entity_type).toBe('features');
      expect(history[0].action).toBe('sync_start');
      expect(history[0].entity_id).toBe('FEAT-123');
      expect(history[0].details).toEqual({ message: 'Started syncing features' });
    });

    it('should limit sync history results', async () => {
      const jobId = await databaseService.createSyncJob(['features'], {});
      
      // Add multiple history entries
      for (let i = 0; i < 15; i++) {
        await databaseService.addSyncHistory(
          jobId,
          'features',
          'entity_processed',
          `FEAT-${i}`,
          { index: i }
        );
      }

      const history = await databaseService.getSyncHistory(jobId, 5);
      
      expect(history.length).toBe(5);
      // Should be in reverse chronological order (most recent first)
      // Just verify we got the limited number of results
      expect(history.every(h => h.job_id === jobId)).toBe(true);
      expect(history.every(h => h.action === 'entity_processed')).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should get configuration value', async () => {
      const value = await databaseService.getConfig('sync_interval_minutes');
      expect(value).toBe('30');
    });

    it('should get all configuration values', async () => {
      const allConfig = await databaseService.getConfig();
      
      expect(allConfig).toBeDefined();
      expect(typeof allConfig).toBe('object');
      expect(allConfig['sync_interval_minutes']).toBe('30');
    });

    it('should return null for non-existent config key', async () => {
      const value = await databaseService.getConfig('non_existent_key');
      expect(value).toBeNull();
    });
  });

  describe('Health Status', () => {
    it('should return health status with basic info', async () => {
      // Add some test data
      await databaseService.upsertProduct({ id: 'PROD-1', name: 'Product 1' });
      await databaseService.upsertFeature({ id: 'FEAT-1', name: 'Feature 1' });
      
      const health = await databaseService.getHealthStatus();
      
      expect(health).toBeDefined();
      expect(health.connected).toBe(true);
      expect(health.totalTables).toBeGreaterThan(0);
      expect(health.syncJobsCount).toBeGreaterThanOrEqual(0);
    });

    it('should include database size and connection info', async () => {
      const health = await databaseService.getHealthStatus();
      
      expect(health.dbSize).toBeGreaterThan(0);
      expect(health.connected).toBe(true);
      expect(health.totalTables).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in sync job entities gracefully', async () => {
      const db = await databaseService.getDb();
      
      // Manually insert invalid JSON
      await db.run(`
        INSERT INTO sync_jobs (id, entities, status, progress, total)
        VALUES (?, ?, ?, ?, ?)
      `, ['test-job', 'invalid-json', 'pending', 0, 100]);
      
      // This should throw since JSON.parse fails
      await expect(databaseService.getSyncJob('test-job')).rejects.toThrow();
    });

    it('should handle database connection errors', async () => {
      const invalidService = new DatabaseService('/invalid/path/database.sqlite');
      
      await expect(invalidService.initialize()).rejects.toThrow();
    });

    it('should handle missing required fields in upsert operations', async () => {
      await expect(databaseService.upsertProduct({})).rejects.toThrow();
      await expect(databaseService.upsertFeature({})).rejects.toThrow();
    });
  });

  describe('Database Schema Validation', () => {
    it('should have proper indexes for performance', async () => {
      const db = await databaseService.getDb();
      const indexes = await db.all(`
        SELECT name, tbl_name FROM sqlite_master 
        WHERE type='index' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      
      const indexNames = indexes.map(idx => idx.name);
      
      // Check for critical performance indexes
      expect(indexNames).toContain('idx_sync_jobs_status');
      expect(indexNames).toContain('idx_features_product_id');
      expect(indexNames).toContain('idx_embedding_jobs_status');
      expect(indexNames).toContain('idx_embeddings_entity');
    });

    it('should enforce foreign key constraints', async () => {
      const db = await databaseService.getDb();
      
      // Check if foreign keys are enabled
      const pragmaResult = await db.get('PRAGMA foreign_keys');
      expect(pragmaResult.foreign_keys).toBe(1);
    });
  });
});