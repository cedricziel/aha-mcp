import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { z } from 'zod';
import { embeddingService } from '../services/embedding-service.js';

const EmbeddingOptionsSchema = z.object({
  batchSize: z.number().min(1).max(100).optional(),
  model: z.string().optional(),
  dimensions: z.number().min(50).max(1536).optional(),
  concurrency: z.number().min(1).max(10).optional()
});

const EntityTypeSchema = z.enum(['features', 'products', 'ideas', 'epics', 'initiatives', 'releases', 'goals']);

/**
 * Register all embedding-related tools
 */
export function registerEmbeddingTools(server: Server): void {
  // Start embedding generation
  server.tool(
    'aha_generate_embeddings',
    'Generate vector embeddings for specified Aha entities to enable semantic search',
    {
      entities: z.array(EntityTypeSchema).describe('Entity types to generate embeddings for'),
      options: EmbeddingOptionsSchema.optional().describe('Embedding generation options')
    },
    async ({ entities, options }) => {
      try {
        const jobId = await embeddingService.startEmbeddingGeneration(entities, options);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              jobId,
              message: `Started embedding generation for ${entities.join(', ')}`,
              entities,
              options: options || {}
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );

  // Get embedding job status
  server.tool(
    'aha_embedding_status',
    'Get the status and progress of embedding generation jobs',
    {
      jobId: z.string().optional().describe('Specific job ID to check, or omit to see all active jobs')
    },
    async ({ jobId }) => {
      try {
        if (jobId) {
          const progress = await embeddingService.getEmbeddingProgress(jobId);
          if (!progress) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Embedding job ${jobId} not found`
                }, null, 2)
              }]
            };
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                job: progress
              }, null, 2)
            }]
          };
        } else {
          const activeJobs = await embeddingService.getActiveEmbeddingJobs();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                activeJobs,
                count: activeJobs.length
              }, null, 2)
            }]
          };
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );

  // Pause embedding job
  server.tool(
    'aha_pause_embeddings',
    'Pause a running embedding generation job',
    {
      jobId: z.string().describe('ID of the embedding job to pause')
    },
    async ({ jobId }) => {
      try {
        await embeddingService.pauseEmbeddingJob(jobId);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Embedding job ${jobId} paused successfully`
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );

  // Stop embedding job
  server.tool(
    'aha_stop_embeddings',
    'Stop an embedding generation job completely',
    {
      jobId: z.string().describe('ID of the embedding job to stop')
    },
    async ({ jobId }) => {
      try {
        await embeddingService.stopEmbeddingJob(jobId);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Embedding job ${jobId} stopped successfully`
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );

  // Semantic search
  server.tool(
    'aha_semantic_search',
    'Search for Aha entities using semantic similarity (vector embeddings)',
    {
      query: z.string().min(1).describe('Search query text'),
      entityTypes: z.array(EntityTypeSchema).optional().describe('Limit search to specific entity types'),
      limit: z.number().min(1).max(50).optional().default(10).describe('Maximum number of results to return'),
      threshold: z.number().min(0).max(1).optional().default(0.7).describe('Minimum similarity score (0-1)')
    },
    async ({ query, entityTypes, limit, threshold }) => {
      try {
        const results = await embeddingService.searchSimilar(
          query,
          entityTypes || [],
          limit || 10,
          threshold || 0.7
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              query,
              results,
              count: results.length
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );

  // Generate embedding for specific entity
  server.tool(
    'aha_generate_entity_embedding',
    'Generate an embedding for a specific entity by ID',
    {
      entityType: EntityTypeSchema.describe('Type of the entity'),
      entityId: z.string().describe('ID of the entity'),
      options: EmbeddingOptionsSchema.optional().describe('Embedding generation options')
    },
    async ({ entityType, entityId, options }) => {
      try {
        // Get the entity data first
        const db = await embeddingService['db'].getDb();
        let entityData;
        
        switch (entityType) {
          case 'features':
            entityData = await db.get('SELECT id, name, description FROM features WHERE id = ?', [entityId]);
            break;
          case 'products':
            entityData = await db.get('SELECT id, name, description FROM products WHERE id = ?', [entityId]);
            break;
          case 'ideas':
            entityData = await db.get('SELECT id, name, description FROM ideas WHERE id = ?', [entityId]);
            break;
          case 'epics':
            entityData = await db.get('SELECT id, name, description FROM epics WHERE id = ?', [entityId]);
            break;
          case 'initiatives':
            entityData = await db.get('SELECT id, name, description FROM initiatives WHERE id = ?', [entityId]);
            break;
          case 'releases':
            entityData = await db.get('SELECT id, name, description FROM releases WHERE id = ?', [entityId]);
            break;
          case 'goals':
            entityData = await db.get('SELECT id, name, description FROM goals WHERE id = ?', [entityId]);
            break;
          default:
            throw new Error(`Unsupported entity type: ${entityType}`);
        }
        
        if (!entityData) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Entity ${entityType}/${entityId} not found`
              }, null, 2)
            }]
          };
        }
        
        const text = `${entityData.name} ${entityData.description || ''}`.trim();
        const embedding = await embeddingService.generateEntityEmbedding(
          entityType,
          entityId,
          text,
          options || {}
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              entityType,
              entityId,
              embeddingLength: embedding.length,
              text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );

  // Find similar entities to a specific entity
  server.tool(
    'aha_find_similar',
    'Find entities similar to a specific entity using embeddings',
    {
      entityType: EntityTypeSchema.describe('Type of the source entity'),
      entityId: z.string().describe('ID of the source entity'),
      targetEntityTypes: z.array(EntityTypeSchema).optional().describe('Types of entities to search within'),
      limit: z.number().min(1).max(20).optional().default(5).describe('Maximum number of similar entities to return'),
      threshold: z.number().min(0).max(1).optional().default(0.6).describe('Minimum similarity score (0-1)')
    },
    async ({ entityType, entityId, targetEntityTypes, limit, threshold }) => {
      try {
        // Get the source entity's text
        const db = await embeddingService['db'].getDb();
        let sourceEntity;
        
        switch (entityType) {
          case 'features':
            sourceEntity = await db.get('SELECT id, name, description FROM features WHERE id = ?', [entityId]);
            break;
          case 'products':
            sourceEntity = await db.get('SELECT id, name, description FROM products WHERE id = ?', [entityId]);
            break;
          case 'ideas':
            sourceEntity = await db.get('SELECT id, name, description FROM ideas WHERE id = ?', [entityId]);
            break;
          case 'epics':
            sourceEntity = await db.get('SELECT id, name, description FROM epics WHERE id = ?', [entityId]);
            break;
          case 'initiatives':
            sourceEntity = await db.get('SELECT id, name, description FROM initiatives WHERE id = ?', [entityId]);
            break;
          case 'releases':
            sourceEntity = await db.get('SELECT id, name, description FROM releases WHERE id = ?', [entityId]);
            break;
          case 'goals':
            sourceEntity = await db.get('SELECT id, name, description FROM goals WHERE id = ?', [entityId]);
            break;
          default:
            throw new Error(`Unsupported entity type: ${entityType}`);
        }
        
        if (!sourceEntity) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Source entity ${entityType}/${entityId} not found`
              }, null, 2)
            }]
          };
        }
        
        const sourceText = `${sourceEntity.name} ${sourceEntity.description || ''}`.trim();
        const results = await embeddingService.searchSimilar(
          sourceText,
          targetEntityTypes || [],
          limit || 5,
          threshold || 0.6
        );
        
        // Filter out the source entity from results
        const filteredResults = results.filter(
          result => !(result.entity_type === entityType && result.entity_id === entityId)
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              sourceEntity: {
                type: entityType,
                id: entityId,
                name: sourceEntity.name
              },
              similarEntities: filteredResults,
              count: filteredResults.length
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }]
        };
      }
    }
  );
}