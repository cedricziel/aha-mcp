import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as sqliteVec from 'sqlite-vec';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

export interface SyncJob {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  entities: string[];
  progress: number;
  total: number;
  current_entity?: string;
  current_entity_progress?: number;
  current_entity_total?: number;
  processed_count: number;
  error_count: number;
  last_error?: string;
  started_at?: Date;
  updated_at: Date;
  completed_at?: Date;
  estimated_completion?: Date;
  configuration?: any;
}

export interface SyncStatus {
  entity_type: string;
  last_sync_at?: Date;
  last_successful_sync_at?: Date;
  total_records: number;
  failed_records: number;
  next_sync_at?: Date;
  sync_enabled: boolean;
  updated_at: Date;
}

export interface AhaEntity {
  id: string;
  name: string;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
  synced_at: Date;
  raw_data: any;
}

export interface SearchResult {
  entity_type: string;
  entity_id: string;
  relevance_score: number;
  entity_data: any;
}

/**
 * Database service for Aha MCP Server with SQLite and vector embeddings
 */
export class DatabaseService {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private dbPath: string;
  private isInitialized = false;
  private vectorEnabled = false;

  constructor(dbPath?: string) {
    // Default to data directory in project root
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'aha-mcp.db');
  }

  /**
   * Initialize the database connection and run migrations
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure data directory exists
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      // Enable foreign keys
      await this.db.exec('PRAGMA foreign_keys = ON;');
      
      // Configure for performance
      await this.db.exec('PRAGMA journal_mode = WAL;');
      await this.db.exec('PRAGMA synchronous = NORMAL;');
      await this.db.exec('PRAGMA cache_size = 10000;');
      await this.db.exec('PRAGMA temp_store = memory;');

      // Load sqlite-vec extension
      try {
        sqliteVec.load(this.db);
        this.vectorEnabled = true;
        console.log('sqlite-vec extension loaded successfully');
      } catch (error) {
        this.vectorEnabled = false;
        // Only show warning in non-test environments
        if (!process.env.NODE_ENV?.includes('test') && !process.argv.some(arg => arg.includes('test'))) {
          console.warn('Could not load sqlite-vec extension:', error);
        }
      }

      // Run migrations
      await this.runMigrations();
      
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      // Get current directory for schema file
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const schemaPath = path.join(__dirname, 'schema.sql');
      
      // Read and execute schema
      const schema = await fs.readFile(schemaPath, 'utf-8');
      await this.db.exec(schema);
      
      console.log('Database schema applied successfully');
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * Get database instance (ensure initialization)
   */
  private async getDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  // ===================================
  // SYNC JOB OPERATIONS
  // ===================================

  /**
   * Create a new sync job
   */
  async createSyncJob(entities: string[], configuration?: any): Promise<string> {
    const db = await this.getDb();
    const jobId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await db.run(`
      INSERT INTO sync_jobs (id, entities, configuration, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [
      jobId,
      JSON.stringify(entities),
      configuration ? JSON.stringify(configuration) : null
    ]);

    return jobId;
  }

  /**
   * Update sync job progress
   */
  async updateSyncJobProgress(
    jobId: string,
    updates: Partial<Pick<SyncJob, 'status' | 'progress' | 'total' | 'current_entity' | 'current_entity_progress' | 'current_entity_total' | 'processed_count' | 'error_count' | 'last_error' | 'estimated_completion'>>
  ): Promise<void> {
    try {
      const db = await this.getDb();
      if (!db) {
        return; // Database is not available, skip update
      }
    
      const setClauses: string[] = [];
      const values: any[] = [];
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          setClauses.push(`${key} = ?`);
          values.push(value);
        }
      });
      
      if (setClauses.length === 0) return;
      
      setClauses.push('updated_at = datetime(\'now\')');
      values.push(jobId);
      
      await db.run(`
        UPDATE sync_jobs 
        SET ${setClauses.join(', ')} 
        WHERE id = ?
      `, values);
    } catch (error) {
      // Silently ignore database errors during cleanup/shutdown
      // This prevents "Database is closed" errors from propagating
      if (error instanceof Error && error.message.includes('Database is closed')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Get sync job by ID
   */
  async getSyncJob(jobId: string): Promise<SyncJob | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM sync_jobs WHERE id = ?', [jobId]);
    
    if (!row) return null;
    
    return {
      id: row.id,
      status: row.status,
      entities: JSON.parse(row.entities || '[]'),
      progress: row.progress,
      total: row.total,
      current_entity: row.current_entity,
      current_entity_progress: row.current_entity_progress,
      current_entity_total: row.current_entity_total,
      processed_count: row.processed_count,
      error_count: row.error_count,
      last_error: row.last_error,
      started_at: row.started_at ? new Date(row.started_at) : undefined,
      updated_at: new Date(row.updated_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      estimated_completion: row.estimated_completion ? new Date(row.estimated_completion) : undefined,
      configuration: row.configuration ? JSON.parse(row.configuration) : undefined
    };
  }

  /**
   * Get all active sync jobs
   */
  async getActiveSyncJobs(): Promise<SyncJob[]> {
    const db = await this.getDb();
    const rows = await db.all(`
      SELECT * FROM sync_jobs 
      WHERE status IN ('pending', 'running', 'paused') 
      ORDER BY updated_at DESC
    `);
    
    return rows.map(row => ({
      id: row.id,
      status: row.status,
      entities: JSON.parse(row.entities || '[]'),
      progress: row.progress,
      total: row.total,
      current_entity: row.current_entity,
      current_entity_progress: row.current_entity_progress,
      current_entity_total: row.current_entity_total,
      processed_count: row.processed_count,
      error_count: row.error_count,
      last_error: row.last_error,
      started_at: row.started_at ? new Date(row.started_at) : undefined,
      updated_at: new Date(row.updated_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      estimated_completion: row.estimated_completion ? new Date(row.estimated_completion) : undefined,
      configuration: row.configuration ? JSON.parse(row.configuration) : undefined
    }));
  }

  /**
   * Add entry to sync history
   */
  async addSyncHistory(
    jobId: string,
    entityType: string,
    action: string,
    entityId?: string,
    details?: any
  ): Promise<void> {
    try {
      const db = await this.getDb();
      if (!db) {
        return; // Database is not available, skip history entry
      }
      
      await db.run(`
        INSERT INTO sync_history (job_id, entity_type, entity_id, action, details)
        VALUES (?, ?, ?, ?, ?)
      `, [
        jobId,
        entityType,
        entityId || null,
        action,
        details ? JSON.stringify(details) : null
      ]);
    } catch (error) {
      // Silently ignore database errors during cleanup/shutdown
      // This prevents "Database is closed" errors from propagating
      if (error instanceof Error && error.message.includes('Database is closed')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Get sync history for a job
   */
  async getSyncHistory(jobId: string, limit = 100): Promise<any[]> {
    const db = await this.getDb();
    const rows = await db.all(`
      SELECT * FROM sync_history 
      WHERE job_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [jobId, limit]);
    
    return rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
      timestamp: new Date(row.timestamp)
    }));
  }

  // ===================================
  // ENTITY OPERATIONS
  // ===================================

  /**
   * Upsert product data
   */
  async upsertProduct(product: any): Promise<void> {
    const db = await this.getDb();
    await db.run(`
      INSERT OR REPLACE INTO products (
        id, name, description, reference_prefix, created_at, updated_at, raw_data, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      product.id,
      product.name,
      product.description,
      product.reference_prefix,
      product.created_at,
      product.updated_at,
      JSON.stringify(product)
    ]);
  }

  /**
   * Upsert feature data
   */
  async upsertFeature(feature: any): Promise<void> {
    const db = await this.getDb();
    await db.run(`
      INSERT OR REPLACE INTO features (
        id, name, description, reference_num, feature_type, workflow_status,
        progress, score, product_id, release_id, epic_id, assigned_to_user_id,
        created_at, updated_at, raw_data, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      feature.id,
      feature.name,
      feature.description,
      feature.reference_num,
      feature.feature_type,
      feature.workflow_status?.name,
      feature.progress,
      feature.score,
      feature.product?.id,
      feature.release?.id,
      feature.epic?.id,
      feature.assigned_to_user?.id,
      feature.created_at,
      feature.updated_at,
      JSON.stringify(feature)
    ]);
  }

  /**
   * Get cached entity by ID
   */
  async getEntity(tableName: string, id: string): Promise<any | null> {
    const db = await this.getDb();
    const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
    
    if (!row) return null;
    
    return {
      ...row,
      raw_data: row.raw_data ? JSON.parse(row.raw_data) : null,
      created_at: row.created_at ? new Date(row.created_at) : null,
      updated_at: row.updated_at ? new Date(row.updated_at) : null,
      synced_at: new Date(row.synced_at)
    };
  }

  /**
   * Get entities with optional filtering
   */
  async getEntities(
    tableName: string,
    filters?: { [key: string]: any },
    limit = 100,
    offset = 0
  ): Promise<any[]> {
    const db = await this.getDb();
    
    let query = `SELECT * FROM ${tableName}`;
    const params: any[] = [];
    
    if (filters && Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters).map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const rows = await db.all(query, params);
    
    return rows.map(row => ({
      ...row,
      raw_data: row.raw_data ? JSON.parse(row.raw_data) : null,
      created_at: row.created_at ? new Date(row.created_at) : null,
      updated_at: row.updated_at ? new Date(row.updated_at) : null,
      synced_at: new Date(row.synced_at)
    }));
  }

  /**
   * Get sync status for all entities
   */
  async getSyncStatusSummary(): Promise<any[]> {
    const db = await this.getDb();
    const rows = await db.all('SELECT * FROM entity_sync_status');
    
    return rows.map(row => ({
      ...row,
      last_sync: row.last_sync ? new Date(row.last_sync) : null
    }));
  }

  /**
   * Get server configuration
   */
  async getConfig(key?: string): Promise<any> {
    const db = await this.getDb();
    
    if (key) {
      const row = await db.get('SELECT value FROM server_config WHERE key = ?', [key]);
      return row?.value || null;
    }
    
    const rows = await db.all('SELECT key, value, description FROM server_config');
    const config: any = {};
    rows.forEach(row => {
      config[row.key] = row.value;
    });
    return config;
  }

  /**
   * Update server configuration
   */
  async updateConfig(key: string, value: string): Promise<void> {
    const db = await this.getDb();
    await db.run(`
      INSERT OR REPLACE INTO server_config (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `, [key, value]);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<{
    connected: boolean;
    dbSize: number;
    totalTables: number;
    syncJobsCount: number;
    lastActivity?: Date;
  }> {
    try {
      const db = await this.getDb();
      
      // Get database file size
      const dbStats = await fs.stat(this.dbPath);
      
      // Count tables
      const tableCount = await db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'");
      
      // Count sync jobs
      const jobCount = await db.get('SELECT COUNT(*) as count FROM sync_jobs');
      
      // Get last activity
      const lastActivity = await db.get('SELECT MAX(updated_at) as last_activity FROM sync_jobs');
      
      return {
        connected: true,
        dbSize: dbStats.size,
        totalTables: tableCount.count,
        syncJobsCount: jobCount.count,
        lastActivity: lastActivity.last_activity ? new Date(lastActivity.last_activity) : undefined
      };
    } catch (error) {
      return {
        connected: false,
        dbSize: 0,
        totalTables: 0,
        syncJobsCount: 0
      };
    }
  }

  /**
   * Check if vector operations are available
   */
  isVectorEnabled(): boolean {
    return this.vectorEnabled;
  }

  /**
   * Store a vector embedding for an entity
   */
  async storeEmbedding(
    entityType: string,
    entityId: string,
    embedding: number[],
    text: string,
    metadata?: any
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (!this.vectorEnabled) {
      console.warn('Vector operations disabled, skipping embedding storage');
      return;
    }

    try {
      // Store as JSON string for compatibility with current schema
      const embeddingJson = JSON.stringify(embedding);
      
      await this.db.run(`
        INSERT OR REPLACE INTO embeddings 
        (entity_type, entity_id, embedding_vector, text, metadata, model, dimensions, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        entityType,
        entityId,
        embeddingJson,
        text,
        metadata ? JSON.stringify(metadata) : null,
        'sqlite-vec',
        embedding.length
      ]);
    } catch (error) {
      console.error('Error storing embedding:', error);
      throw error;
    }
  }

  /**
   * Perform vector similarity search
   */
  async vectorSimilaritySearch(
    queryEmbedding: number[],
    entityTypes?: string[],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{
    entity_type: string;
    entity_id: string;
    text_content: string;
    similarity: number;
    metadata?: any;
  }>> {
    if (!this.db) throw new Error('Database not initialized');
    if (!this.vectorEnabled) {
      console.warn('Vector operations disabled, returning empty results');
      return [];
    }

    try {
      // For now, use a simplified approach since schema stores vectors as TEXT
      // TODO: Update to use vec0 virtual table in a future migration
      let sql = `
        SELECT 
          entity_type,
          entity_id,
          text,
          embedding_vector,
          metadata
        FROM embeddings
      `;
      
      const params: any[] = [];
      
      if (entityTypes && entityTypes.length > 0) {
        const placeholders = entityTypes.map(() => '?').join(',');
        sql += ` WHERE entity_type IN (${placeholders})`;
        params.push(...entityTypes);
      }
      
      sql += ` LIMIT ?`;
      params.push(limit);

      const results = await this.db.all(sql, params);
      
      // Calculate similarity in JavaScript for now
      // TODO: Use vec_distance_cosine when migrated to vec0 virtual table
      const similarities = results.map((row: any) => {
        let similarity = 0;
        try {
          const storedEmbedding = row.embedding_vector ? 
            (typeof row.embedding_vector === 'string' ? 
              JSON.parse(row.embedding_vector) : 
              Array.from(new Float32Array(row.embedding_vector))) : [];
          
          similarity = this.calculateCosineSimilarity(queryEmbedding, storedEmbedding);
        } catch (error) {
          console.warn('Error calculating similarity:', error);
        }
        
        return {
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          text_content: row.text,
          similarity,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        };
      });

      return similarities
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.error('Error performing vector similarity search:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get embedding for a specific entity
   */
  async getEmbedding(entityType: string, entityId: string): Promise<number[] | null> {
    if (!this.db) throw new Error('Database not initialized');
    if (!this.vectorEnabled) return null;

    try {
      const result = await this.db.get(`
        SELECT embedding_vector FROM embeddings 
        WHERE entity_type = ? AND entity_id = ?
      `, [entityType, entityId]);

      if (!result?.embedding_vector) return null;

      // Handle both BLOB and TEXT storage formats
      if (typeof result.embedding_vector === 'string') {
        return JSON.parse(result.embedding_vector);
      } else {
        // Convert buffer back to array
        return Array.from(new Float32Array(result.embedding_vector));
      }
    } catch (error) {
      console.error('Error retrieving embedding:', error);
      return null;
    }
  }

  /**
   * Delete embedding for an entity
   */
  async deleteEmbedding(entityType: string, entityId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (!this.vectorEnabled) return;

    try {
      await this.db.run(`
        DELETE FROM embeddings 
        WHERE entity_type = ? AND entity_id = ?
      `, [entityType, entityId]);
    } catch (error) {
      console.error('Error deleting embedding:', error);
      throw error;
    }
  }

  // ===================================
  // EMBEDDING JOB OPERATIONS
  // ===================================

  /**
   * Create a new embedding job
   */
  async createEmbeddingJob(entities: string[], options?: any): Promise<string> {
    const db = await this.getDb();
    const jobId = `emb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await db.run(`
      INSERT INTO embedding_jobs (
        id, entities, status, progress, total, 
        processed_count, error_count, options, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      jobId,
      JSON.stringify(entities),
      'pending',
      0,
      100, // Will be updated with actual count
      0,
      0,
      options ? JSON.stringify(options) : null
    ]);
    
    return jobId;
  }

  /**
   * Get embedding job by ID
   */
  async getEmbeddingJob(jobId: string): Promise<any | null> {
    const db = await this.getDb();
    const row = await db.get('SELECT * FROM embedding_jobs WHERE id = ?', [jobId]);
    
    if (!row) return null;
    
    return {
      id: row.id,
      status: row.status,
      entities: JSON.parse(row.entities || '[]'),
      progress: row.progress,
      total: row.total,
      current_entity: row.current_entity,
      processed_count: row.processed_count,
      error_count: row.error_count,
      last_error: row.last_error,
      started_at: row.started_at ? new Date(row.started_at) : undefined,
      updated_at: new Date(row.updated_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      estimated_completion: row.estimated_completion ? new Date(row.estimated_completion) : undefined,
      options: row.options ? JSON.parse(row.options) : undefined
    };
  }

  /**
   * Update embedding job progress
   */
  async updateEmbeddingJob(jobId: string, updates: Record<string, any>): Promise<void> {
    const db = await this.getDb();
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    await db.run(`
      UPDATE embedding_jobs 
      SET ${fields}, updated_at = datetime('now')
      WHERE id = ?
    `, [...values, jobId]);
  }

  /**
   * Get all active embedding jobs
   */
  async getActiveEmbeddingJobs(): Promise<any[]> {
    const db = await this.getDb();
    const rows = await db.all(`
      SELECT * FROM embedding_jobs 
      WHERE status IN ('pending', 'running', 'paused')
      ORDER BY created_at DESC
    `);
    
    return rows.map(row => ({
      id: row.id,
      status: row.status,
      entities: JSON.parse(row.entities || '[]'),
      progress: row.progress,
      total: row.total,
      current_entity: row.current_entity,
      processed_count: row.processed_count,
      error_count: row.error_count,
      last_error: row.last_error,
      started_at: row.started_at ? new Date(row.started_at) : undefined,
      updated_at: new Date(row.updated_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      estimated_completion: row.estimated_completion ? new Date(row.estimated_completion) : undefined,
      options: row.options ? JSON.parse(row.options) : undefined
    }));
  }

  /**
   * Get entities for embedding generation
   */
  async getEntitiesForEmbedding(entityType: string): Promise<Array<{id: string, name: string, description?: string}>> {
    const db = await this.getDb();
    
    switch (entityType) {
      case 'features':
        return await db.all('SELECT id, name, description FROM features');
      case 'products':
        return await db.all('SELECT id, name, description FROM products');
      case 'ideas':
        return await db.all('SELECT id, name, description FROM ideas');
      case 'epics':
        return await db.all('SELECT id, name, description FROM epics');
      case 'initiatives':
        return await db.all('SELECT id, name, description FROM initiatives');
      case 'releases':
        return await db.all('SELECT id, name, description FROM releases');
      case 'goals':
        return await db.all('SELECT id, name, description FROM goals');
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }
}

// Singleton instance
export const databaseService = new DatabaseService();