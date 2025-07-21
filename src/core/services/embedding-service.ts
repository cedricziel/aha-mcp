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
      const job = await this.db.getEmbeddingJob(jobId);
      if (!job) return null;

      return {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        total: job.total,
        currentEntity: job.current_entity,
        processedCount: job.processed_count,
        errorCount: job.error_count,
        startedAt: job.started_at,
        estimatedCompletion: job.estimated_completion,
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
      const jobs = await this.db.getActiveEmbeddingJobs();
      
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
    // Use sqlite-vec for proper vector embeddings if available
    const embedding = await this.generateSimpleEmbedding(text, options.dimensions || 384);
    
    // Store the embedding using DatabaseService vector methods
    await this.db.storeEmbedding(entityType, entityId, embedding, text, options);
    
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
      // Generate query embedding
      const queryEmbedding = await this.generateSimpleEmbedding(queryText);
      
      // Use DatabaseService's vector similarity search
      const results = await this.db.vectorSimilaritySearch(
        queryEmbedding,
        entityTypes.length > 0 ? entityTypes : undefined,
        limit,
        threshold
      );
      
      // Map results to match expected interface
      return results.map(result => ({
        entity_type: result.entity_type,
        entity_id: result.entity_id,
        similarity: result.similarity,
        text: result.text_content,
        metadata: result.metadata
      }));
    } catch (error) {
      console.error('Vector similarity search failed:', error);
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
    return await this.db.createEmbeddingJob(entities, options);
  }

  /**
   * Update embedding job progress
   */
  private async updateEmbeddingJobProgress(
    jobId: string,
    updates: Record<string, any>
  ): Promise<void> {
    await this.db.updateEmbeddingJob(jobId, updates);
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
      const entities = await this.db.getEntitiesForEmbedding(entityType);
      
      for (let i = 0; i < entities.length; i += batchSize) {
        if (abortSignal.aborted) break;
        
        const batch = entities.slice(i, i + batchSize);
        for (const entity of batch) {
          try {
            const text = `${entity.name} ${entity.description || ''}`.trim();
            if (text) {
              await this.generateEntityEmbedding(entityType, entity.id, text, options);
              processed++;
            }
          } catch (error) {
            errors++;
            lastError = error instanceof Error ? error.message : String(error);
          }
        }
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
   * Check if vector operations are available
   */
  isVectorEnabled(): boolean {
    return this.db.isVectorEnabled();
  }

  /**
   * Get stored embedding for an entity
   */
  async getEntityEmbedding(entityType: string, entityId: string): Promise<number[] | null> {
    return await this.db.getEmbedding(entityType, entityId);
  }

  /**
   * Delete stored embedding for an entity
   */
  async deleteEntityEmbedding(entityType: string, entityId: string): Promise<void> {
    return await this.db.deleteEmbedding(entityType, entityId);
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
    try {
      // Initialize database if needed and access it through a public method
      await this.db.initialize();
      
      // For fallback, we'll search across all entity tables directly
      const searchResults: Array<{
        entity_type: string;
        entity_id: string;
        similarity: number;
        text: string;
        metadata?: any;
      }> = [];

      const entityTypesToSearch = entityTypes.length > 0 ? entityTypes : ['features', 'products', 'ideas', 'epics', 'initiatives', 'releases', 'goals'];

      for (const entityType of entityTypesToSearch) {
        try {
          const entities = await this.db.getEntitiesForEmbedding(entityType);
          const matches = entities.filter(entity => {
            const text = `${entity.name} ${entity.description || ''}`.toLowerCase();
            return text.includes(queryText.toLowerCase());
          }).slice(0, Math.ceil(limit / entityTypesToSearch.length));

          searchResults.push(...matches.map(entity => ({
            entity_type: entityType,
            entity_id: entity.id,
            similarity: 0.8, // Static similarity score for text match
            text: `${entity.name} ${entity.description || ''}`.trim(),
            metadata: undefined
          })));
        } catch (error) {
          console.warn(`Error searching ${entityType}:`, error);
        }
      }

      return searchResults.slice(0, limit);
    } catch (error) {
      console.error('Fallback text search failed:', error);
      return [];
    }
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();