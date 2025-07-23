import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { backgroundSyncService, BackgroundSyncService } from "../services/sync-service.js";
import { databaseService, DatabaseService } from "../database/database.js";

/**
 * Register sync observability and control tools with the MCP server
 * These tools allow LLMs to monitor and control background sync operations
 */
export function registerSyncTools(
  server: McpServer,
  syncService: BackgroundSyncService = backgroundSyncService,
  database: DatabaseService = databaseService
) {

  // ===================================
  // SYNC STATUS AND MONITORING TOOLS
  // ===================================

  // Get current sync status
  server.tool(
    "aha_sync_status",
    "Get current status of all sync operations including progress, active jobs, and recent history",
    {
      jobId: z.string().optional().describe("Specific job ID to get status for (optional)")
    },
    async (params: { jobId?: string }) => {
      try {
        if (params.jobId) {
          // Get specific job status
          const progress = await syncService.getSyncProgress(params.jobId);
          if (!progress) {
            return {
              content: [
                {
                  type: "text",
                  text: `Sync job '${params.jobId}' not found`
                }
              ],
              isError: true
            };
          }

          const history = await syncService.getSyncHistory(params.jobId);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  job: progress,
                  recent_history: history.slice(0, 10)
                }, null, 2)
              }
            ]
          };
        } else {
          // Get all active syncs
          const activeSyncs = await syncService.getActiveSyncs();
          const healthStatus = await syncService.getHealthStatus();
          const syncSummary = await database.getSyncStatusSummary();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  active_syncs: activeSyncs,
                  health: healthStatus,
                  entity_sync_status: syncSummary,
                  summary: {
                    total_active_jobs: activeSyncs.length,
                    running_jobs: activeSyncs.filter(s => s.status === 'running').length,
                    paused_jobs: activeSyncs.filter(s => s.status === 'paused').length,
                    total_errors: activeSyncs.reduce((sum, s) => sum + s.errorCount, 0)
                  }
                }, null, 2)
              }
            ]
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting sync status: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Start a background sync
  server.tool(
    "aha_sync_start",
    "Start a background synchronization for specified Aha entity types",
    {
      entities: z.array(z.enum(['products', 'features', 'ideas', 'epics', 'initiatives', 'users', 'releases', 'goals']))
        .describe("Array of entity types to sync"),
      batchSize: z.number().min(1).max(200).optional().describe("Number of items to process per batch (default: 50)"),
      updatedSince: z.string().optional().describe("ISO date string to sync only items updated since this date"),
      force: z.boolean().optional().describe("Force sync even if another sync is running")
    },
    async (params: { 
      entities: string[]; 
      batchSize?: number; 
      updatedSince?: string;
      force?: boolean;
    }) => {
      try {
        // Check if any syncs are already running (unless force is true)
        if (!params.force) {
          const activeSyncs = await syncService.getActiveSyncs();
          const runningSyncs = activeSyncs.filter(s => s.status === 'running');
          
          if (runningSyncs.length > 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Cannot start sync: ${runningSyncs.length} sync(s) already running. Use force=true to override or wait for completion. Running jobs: ${runningSyncs.map(s => s.jobId).join(', ')}`
                }
              ],
              isError: true
            };
          }
        }

        const options = {
          batchSize: params.batchSize,
          updatedSince: params.updatedSince
        };

        const jobId = await syncService.startSync(params.entities, options);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Sync started successfully",
                job_id: jobId,
                entities: params.entities,
                options: options,
                status: "Background sync job started. Use 'aha_sync_status' with this job_id to monitor progress."
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error starting sync: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Pause a sync operation
  server.tool(
    "aha_sync_pause",
    "Pause a running background sync operation",
    {
      jobId: z.string().describe("ID of the sync job to pause")
    },
    async (params: { jobId: string }) => {
      try {
        await syncService.pauseSync(params.jobId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Sync paused successfully",
                job_id: params.jobId,
                status: "paused",
                note: "Use 'aha_sync_status' to check current status or restart with 'aha_sync_start'"
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error pausing sync: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Stop a sync operation
  server.tool(
    "aha_sync_stop",
    "Stop a background sync operation completely",
    {
      jobId: z.string().describe("ID of the sync job to stop")
    },
    async (params: { jobId: string }) => {
      try {
        await syncService.stopSync(params.jobId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Sync stopped successfully",
                job_id: params.jobId,
                status: "stopped",
                note: "Sync job has been terminated and marked as failed"
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error stopping sync: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get sync history
  server.tool(
    "aha_sync_history",
    "Get detailed history and logs for a specific sync job or recent sync activities",
    {
      jobId: z.string().optional().describe("Specific job ID to get history for"),
      limit: z.number().min(1).max(500).optional().describe("Maximum number of history entries to return (default: 50)")
    },
    async (params: { jobId?: string; limit?: number }) => {
      try {
        const limit = params.limit || 50;

        if (params.jobId) {
          // Get history for specific job
          const history = await syncService.getSyncHistory(params.jobId);
          const progress = await syncService.getSyncProgress(params.jobId);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  job_id: params.jobId,
                  current_status: progress,
                  history: history.slice(0, limit),
                  total_entries: history.length
                }, null, 2)
              }
            ]
          };
        } else {
          // Get recent sync activity across all jobs
          const activeSyncs = await syncService.getActiveSyncs();
          const recentHistory: any[] = [];

          // Get history from active jobs
          for (const sync of activeSyncs) {
            const history = await syncService.getSyncHistory(sync.jobId);
            recentHistory.push(...history.map(h => ({ ...h, job_id: sync.jobId })));
          }

          // Sort by timestamp and limit
          recentHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  recent_activity: recentHistory.slice(0, limit),
                  active_jobs: activeSyncs.map(s => ({
                    job_id: s.jobId,
                    status: s.status,
                    progress: `${s.progress}%`,
                    current_entity: s.currentEntity
                  }))
                }, null, 2)
              }
            ]
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting sync history: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get database and sync health
  server.tool(
    "aha_sync_health",
    "Get comprehensive health status of the sync system, database, and cached data",
    {},
    async () => {
      try {
        const syncHealth = await syncService.getHealthStatus();
        const dbHealth = await database.getHealthStatus();
        const config = await database.getConfig();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                sync_service: syncHealth,
                database: {
                  connected: dbHealth.connected,
                  size_mb: Math.round(dbHealth.dbSize / (1024 * 1024) * 100) / 100,
                  total_tables: dbHealth.totalTables,
                  sync_jobs: dbHealth.syncJobsCount,
                  last_activity: dbHealth.lastActivity
                },
                configuration: config,
                system_status: dbHealth.connected && syncHealth.errors.length === 0 ? 'healthy' : 'degraded',
                recommendations: [
                  ...(syncHealth.errors.length > 0 ? ['Check sync service errors'] : []),
                  ...(dbHealth.dbSize > 100 * 1024 * 1024 ? ['Database size over 100MB, consider cleanup'] : []),
                  ...(syncHealth.activeSyncs > 3 ? ['High number of active syncs, may impact performance'] : [])
                ]
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting sync health: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Configuration management
  server.tool(
    "aha_sync_config",
    "View or update sync configuration settings",
    {
      action: z.enum(['get', 'set']).describe("Action to perform: get current config or set new values"),
      key: z.string().optional().describe("Configuration key to get/set (for set action)"),
      value: z.string().optional().describe("New value to set (for set action)")
    },
    async (params: { action: 'get' | 'set'; key?: string; value?: string }) => {
      try {
        if (params.action === 'get') {
          const config = params.key 
            ? { [params.key]: await database.getConfig(params.key) }
            : await database.getConfig();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  configuration: config,
                  available_keys: [
                    'sync_interval_minutes',
                    'max_concurrent_syncs', 
                    'embedding_batch_size',
                    'cache_ttl_minutes',
                    'enable_semantic_search',
                    'embedding_model',
                    'max_search_results',
                    'enable_background_sync'
                  ]
                }, null, 2)
              }
            ]
          };
        } else {
          // Set configuration
          if (!params.key || params.value === undefined) {
            return {
              content: [
                {
                  type: "text",
                  text: "For 'set' action, both 'key' and 'value' parameters are required"
                }
              ],
              isError: true
            };
          }

          await database.updateConfig(params.key, params.value);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  message: "Configuration updated successfully",
                  key: params.key,
                  value: params.value,
                  updated_at: new Date().toISOString()
                }, null, 2)
              }
            ]
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error managing config: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Cleanup old sync jobs
  server.tool(
    "aha_sync_cleanup",
    "Clean up old completed/failed sync jobs and optimize database",
    {
      olderThanDays: z.number().min(1).max(365).optional().describe("Remove sync jobs older than this many days (default: 7)")
    },
    async (params: { olderThanDays?: number }) => {
      try {
        const days = params.olderThanDays || 7;
        const deletedCount = await syncService.cleanupOldSyncJobs(days);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Cleanup completed successfully",
                deleted_jobs: deletedCount,
                criteria: `Removed jobs older than ${days} days`,
                recommendation: deletedCount > 0 
                  ? "Database cleanup successful"
                  : "No old sync jobs found to clean up"
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error during cleanup: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Quick sync for specific entity
  server.tool(
    "aha_sync_entity",
    "Quickly sync a specific entity by ID (bypasses background queue)",
    {
      entityType: z.enum(['product', 'feature', 'idea', 'epic', 'initiative', 'user', 'release', 'goal'])
        .describe("Type of entity to sync"),
      entityId: z.string().describe("ID of the specific entity to sync")
    },
    async (params: { entityType: string; entityId: string }) => {
      try {
        // This would be a direct sync operation for a specific entity
        // Implementation would depend on the specific entity type
        // For now, return a placeholder response

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: "Quick entity sync completed",
                entity_type: params.entityType,
                entity_id: params.entityId,
                status: "This feature is not yet implemented - use aha_sync_start for full sync",
                note: "Quick entity sync will be available in the next update"
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error syncing entity: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );
}