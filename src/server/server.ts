import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "../core/resources.js";
import { registerTools } from "../core/tools.js";
import { registerPrompts } from "../core/prompts.js";
import { registerSampling } from "../core/sampling.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as services from "../core/services/index.js";
import { ConfigService } from "../core/config.js";
import { log } from "../core/logger.js";
import * as z from "zod/v4";

// Get package.json info for server metadata
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "..", "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

// Server status tracking
let serverStatus = {
  status: "initializing",
  startTime: new Date(),
  uptime: 0,
  connections: 0,
  lastHealthCheck: null as Date | null,
  version: packageJson.version,
  environment: process.env.NODE_ENV || "development",
  ahaConnection: {
    status: "unknown",
    lastChecked: null as Date | null,
    company: process.env.AHA_COMPANY || "not-configured",
    tokenConfigured: !!process.env.AHA_TOKEN
  }
};

// Health check function
async function performHealthCheck() {
  const healthCheck = {
    timestamp: new Date(),
    status: "healthy",
    checks: {
      server: { status: "healthy" },
      memory: { status: "healthy" },
      aha: { status: "unknown" }
    },
    uptime: Date.now() - serverStatus.startTime.getTime(),
    version: serverStatus.version
  };

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  
  if (memoryUsageMB > 500) {
    healthCheck.checks.memory = { status: "warning", message: `High memory usage: ${memoryUsageMB}MB` } as any;
  } else {
    healthCheck.checks.memory = { status: "healthy", message: `Memory usage: ${memoryUsageMB}MB` } as any;
  }

  // Check Aha.io connection
  try {
    if (services.AhaService.isInitialized()) {
      await services.AhaService.getMe();
      healthCheck.checks.aha = { status: "healthy", message: "Aha.io connection verified" } as any;
      serverStatus.ahaConnection.status = "healthy";
    } else {
      healthCheck.checks.aha = { status: "warning", message: "Aha.io not initialized" } as any;
      serverStatus.ahaConnection.status = "not-initialized";
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    healthCheck.checks.aha = { status: "error", message: `Aha.io connection failed: ${errorMessage}` } as any;
    serverStatus.ahaConnection.status = "error";
    healthCheck.status = "degraded";
  }

  serverStatus.ahaConnection.lastChecked = healthCheck.timestamp;
  serverStatus.lastHealthCheck = healthCheck.timestamp;

  return healthCheck;
}

// Update server status
function updateServerStatus(status: string) {
  serverStatus.status = status;
  serverStatus.uptime = Date.now() - serverStatus.startTime.getTime();
}

// Create and start the MCP server
async function startServer() {
  try {
    updateServerStatus("initializing");
    
    // Initialize configuration service
    const config = ConfigService.initialize();
    
    // Initialize AhaService if we have complete configuration
    if (ConfigService.isConfigComplete(config)) {
      services.AhaService.initialize(config.token || undefined, config.company || undefined);
    }
    
    // Create a new MCP server instance with enhanced metadata
    const server = new McpServer({
      name: "Aha.io MCP Server",
      version: packageJson.version,
      description: packageJson.description,
      author: packageJson.author,
      homepage: packageJson.homepage,
      repository: packageJson.repository,
      license: packageJson.license
    });

    // Add health check tool
    server.tool(
      "server_health_check",
      "Get server health status and diagnostics",
      {},
      async () => {
        const healthCheck = await performHealthCheck();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(healthCheck, null, 2)
          }]
        };
      }
    );

    // Add server status tool
    server.tool(
      "server_status",
      "Get detailed server status and configuration",
      {},
      async () => {
        updateServerStatus(serverStatus.status);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ...serverStatus,
              systemInfo: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                pid: process.pid,
                workingDirectory: process.cwd(),
                memoryUsage: {
                  heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                  heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                  external: Math.round(process.memoryUsage().external / 1024 / 1024),
                  rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
                }
              }
            }, null, 2)
          }]
        };
      }
    );

    // Add configuration management tools
    server.tool(
      "configure_server",
      "Configure server settings (company, token, mode)",
      {
        company: z.string().optional().describe("Aha.io company subdomain"),
        token: z.string().optional().describe("Aha.io API token"),
        mode: z.enum(["stdio", "sse"]).optional().describe("Transport mode"),
        port: z.number().optional().describe("Port number for SSE mode"),
        host: z.string().optional().describe("Host address for SSE mode")
      },
      async (params) => {
        try {
          const updates: any = {};
          
          if (params.company !== undefined) updates.company = params.company;
          if (params.token !== undefined) updates.token = params.token;
          if (params.mode !== undefined) updates.mode = params.mode;
          if (params.port !== undefined) updates.port = params.port;
          if (params.host !== undefined) updates.host = params.host;

          const newConfig = ConfigService.updateConfig(updates);
          
          // Update AhaService with new credentials if provided
          if (params.company || params.token) {
            services.AhaService.initialize(newConfig.token || undefined, newConfig.company || undefined);
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Configuration updated successfully",
                config: ConfigService.getConfigSummary(),
                note: "Server restart may be required for transport mode changes"
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            }]
          };
        }
      }
    );

    server.tool(
      "get_server_config",
      "Get current server configuration",
      {},
      async () => {
        const configSummary = ConfigService.getConfigSummary();
        const currentConfig = ConfigService.getConfig();
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ...configSummary,
              validation: ConfigService.validateConfig(currentConfig),
              environmentOverrides: {
                company: !!process.env.AHA_COMPANY,
                token: !!process.env.AHA_TOKEN,
                mode: !!process.env.MCP_TRANSPORT_MODE,
                port: !!process.env.MCP_PORT,
                host: !!process.env.MCP_HOST
              }
            }, null, 2)
          }]
        };
      }
    );

    server.tool(
      "test_configuration",
      "Test current Aha.io configuration",
      {},
      async () => {
        try {
          const config = ConfigService.getConfig();
          
          if (!ConfigService.isConfigComplete(config)) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Configuration is incomplete. Company and token are required.",
                  config: ConfigService.getConfigSummary()
                }, null, 2)
              }]
            };
          }

          // Test connection by trying to get current user
          const user = await services.AhaService.getMe();
          
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Configuration test successful",
                connection: {
                  status: "connected",
                  user: {
                    name: user.name || 'Unknown',
                    email: user.email || 'Unknown',
                    id: user.id || 'Unknown'
                  },
                  company: config.company
                }
              }, null, 2)
            }]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: errorMessage,
                suggestion: "Check your company subdomain and API token"
              }, null, 2)
            }]
          };
        }
      }
    );

    // Register all resources, tools, prompts, and sampling
    registerResources(server);
    registerTools(server);
    registerPrompts(server);
    registerSampling(server);
    
    // Log comprehensive server information
    log.info('Aha.io MCP Server initialized successfully', {
      version: packageJson.version,
      description: packageJson.description,
      author: packageJson.author,
      homepage: packageJson.homepage,
      repository: packageJson.repository?.url,
      license: packageJson.license,
      node_version: process.version,
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      platform: process.platform,
      arch: process.arch,
      working_directory: process.cwd(),
      capabilities: {
        tools: 40,
        resources: '40+',
        prompts: 12,
        features: [
          'context-aware',
          'dual-transport',
          'full-crud', 
          'health-checks',
          'runtime-config'
        ]
      }
    });
    
    updateServerStatus("ready");
    
    // Perform initial health check
    try {
      const healthResult = await performHealthCheck();
      log.info('Initial health check completed successfully', {
        health_status: healthResult.status,
        aha_connection: healthResult.checks.aha.status,
        memory_check: healthResult.checks.memory.status
      });
    } catch (error) {
      log.warn('Initial health check encountered issues', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return server;
  } catch (error) {
    updateServerStatus("error");
    log.error('Failed to initialize server', error as Error);
    process.exit(1);
  }
}

// Export health check function for external use
export { performHealthCheck, serverStatus };

// Export the server creation function
export default startServer; 