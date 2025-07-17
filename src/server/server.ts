import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "../core/resources.js";
import { registerTools } from "../core/tools.js";
import { registerPrompts } from "../core/prompts.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as services from "../core/services/index.js";

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
  lastHealthCheck: null,
  version: packageJson.version,
  environment: process.env.NODE_ENV || "development",
  ahaConnection: {
    status: "unknown",
    lastChecked: null,
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
    healthCheck.checks.memory = { status: "warning", message: `High memory usage: ${memoryUsageMB}MB` };
  } else {
    healthCheck.checks.memory = { status: "healthy", message: `Memory usage: ${memoryUsageMB}MB` };
  }

  // Check Aha.io connection
  try {
    if (services.AhaService.isInitialized()) {
      await services.AhaService.getMe();
      healthCheck.checks.aha = { status: "healthy", message: "Aha.io connection verified" };
      serverStatus.ahaConnection.status = "healthy";
    } else {
      healthCheck.checks.aha = { status: "warning", message: "Aha.io not initialized" };
      serverStatus.ahaConnection.status = "not-initialized";
    }
  } catch (error) {
    healthCheck.checks.aha = { status: "error", message: `Aha.io connection failed: ${error.message}` };
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

    // Register all resources, tools, and prompts
    registerResources(server);
    registerTools(server);
    registerPrompts(server);
    
    // Log comprehensive server information
    console.error(`🚀 Aha.io MCP Server v${packageJson.version} initialized`);
    console.error(`📋 Description: ${packageJson.description}`);
    console.error(`👤 Author: ${packageJson.author}`);
    console.error(`🏠 Homepage: ${packageJson.homepage}`);
    console.error(`📦 Repository: ${packageJson.repository?.url}`);
    console.error(`⚖️  License: ${packageJson.license}`);
    console.error(`🔧 Node.js version: ${process.version}`);
    console.error(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    console.error(`🌐 Platform: ${process.platform} ${process.arch}`);
    console.error(`📂 Working directory: ${process.cwd()}`);
    console.error("");
    console.error("🔌 Server capabilities:");
    console.error("  ✅ Tools: 38 Aha.io integration tools (including health checks)");
    console.error("  ✅ Resources: 40+ Aha.io entity resources");
    console.error("  ✅ Prompts: 12 domain-specific workflow prompts");
    console.error("  ✅ Context-aware: Auto-fetch Aha.io data for prompts");
    console.error("  ✅ Dual transport: stdio and HTTP modes");
    console.error("  ✅ Full CRUD: Complete lifecycle management");
    console.error("  ✅ Health checks: Server monitoring and diagnostics");
    console.error("");
    console.error("📡 Server is ready to handle requests");
    
    updateServerStatus("ready");
    
    // Perform initial health check
    try {
      await performHealthCheck();
      console.error("✅ Initial health check completed successfully");
    } catch (error) {
      console.error("⚠️  Initial health check encountered issues:", error.message);
    }
    
    return server;
  } catch (error) {
    updateServerStatus("error");
    console.error("❌ Failed to initialize server:", error);
    process.exit(1);
  }
}

// Export health check function for external use
export { performHealthCheck, serverStatus };

// Export the server creation function
export default startServer; 