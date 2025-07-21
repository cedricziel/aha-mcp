import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
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

      // Load sqlite-vec extension if available
      try {
        // Try to load sqlite-vec extension (path may vary)
        const possiblePaths = [
          'sqlite-vec',
          './sqlite-vec',
          '/usr/local/lib/sqlite-vec',
          './node_modules/sqlite-vec/vec0'
        ];
        
        let vectorLoaded = false;
        for (const vecPath of possiblePaths) {
          try {
            await this.db.exec(`.load ${vecPath}`);
            vectorLoaded = true;
            console.log(`Loaded sqlite-vec extension from: ${vecPath}`);
            break;
          } catch (e) {
            // Try next path
            continue;
          }
        }
        
        if (!vectorLoaded) {
          console.warn('sqlite-vec extension not found, vector operations will be disabled');
        }
      } catch (error) {
        console.warn('Could not load sqlite-vec extension:', error);
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
    const db = await this.getDb();
    
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
    const db = await this.getDb();
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
}

// Singleton instance
export const databaseService = new DatabaseService();