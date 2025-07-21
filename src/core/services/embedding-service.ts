import { DatabaseService, databaseService } from '../database/database.js';
import { EventEmitter } from 'events';

export interface EmbeddingOptions {
  batchSize?: number;
  model?: string;
  dimensions?: number;
  concurrency?: number;
}

export interface EmbeddingProgress {
  jobId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  total: number;
  currentEntity?: string;
  processedCount: number;
  errorCount: number;
  startedAt?: Date;
  estimatedCompletion?: Date;
  errors: string[];
}

export interface EntityEmbeddingResult {
  entity: string;
  processed: number;
  errors: number;
  lastError?: string;
}

/**
 * Embedding generation service for semantic search capabilities
 * Generates vector embeddings for Aha.io entities using various embedding models
 */
export class EmbeddingService extends EventEmitter {
  private activeJobs = new Map<string, AbortController>();
  private db: DatabaseService;
  
  constructor(database?: DatabaseService) {
    super();
    this.db = database || databaseService;
  }

  /**
   * Start embedding generation for specified entities
   */
  async startEmbeddingGeneration(
    entities: string[],
    options: EmbeddingOptions = {}
  ): Promise<string> {
    const jobId = await this.createEmbeddingJob(entities, options);
    
    // Run in background
    this.runEmbeddingJob(jobId, entities, options).catch(error => {
      console.error(`Embedding job ${jobId} failed:`, error);
      this.emit('embedding-error', { jobId, error: error.message });
    });

    return jobId;
  }

  /**
   * Pause a running embedding job
   */
  async pauseEmbeddingJob(jobId: string): Promise<void> {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
    }
    
    await this.updateEmbeddingJobProgress(jobId, { 
      status: 'paused' 
    });
    
    this.emit('embedding-paused', { jobId });
  }

  /**
   * Stop an embedding job completely
   */
  async stopEmbeddingJob(jobId: string): Promise<void> {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
    }
    
    await this.updateEmbeddingJobProgress(jobId, { 
      status: 'failed',
      last_error: 'Embedding job stopped by user',
      completed_at: new Date()
    });
    
    this.emit('embedding-stopped', { jobId });
  }

  /**
   * Get embedding job progress
   */
  async getEmbeddingProgress(jobId: string): Promise<EmbeddingProgress | null> {
    try {
      const db = await this.db.getDb();
      const job = await db.get(`
        SELECT * FROM embedding_jobs WHERE id = ?
      `, [jobId]);
      
      if (!job) return null;

      return {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        total: job.total,
        currentEntity: job.current_entity,
        processedCount: job.processed_count,
        errorCount: job.error_count,
        startedAt: job.started_at ? new Date(job.started_at) : undefined,
        estimatedCompletion: job.estimated_completion ? new Date(job.estimated_completion) : undefined,
        errors: [] // TODO: Implement error tracking
      };
    } catch (error) {
      console.error('Failed to get embedding progress:', error);
      return null;
    }
  }

  /**
   * Get all active embedding jobs
   */
  async getActiveEmbeddingJobs(): Promise<EmbeddingProgress[]> {
    try {
      const db = await this.db.getDb();
      const jobs = await db.all(`
        SELECT * FROM embedding_jobs 
        WHERE status IN ('pending', 'running', 'paused')
        ORDER BY created_at DESC
      `);
      
      const progresses = await Promise.all(
        jobs.map(job => this.getEmbeddingProgress(job.id))
      );
      
      return progresses.filter((p): p is EmbeddingProgress => p !== null);
    } catch (error) {
      console.error('Failed to get active embedding jobs:', error);
      return [];
    }
  }

  /**
   * Generate semantic search embeddings for an entity
   */
  async generateEntityEmbedding(
    entityType: string,
    entityId: string,
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    // For now, use a simple text-based embedding approach
    // In a real implementation, you'd use OpenAI, Cohere, or another embedding API
    const embedding = await this.generateSimpleEmbedding(text, options.dimensions || 384);
    
    // Store the embedding in the database
    await this.storeEmbedding(entityType, entityId, embedding, text);
    
    return embedding;
  }

  /**
   * Search for similar entities using embeddings
   */
  async searchSimilar(
    queryText: string,
    entityTypes: string[] = [],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Array<{
    entity_type: string;
    entity_id: string;
    similarity: number;
    text: string;
    metadata?: any;
  }>> {
    try {
      const queryEmbedding = await this.generateSimpleEmbedding(queryText);
      const db = await this.db.getDb();
      
      // Use sqlite-vec for similarity search if available
      let whereClause = '';
      let params: any[] = [JSON.stringify(queryEmbedding), limit];
      
      if (entityTypes.length > 0) {
        whereClause = `WHERE entity_type IN (${entityTypes.map(() => '?').join(',')})`;
        params = [JSON.stringify(queryEmbedding), ...entityTypes, limit];
      }
      
      const results = await db.all(`
        SELECT 
          entity_type,
          entity_id,
          text,
          metadata,
          vector_distance(embedding_vector, ?) as similarity
        FROM embeddings
        ${whereClause}
        ORDER BY similarity DESC
        LIMIT ?
      `, params);
      
      return results.filter(r => r.similarity >= threshold);
    } catch (error) {
      console.error('Similarity search failed:', error);
      // Fallback to text-based search
      return this.fallbackTextSearch(queryText, entityTypes, limit);
    }
  }

  /**
   * Create a new embedding job
   */
  private async createEmbeddingJob(
    entities: string[],
    options: EmbeddingOptions
  ): Promise<string> {
    const jobId = `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const db = await this.db.getDb();
    
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
      JSON.stringify(options)
    ]);
    
    return jobId;
  }

  /**
   * Update embedding job progress
   */
  private async updateEmbeddingJobProgress(
    jobId: string,
    updates: Record<string, any>
  ): Promise<void> {
    const db = await this.db.getDb();
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    await db.run(`
      UPDATE embedding_jobs 
      SET ${fields}, updated_at = datetime('now')
      WHERE id = ?
    `, [...values, jobId]);
  }

  /**
   * Main embedding job execution
   */
  private async runEmbeddingJob(
    jobId: string,
    entities: string[],
    options: EmbeddingOptions
  ): Promise<void> {
    const controller = new AbortController();
    this.activeJobs.set(jobId, controller);

    try {
      await this.updateEmbeddingJobProgress(jobId, {
        status: 'running',
        started_at: new Date()
      });

      this.emit('embedding-started', { jobId, entities });

      let totalProcessed = 0;
      let totalErrors = 0;

      for (let i = 0; i < entities.length; i++) {
        if (controller.signal.aborted) {
          await this.updateEmbeddingJobProgress(jobId, { status: 'paused' });
          return;
        }

        const entityType = entities[i];
        
        await this.updateEmbeddingJobProgress(jobId, {
          current_entity: entityType,
          progress: Math.round((i / entities.length) * 100)
        });

        try {
          const result = await this.generateEmbeddingsForEntityType(
            jobId,
            entityType,
            options,
            controller.signal
          );

          totalProcessed += result.processed;
          totalErrors += result.errors;

          await this.updateEmbeddingJobProgress(jobId, {
            processed_count: totalProcessed,
            error_count: totalErrors
          });

          this.emit('entity-embeddings-generated', { 
            jobId, 
            entityType, 
            processed: result.processed,
            errors: result.errors 
          });

        } catch (error) {
          totalErrors++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          await this.updateEmbeddingJobProgress(jobId, {
            error_count: totalErrors,
            last_error: errorMessage
          });

          console.error(`Failed to generate embeddings for ${entityType}:`, error);
        }
      }

      // Mark as completed
      await this.updateEmbeddingJobProgress(jobId, {
        status: 'completed',
        progress: 100,
        completed_at: new Date()
      });

      this.emit('embedding-completed', { 
        jobId, 
        processed: totalProcessed, 
        errors: totalErrors 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await this.updateEmbeddingJobProgress(jobId, {
        status: 'failed',
        last_error: errorMessage,
        completed_at: new Date()
      });

      this.emit('embedding-failed', { jobId, error: errorMessage });
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Generate embeddings for a specific entity type
   */
  private async generateEmbeddingsForEntityType(
    jobId: string,
    entityType: string,
    options: EmbeddingOptions,
    abortSignal: AbortSignal
  ): Promise<EntityEmbeddingResult> {
    const batchSize = options.batchSize || 10;
    let processed = 0;
    let errors = 0;
    let lastError: string | undefined;

    try {
      const db = await this.db.getDb();
      
      switch (entityType) {
        case 'features': {
          const features = await db.all('SELECT id, name, description FROM features');
          
          for (let i = 0; i < features.length; i += batchSize) {
            if (abortSignal.aborted) break;
            
            const batch = features.slice(i, i + batchSize);
            for (const feature of batch) {
              try {
                const text = `${feature.name} ${feature.description || ''}`.trim();
                if (text) {
                  await this.generateEntityEmbedding('feature', feature.id, text, options);
                  processed++;
                }
              } catch (error) {
                errors++;
                lastError = error instanceof Error ? error.message : String(error);
              }
            }
          }
          break;
        }
        
        case 'products': {
          const products = await db.all('SELECT id, name, description FROM products');
          
          for (let i = 0; i < products.length; i += batchSize) {
            if (abortSignal.aborted) break;
            
            const batch = products.slice(i, i + batchSize);
            for (const product of batch) {
              try {
                const text = `${product.name} ${product.description || ''}`.trim();
                if (text) {
                  await this.generateEntityEmbedding('product', product.id, text, options);
                  processed++;
                }
              } catch (error) {
                errors++;
                lastError = error instanceof Error ? error.message : String(error);
              }
            }
          }
          break;
        }

        default:
          throw new Error(`Unsupported entity type for embeddings: ${entityType}`);
      }

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }

    return {
      entity: entityType,
      processed,
      errors,
      lastError
    };
  }

  /**
   * Generate a simple embedding using text characteristics
   * In production, replace with actual embedding API (OpenAI, Cohere, etc.)
   */
  private async generateSimpleEmbedding(
    text: string, 
    dimensions: number = 384
  ): Promise<number[]> {
    // Simple hash-based embedding for demo purposes
    // In production, use actual embedding models
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(dimensions).fill(0);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const charCode = word.charCodeAt(j);
        const index = (charCode + i * j) % dimensions;
        embedding[index] += Math.sin(charCode * 0.1) * 0.1;
      }
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }
    
    return embedding;
  }

  /**
   * Store embedding in database
   */
  private async storeEmbedding(
    entityType: string,
    entityId: string,
    embedding: number[],
    text: string,
    metadata?: any
  ): Promise<void> {
    const db = await this.db.getDb();
    
    await db.run(`
      INSERT OR REPLACE INTO embeddings (
        entity_type, entity_id, embedding_vector, text, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [
      entityType,
      entityId,
      JSON.stringify(embedding),
      text,
      metadata ? JSON.stringify(metadata) : null
    ]);
  }

  /**
   * Fallback text search when vector search is unavailable
   */
  private async fallbackTextSearch(
    queryText: string,
    entityTypes: string[] = [],
    limit: number = 10
  ): Promise<Array<{
    entity_type: string;
    entity_id: string;
    similarity: number;
    text: string;
    metadata?: any;
  }>> {
    const db = await this.db.getDb();
    let whereClause = '';
    let params: any[] = [`%${queryText}%`, limit];
    
    if (entityTypes.length > 0) {
      whereClause = `AND entity_type IN (${entityTypes.map(() => '?').join(',')})`;
      params = [`%${queryText}%`, ...entityTypes, limit];
    }
    
    const results = await db.all(`
      SELECT 
        entity_type,
        entity_id,
        text,
        metadata,
        0.8 as similarity
      FROM embeddings
      WHERE text LIKE ? ${whereClause}
      ORDER BY length(text) ASC
      LIMIT ?
    `, params);
    
    return results;
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();