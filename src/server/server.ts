import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "../core/resources.js";
import { registerTools } from "../core/tools.js";
import { registerPrompts } from "../core/prompts.js";
import { registerSampling } from "../core/sampling.js";
import { buildServerInstructions } from "../core/instructions.js";
import * as services from "../core/services/index.js";
import { ConfigService } from "../core/config.js";
import { installToolRateLimit } from "../core/rate-limit.js";
import {
  configureServerOutputSchema,
  healthCheckOutputSchema,
  serverConfigOutputSchema,
  serverStatusOutputSchema,
  testConfigurationOutputSchema
} from "../core/tool-output.js";
import { log } from "../core/logger.js";
import { describeAhaError } from "../core/services/aha-errors.js";
import * as z from "zod/v4";
// Imported rather than read from disk at runtime: the bundled build/index.js sits at a
// different depth than this source file, so resolving "../../package.json" relative to
// import.meta.url crashed the server on startup for every packaged artifact.
import packageJson from "../../package.json";

/**
 * Count what actually got registered, for the startup log and server_status.
 *
 * The SDK keeps these registries private, so read them defensively: a wrong count is not
 * worth throwing over, and the previous hardcoded numbers had already drifted (40 tools and
 * 12 prompts against an actual 30 and 14).
 */
function countRegistered(server: McpServer, kind: 'tool' | 'resource' | 'prompt'): number | 'unknown' {
  const field = {
    tool: '_registeredTools',
    resource: '_registeredResources',
    prompt: '_registeredPrompts'
  }[kind];

  const registry = (server as unknown as Record<string, unknown>)[field];
  return registry && typeof registry === 'object' ? Object.keys(registry).length : 'unknown';
}

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
    const errorMessage = describeAhaError(error);
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
    const server = new McpServer(
      {
        name: "Aha.io MCP Server",
        version: packageJson.version,
        description: packageJson.description,
        author: packageJson.author,
        homepage: packageJson.homepage,
        repository: packageJson.repository,
        license: packageJson.license
      },
      // Returned in the initialize response, so clients have this before the first call.
      { instructions: buildServerInstructions(config.company) }
    );

    // Before any registerTool call: the limiter works by wrapping the registrar, so tools
    // registered ahead of this line would not be covered.
    installToolRateLimit(server);

    // Add health check tool
    server.registerTool(
      "server_health_check",
      {
        title: "Check server health",
        description: "Get server health status and diagnostics",
        // strictObject({}).optional(): a raw `{}` shape made `arguments` mandatory, so
        // `tools/call` with no arguments at all - which the spec allows - failed input
        // validation. Strict still rejects arguments this tool would ignore.
        inputSchema: z.strictObject({}).optional(),
        outputSchema: healthCheckOutputSchema,
        // openWorld: the check calls Aha's /me endpoint when credentials are present.
        annotations: {
          title: "Check server health",
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async () => {
        const healthCheck = await performHealthCheck();
        // Dates are serialised for structuredContent rather than handed over as Date
        // objects: output validation runs on the value before it is serialised, so a Date
        // where the schema says string would fail the call.
        const payload = { ...healthCheck, timestamp: healthCheck.timestamp.toISOString() };
        return {
          content: [{
            type: "text",
            text: JSON.stringify(payload, null, 2)
          }],
          structuredContent: payload
        };
      }
    );

    // Add server status tool
    server.registerTool(
      "server_status",
      {
        title: "Get server status",
        description: "Get detailed server status and configuration",
        // strictObject({}).optional(): a raw `{}` shape made `arguments` mandatory, so
        // `tools/call` with no arguments at all - which the spec allows - failed input
        // validation. Strict still rejects arguments this tool would ignore.
        inputSchema: z.strictObject({}).optional(),
        outputSchema: serverStatusOutputSchema,
        annotations: {
          title: "Get server status",
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        updateServerStatus(serverStatus.status);
        const payload = {
          ...serverStatus,
          // Same reason as server_health_check: ISO strings, not Date objects.
          startTime: serverStatus.startTime.toISOString(),
          lastHealthCheck: serverStatus.lastHealthCheck?.toISOString() ?? null,
          ahaConnection: {
            ...serverStatus.ahaConnection,
            lastChecked: serverStatus.ahaConnection.lastChecked?.toISOString() ?? null
          },
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
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(payload, null, 2)
          }],
          structuredContent: payload
        };
      }
    );

    // Add configuration management tools
    server.registerTool(
      "configure_server",
      {
        title: "Configure server",
        description: "Configure server settings (company, token, mode)",
        inputSchema: {
          company: z.string().optional().describe("Aha.io company subdomain"),
          token: z.string().optional().describe("Aha.io API token"),
          // This previously read ["stdio", "sse"], so the recommended transport could not be
          // configured through this tool at all, and the removed one still could.
          mode: z.enum(["stdio", "streamable-http"]).optional().describe("Transport mode"),
          port: z.number().optional().describe("Port number for the streamable-http transport"),
          host: z.string().optional().describe("Host address for the streamable-http transport")
        },
        outputSchema: configureServerOutputSchema,
        // non-destructive: only the fields supplied are merged into ~/.aha-mcp-config.json.
        annotations: {
          title: "Configure server",
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
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

          const payload = {
            success: true as const,
            message: "Configuration updated successfully",
            config: ConfigService.getConfigSummary() as Record<string, unknown>,
            note: "Server restart may be required for transport mode changes"
          };

          return {
            content: [{
              type: "text",
              text: JSON.stringify(payload, null, 2)
            }],
            structuredContent: payload
          };
        } catch (error) {
          // A rejected configuration is a tool execution error: isError lets the client show
          // it as a failure and gives the model something to correct, which a success-shaped
          // result carrying `success: false` does not.
          return {
            content: [{
              type: "text",
              text: `Configuration update failed: ${describeAhaError(error)}`
            }],
            isError: true
          };
        }
      }
    );

    server.registerTool(
      "get_server_config",
      {
        title: "Get server configuration",
        description: "Get current server configuration",
        // strictObject({}).optional(): a raw `{}` shape made `arguments` mandatory, so
        // `tools/call` with no arguments at all - which the spec allows - failed input
        // validation. Strict still rejects arguments this tool would ignore.
        inputSchema: z.strictObject({}).optional(),
        outputSchema: serverConfigOutputSchema,
        annotations: {
          title: "Get server configuration",
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        const configSummary = ConfigService.getConfigSummary();
        const currentConfig = ConfigService.getConfig();

        const payload = {
          ...(configSummary as Record<string, unknown>),
          validation: ConfigService.validateConfig(currentConfig),
          environmentOverrides: {
            company: !!process.env.AHA_COMPANY,
            token: !!process.env.AHA_TOKEN,
            mode: !!process.env.MCP_TRANSPORT_MODE,
            port: !!process.env.MCP_PORT,
            host: !!process.env.MCP_HOST
          }
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(payload, null, 2)
          }],
          structuredContent: payload
        };
      }
    );

    server.registerTool(
      "test_configuration",
      {
        title: "Test Aha.io configuration",
        description: "Test current Aha.io configuration",
        // strictObject({}).optional(): a raw `{}` shape made `arguments` mandatory, so
        // `tools/call` with no arguments at all - which the spec allows - failed input
        // validation. Strict still rejects arguments this tool would ignore.
        inputSchema: z.strictObject({}).optional(),
        outputSchema: testConfigurationOutputSchema,
        annotations: {
          title: "Test Aha.io configuration",
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
      async () => {
        try {
          const config = ConfigService.getConfig();

          // Both failure paths below carry isError. They used to return a success-shaped
          // result whose body said `success: false`, which clients render as a successful
          // call and the spec reserves for results the model should treat as fact.
          if (!ConfigService.isConfigComplete(config)) {
            return {
              content: [{
                type: "text",
                text: "Configuration is incomplete. Company and token are required.\n\n" +
                  JSON.stringify(ConfigService.getConfigSummary(), null, 2)
              }],
              isError: true
            };
          }

          // Test connection by trying to get current user
          const user = await services.AhaService.getMe();

          const payload = {
            success: true as const,
            message: "Configuration test successful",
            connection: {
              status: "connected",
              user: {
                name: user.name || 'Unknown',
                email: user.email || 'Unknown',
                id: user.id || 'Unknown'
              },
              company: config.company ?? 'not configured'
            }
          };

          return {
            content: [{
              type: "text",
              text: JSON.stringify(payload, null, 2)
            }],
            structuredContent: payload
          };
        } catch (error) {
          const errorMessage = describeAhaError(error);
          return {
            content: [{
              type: "text",
              text: `Configuration test failed: ${errorMessage}\n\n` +
                "Check your company subdomain and API token."
            }],
            isError: true
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
        // Counted from the registry rather than hardcoded, which had drifted (it read
        // 40 tools and 12 prompts against an actual 30 and 14).
        tools: countRegistered(server, 'tool'),
        resources: countRegistered(server, 'resource'),
        prompts: countRegistered(server, 'prompt'),
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
        error: describeAhaError(error)
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