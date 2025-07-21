import { DatabaseService, databaseService } from '../database/database.js';
import { AhaService } from './aha-service.js';
import { EventEmitter } from 'events';

export interface SyncOptions {
  batchSize?: number;
  concurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  updatedSince?: string;
}

export interface SyncProgress {
  jobId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  total: number;
  currentEntity?: string;
  currentEntityProgress?: number;
  currentEntityTotal?: number;
  processedCount: number;
  errorCount: number;
  startedAt?: Date;
  estimatedCompletion?: Date;
  errors: string[];
}

export interface EntitySyncResult {
  entity: string;
  processed: number;
  errors: number;
  lastError?: string;
}

/**
 * Background synchronization service for Aha.io data
 * Handles async sync operations with progress tracking and observability
 */
export class BackgroundSyncService extends EventEmitter {
  private activeSyncs = new Map<string, AbortController>();
  private db: DatabaseService;
  
  constructor(database?: DatabaseService) {
    super();
    this.db = database || databaseService;
  }

  /**
   * Start a background sync operation
   */
  async startSync(
    entities: string[],
    options: SyncOptions = {}
  ): Promise<string> {
    const jobId = await this.db.createSyncJob(entities, options);
    
    // Don't await - run in background
    this.runSyncJob(jobId, entities, options).catch(error => {
      console.error(`Sync job ${jobId} failed:`, error);
      this.emit('sync-error', { jobId, error: error.message });
    });

    return jobId;
  }

  /**
   * Pause a running sync job
   */
  async pauseSync(jobId: string): Promise<void> {
    const controller = this.activeSyncs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeSyncs.delete(jobId);
    }
    
    await this.db.updateSyncJobProgress(jobId, { 
      status: 'paused' 
    });
    
    this.emit('sync-paused', { jobId });
  }

  /**
   * Stop a sync job completely
   */
  async stopSync(jobId: string): Promise<void> {
    const controller = this.activeSyncs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeSyncs.delete(jobId);
    }
    
    await this.db.updateSyncJobProgress(jobId, { 
      status: 'failed',
      last_error: 'Sync stopped by user',
      completed_at: new Date()
    });
    
    await this.db.addSyncHistory(jobId, 'system', 'sync_stopped', undefined, {
      reason: 'User requested stop'
    });
    
    this.emit('sync-stopped', { jobId });
  }

  /**
   * Get sync job progress
   */
  async getSyncProgress(jobId: string): Promise<SyncProgress | null> {
    const job = await this.db.getSyncJob(jobId);
    if (!job) return null;

    const history = await this.db.getSyncHistory(jobId, 10);
    const errors = history
      .filter(h => h.action === 'sync_error')
      .map(h => h.details?.error || 'Unknown error')
      .slice(0, 5); // Last 5 errors

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      total: job.total,
      currentEntity: job.current_entity,
      currentEntityProgress: job.current_entity_progress,
      currentEntityTotal: job.current_entity_total,
      processedCount: job.processed_count,
      errorCount: job.error_count,
      startedAt: job.started_at,
      estimatedCompletion: job.estimated_completion,
      errors
    };
  }

  /**
   * Get all active sync jobs
   */
  async getActiveSyncs(): Promise<SyncProgress[]> {
    const jobs = await this.db.getActiveSyncJobs();
    
    const progresses = await Promise.all(
      jobs.map(job => this.getSyncProgress(job.id))
    );
    
    return progresses.filter((p): p is SyncProgress => p !== null);
  }

  /**
   * Get sync history for a job
   */
  async getSyncHistory(jobId: string): Promise<any[]> {
    return this.db.getSyncHistory(jobId);
  }

  /**
   * Main sync job execution
   */
  private async runSyncJob(
    jobId: string,
    entities: string[],
    options: SyncOptions
  ): Promise<void> {
    const controller = new AbortController();
    this.activeSyncs.set(jobId, controller);

    try {
      await this.db.updateSyncJobProgress(jobId, {
        status: 'running',
        started_at: new Date(),
        total: entities.length * 100 // Rough estimate
      });

      await this.db.addSyncHistory(jobId, 'system', 'sync_start', undefined, {
        entities,
        options
      });

      this.emit('sync-started', { jobId, entities });

      let totalProcessed = 0;
      let totalErrors = 0;

      for (let i = 0; i < entities.length; i++) {
        if (controller.signal.aborted) {
          await this.db.updateSyncJobProgress(jobId, { status: 'paused' });
          return;
        }

        const entityType = entities[i];
        
        await this.db.updateSyncJobProgress(jobId, {
          current_entity: entityType,
          current_entity_progress: 0,
          current_entity_total: 100,
          progress: Math.round((i / entities.length) * 100)
        });

        try {
          const result = await this.syncEntityType(
            jobId,
            entityType,
            options,
            controller.signal,
            (progress, total) => {
              this.db.updateSyncJobProgress(jobId, {
                current_entity_progress: progress,
                current_entity_total: total
              }).catch(console.error);
            }
          );

          totalProcessed += result.processed;
          totalErrors += result.errors;

          await this.db.updateSyncJobProgress(jobId, {
            processed_count: totalProcessed,
            error_count: totalErrors
          });

          await this.db.addSyncHistory(jobId, entityType, 'entity_completed', undefined, {
            processed: result.processed,
            errors: result.errors
          });

          this.emit('entity-synced', { 
            jobId, 
            entityType, 
            processed: result.processed,
            errors: result.errors 
          });

        } catch (error) {
          totalErrors++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          await this.db.updateSyncJobProgress(jobId, {
            error_count: totalErrors,
            last_error: errorMessage
          });

          await this.db.addSyncHistory(jobId, entityType, 'sync_error', undefined, {
            error: errorMessage
          });

          console.error(`Failed to sync ${entityType} for job ${jobId}:`, error);
        }
      }

      // Mark as completed
      await this.db.updateSyncJobProgress(jobId, {
        status: 'completed',
        progress: 100,
        completed_at: new Date()
      });

      await this.db.addSyncHistory(jobId, 'system', 'sync_complete', undefined, {
        total_processed: totalProcessed,
        total_errors: totalErrors
      });

      this.emit('sync-completed', { 
        jobId, 
        processed: totalProcessed, 
        errors: totalErrors 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await this.db.updateSyncJobProgress(jobId, {
        status: 'failed',
        last_error: errorMessage,
        completed_at: new Date()
      });

      await this.db.addSyncHistory(jobId, 'system', 'sync_failed', undefined, {
        error: errorMessage
      });

      this.emit('sync-failed', { jobId, error: errorMessage });
      
    } finally {
      this.activeSyncs.delete(jobId);
    }
  }

  /**
   * Sync a specific entity type
   */
  private async syncEntityType(
    jobId: string,
    entityType: string,
    options: SyncOptions,
    abortSignal: AbortSignal,
    onProgress: (progress: number, total: number) => void
  ): Promise<EntitySyncResult> {
    const batchSize = options.batchSize || 50;
    const updatedSince = options.updatedSince;
    
    let processed = 0;
    let errors = 0;
    let lastError: string | undefined;

    try {
      switch (entityType) {
        case 'products':
          const products = await AhaService.listProducts(updatedSince);
          const productList = products.products || [];
          
          onProgress(0, productList.length);
          
          for (let i = 0; i < productList.length; i += batchSize) {
            if (abortSignal.aborted) break;
            
            const batch = productList.slice(i, i + batchSize);
            for (const product of batch) {
              try {
                await this.db.upsertProduct(product);
                processed++;
              } catch (error) {
                errors++;
                lastError = error instanceof Error ? error.message : String(error);
              }
            }
            
            onProgress(Math.min(i + batchSize, productList.length), productList.length);
          }
          break;

        case 'features':
          // Get features with optional filtering
          const features = await AhaService.listFeatures(
            undefined, // query
            updatedSince,
            undefined, // tag
            undefined  // assignedToUser
          );
          const featureList = features.features || [];
          
          onProgress(0, featureList.length);
          
          for (let i = 0; i < featureList.length; i += batchSize) {
            if (abortSignal.aborted) break;
            
            const batch = featureList.slice(i, i + batchSize);
            for (const feature of batch) {
              try {
                await this.db.upsertFeature(feature);
                processed++;
              } catch (error) {
                errors++;
                lastError = error instanceof Error ? error.message : String(error);
              }
            }
            
            onProgress(Math.min(i + batchSize, featureList.length), featureList.length);
          }
          break;

        case 'users':
          const users = await AhaService.listUsers();
          const userList = users.users || [];
          
          onProgress(0, userList.length);
          
          for (let i = 0; i < userList.length; i += batchSize) {
            if (abortSignal.aborted) break;
            
            const batch = userList.slice(i, i + batchSize);
            for (const user of batch) {
              try {
                const db = await (this.db as any).getDb();
                await db.run(`
                  INSERT OR REPLACE INTO users (
                    id, name, email, first_name, last_name, 
                    created_at, updated_at, raw_data, synced_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [
                  user.id,
                  user.name,
                  user.email,
                  user.first_name,
                  user.last_name,
                  user.created_at,
                  user.updated_at,
                  JSON.stringify(user)
                ]);
                processed++;
              } catch (error) {
                errors++;
                lastError = error instanceof Error ? error.message : String(error);
              }
            }
            
            onProgress(Math.min(i + batchSize, userList.length), userList.length);
          }
          break;

        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
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
   * Estimate time for sync completion
   */
  private estimateCompletion(
    processed: number,
    total: number,
    startTime: Date
  ): Date | undefined {
    if (processed === 0) return undefined;
    
    const elapsed = Date.now() - startTime.getTime();
    const rate = processed / elapsed; // items per ms
    const remaining = total - processed;
    const estimatedMs = remaining / rate;
    
    return new Date(Date.now() + estimatedMs);
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    activeSyncs: number;
    totalSyncsToday: number;
    lastSyncTime?: Date;
    errors: string[];
  }> {
    try {
      const dbHealth = await this.db.getHealthStatus();
      const activeSyncs = await this.getActiveSyncs();
      
      return {
        activeSyncs: activeSyncs.length,
        totalSyncsToday: 0, // TODO: Query from database
        lastSyncTime: dbHealth.lastActivity,
        errors: []
      };
    } catch (error) {
      return {
        activeSyncs: 0,
        totalSyncsToday: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Clean up completed/failed sync jobs older than specified days
   */
  async cleanupOldSyncJobs(olderThanDays = 7): Promise<number> {
    const db = await this.db.getDb();
    const result = await db.run(`
      DELETE FROM sync_jobs 
      WHERE status IN ('completed', 'failed') 
      AND updated_at < datetime('now', '-${olderThanDays} days')
    `);
    
    return result.changes || 0;
  }
}

// Singleton instance
export const backgroundSyncService = new BackgroundSyncService();